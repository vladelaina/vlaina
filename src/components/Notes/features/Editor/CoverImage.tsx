import { useState, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { CoverPicker } from '../AssetLibrary';
import { loadImageAsBlob } from '@/lib/assets/imageLoader';
import { buildFullAssetPath } from '@/lib/assets/pathUtils';
import { isBuiltinCover, getBuiltinCoverUrl } from '@/lib/assets/builtinCovers';
import { useCoverSource } from './hooks/useCoverSource';
import { useCoverInteraction } from './hooks/useCoverInteraction';


interface CoverImageProps {
    url: string | null;
    positionX: number;
    positionY: number;
    height?: number;
    scale?: number;
    readOnly?: boolean;
    onUpdate: (url: string | null, positionX: number, positionY: number, height?: number, scale?: number) => void;
    vaultPath: string;
    /** External control to open the picker (for "Add cover" button) */
    pickerOpen?: boolean;
    onPickerOpenChange?: (open: boolean) => void;
}

export function CoverImage({
    url,
    positionX,
    positionY,
    height,
    scale = 1,
    readOnly = false,
    onUpdate,
    vaultPath,
    pickerOpen,
    onPickerOpenChange,
}: CoverImageProps) {
    // Refs for DOM elements
    const containerRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);

    // 1. Data Source Hook
    const {
        resolvedSrc,
        previewSrc,
        setPreviewSrc,
        isImageReady,
        prevSrcRef,
        isSelectingRef,
        cachedDimensionsRef,
        handleImageLoad
    } = useCoverSource({ url, vaultPath, onUpdate });

    // 2. Interaction Hook
    const {
        coverHeight,
        setCoverHeight,
        isAnimating,
        isResizingHeight,
        handleImageMouseDown,
        handleResizeMouseDown,
        imageStyle
    } = useCoverInteraction({
        url, positionX, positionY, height, scale, readOnly, onUpdate,
        containerRef, imgRef, cachedDimensionsRef
    });

    // UI state - use external control if provided
    const [internalShowPicker, setInternalShowPicker] = useState(false);
    const showPicker = pickerOpen ?? internalShowPicker;

    // Wrapped setter to handle external vs internal control
    const setShowPicker = useCallback((open: boolean) => {
        if (onPickerOpenChange) {
            onPickerOpenChange(open);
        } else {
            setInternalShowPicker(open);
        }
    }, [onPickerOpenChange]);

    // Cover selection handler
    const handleCoverSelect = useCallback(async (assetPath: string) => {
        // If selecting the same cover, useEffect[url] won't fire to clear preview
        // So we must manually clear it and reset state
        if (assetPath === url) {
            setPreviewSrc(null);
            isSelectingRef.current = false;
            // Reset logic for re-selection
            onUpdate(assetPath, 50, 50, coverHeight, 1);
            setShowPicker(false);
            return;
        }

        isSelectingRef.current = true;

        // RESET LOGIC: 
        // Reset Position -> Center (50, 50)
        // Reset Scale -> 1
        // Keep Height -> Preserves user's layout preference
        onUpdate(assetPath, 50, 50, coverHeight, 1);
        setShowPicker(false);
    }, [url, coverHeight, onUpdate, setPreviewSrc, isSelectingRef, setShowPicker]);

    // Preview handler
    const handlePreview = useCallback(async (assetPath: string | null) => {
        if (!assetPath) {
            if (!isSelectingRef.current) {
                setPreviewSrc(null);
            }
            return;
        }

        try {
            // Built-in covers use URL directly
            if (isBuiltinCover(assetPath)) {
                setPreviewSrc(getBuiltinCoverUrl(assetPath));
                return;
            }

            if (!vaultPath) return;

            const fullPath = buildFullAssetPath(vaultPath, assetPath);
            const blobUrl = await loadImageAsBlob(fullPath);
            setPreviewSrc(blobUrl);
        } catch {
            setPreviewSrc(null);
        }
    }, [vaultPath, isSelectingRef, setPreviewSrc]);

    const handlePickerClose = useCallback(() => {
        setPreviewSrc(null);
        setShowPicker(false);
    }, [setPreviewSrc, setShowPicker]);

    // Render Logic

    // No cover and no picker/preview - render nothing
    if (!url && !showPicker && !previewSrc) {
        return null;
    }

    // No cover but picker is open or has preview - show preview area
    if (!url) {
        return (
            <div className="relative w-full">
                {previewSrc && (
                    <div className="relative w-full h-[200px] shrink-0 overflow-hidden">
                        <img src={previewSrc} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                )}
                <CoverPicker
                    isOpen={showPicker}
                    onClose={handlePickerClose}
                    onSelect={handleCoverSelect}
                    onPreview={handlePreview}
                    vaultPath={vaultPath}
                />
            </div>
        );
    }

    const displaySrc = previewSrc || resolvedSrc || prevSrcRef.current || '';

    return (
        <div className="relative w-full">
            <div
                className={cn(
                    "relative w-full bg-muted/20 shrink-0 select-none overflow-hidden",
                    // Only apply transition when NOT actively resizing
                    !isResizingHeight && "transition-[height] duration-150 ease-out"
                )}
                style={{
                    height: coverHeight,
                    // GPU acceleration hint during resize
                    willChange: isResizingHeight ? 'height' : 'auto',
                }}
                ref={containerRef}
            >
                {displaySrc && (
                    <img
                        ref={imgRef}
                        src={displaySrc}
                        alt="Cover"
                        className={cn(
                            !readOnly && "cursor-pointer",
                            // Only apply transition when animating and NOT resizing
                            isAnimating && !isResizingHeight && "transition-all duration-150 ease-out"
                        )}
                        style={{
                            ...(previewSrc ? { width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center center' } : imageStyle),
                            // GPU acceleration hint during resize/drag
                            willChange: isResizingHeight ? 'width, height, top' : 'auto',
                            // Display condition: preview / new image ready / has old image for transition
                            opacity: previewSrc || isImageReady || prevSrcRef.current ? 1 : 0,
                        }}
                        draggable={false}
                        // Use wrapped handler that opens picker if not dragged
                        onMouseDown={previewSrc ? undefined : (e) => handleImageMouseDown(e, () => setShowPicker(true))}
                        onLoad={handleImageLoad}
                    />
                )}
                {!readOnly && !showPicker && (
                    <div
                        className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize z-30 flex justify-center group/handle hover:h-3 transition-[height]"
                        onMouseDown={handleResizeMouseDown}
                        onDoubleClick={() => {
                            // Classic Golden Ratio reset
                            const goldenHeight = Math.round(window.innerHeight * 0.236);
                            setCoverHeight(goldenHeight);
                            onUpdate(url, 50, 50, goldenHeight, 1);
                        }}
                    />
                )}
            </div>
            <CoverPicker
                isOpen={showPicker}
                onClose={handlePickerClose}
                onSelect={handleCoverSelect}
                onRemove={url ? () => onUpdate(null, 50, 50) : undefined}
                onPreview={handlePreview}
                vaultPath={vaultPath}
            />
        </div>
    );
}
