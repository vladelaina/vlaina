import { useRef, useEffect, useMemo, useLayoutEffect } from 'react';
import { MdBrokenImage } from 'react-icons/md';
import { cn } from '@/lib/utils';
import { loadImageAsBlob } from '@/lib/assets/io/reader';
import { buildFullAssetPath } from '@/lib/assets/core/paths';
import { isBuiltinCover, getBuiltinCoverUrl } from '@/lib/assets/builtinCovers';
import { CoverPicker } from '../../../AssetLibrary';
import { useCoverSource } from '../../hooks/useCoverSource';
import { calculateCropPixels } from '../../hooks/coverUtils';
import { useCoverState } from './hooks/useCoverState';
import { useCoverInteraction } from './hooks/useCoverInteraction';
import { useCoverResize } from './hooks/useCoverResize';
import { CoverRenderer } from './CoverRenderer';

interface CoverImageProps {
    url: string | null;
    positionX: number;
    positionY: number;
    height?: number;
    scale?: number;
    readOnly?: boolean;
    onUpdate: (url: string | null, positionX: number, positionY: number, height?: number, scale?: number) => void;
    vaultPath: string;
    pickerOpen?: boolean;
    onPickerOpenChange?: (open: boolean) => void;
}

export function CoverImage({
    url,
    positionX,
    positionY,
    height: initialHeight,
    scale = 1,
    readOnly = false,
    onUpdate,
    vaultPath,
    pickerOpen,
    onPickerOpenChange,
}: CoverImageProps) {

    // 1. Core State
    const {
        coverHeight, setCoverHeight,
        containerSize, setContainerSize,
        mediaSize, setMediaSize,
        crop, setCrop,
        zoom, setZoom,
        isInteracting, setIsInteracting,
        isResizing, setIsResizing,
        isManualResizingRef,
        showPicker, setShowPicker
    } = useCoverState({ initialHeight, scale, pickerOpen, onPickerOpenChange });

    // 2. Data Source
    const {
        resolvedSrc, previewSrc, isImageReady, setPreviewSrc, setIsImageReady,
        prevSrcRef, isError, isSelectingRef
    } = useCoverSource({ url, vaultPath, onUpdate });

    // Handlers (Re-implemented here to access both source and state)
    const handleCoverSelect = (assetPath: string) => {
        if (assetPath === url) {
            setPreviewSrc(null);
            isSelectingRef.current = false;
            onUpdate(assetPath, 50, 50, coverHeight, 1);
            setShowPicker(false);
            return;
        }
        isSelectingRef.current = true;
        onUpdate(assetPath, 50, 50, coverHeight, 1);
        setShowPicker(false);
    };

    const lastPreviewPathRef = useRef<string | null>(null);
    const handlePreview = async (assetPath: string | null) => {
        lastPreviewPathRef.current = assetPath;
        if (assetPath) isSelectingRef.current = false;

        if (!assetPath) {
            if (!isSelectingRef.current) setPreviewSrc(null);
            return;
        }
        try {
            if (isBuiltinCover(assetPath)) {
                setPreviewSrc(getBuiltinCoverUrl(assetPath));
                return;
            }
            if (!vaultPath) return;
            const fullPath = buildFullAssetPath(vaultPath, assetPath);
            const blobUrl = await loadImageAsBlob(fullPath);
            if (assetPath === lastPreviewPathRef.current) setPreviewSrc(blobUrl);
        } catch {
            if (assetPath === lastPreviewPathRef.current) setPreviewSrc(null);
        }
    };

    const handlePickerClose = () => {
        if (!isSelectingRef.current) {
            setPreviewSrc(null);
        }
        setShowPicker(false);
    };

    useLayoutEffect(() => {
        if (previewSrc) {
            setCrop({ x: 0, y: 0 });
            setZoom(1);
            setIsImageReady(false);
        }
    }, [previewSrc, setCrop, setZoom, setIsImageReady]);

    const effectiveContainerSize = useMemo(() => {
        if (!containerSize) return null;
        return { width: containerSize.width, height: coverHeight };
    }, [containerSize, coverHeight]);

    // 3. Interaction Logic (Zoom, Pan, Save)
    const {
        objectFitMode, effectiveMinZoom, effectiveMaxZoom,
        handleInteractionStart, handleInteractionEnd,
        onCropperCropChange, onCropperZoomChange
    } = useCoverInteraction({
        mediaSize, effectiveContainerSize, zoom, setZoom, crop, setCrop,
        coverHeight, url, positionX, positionY, scale, readOnly,
        onUpdate, setIsInteracting, showPicker, setShowPicker
    });

    const containerRef = useRef<HTMLDivElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // 4. Resize Logic (Complex Physics)
    const {
        handleResizeMouseDown, frozenImageState, frozenImgRef, ignoreCropSyncRef
    } = useCoverResize({
        mediaSize, effectiveContainerSize, zoom, crop,
        coverHeight, setCoverHeight, setCrop, setIsResizing, isManualResizingRef,
        containerRef, wrapperRef, onUpdate, url, positionX, positionY, scale
    });

    // Sync Crop Props (Moved here because it needs ignoreCropSyncRef from Resize hook)
    useEffect(() => {
        if (isInteracting || isResizing || !mediaSize || !effectiveContainerSize) return;
        if (ignoreCropSyncRef.current) {
            ignoreCropSyncRef.current = false;
            return;
        }
        const pixels = calculateCropPixels(
            { x: positionX, y: positionY },
            mediaSize,
            effectiveContainerSize,
            zoom
        );
        setCrop(pixels);
    }, [positionX, positionY, scale, mediaSize, effectiveContainerSize, isInteracting, isResizing, zoom, setCrop]);

    // Resize Observer for Container
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        let rafId: number;
        const observer = new ResizeObserver(entries => {
            if (rafId) cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => {
                for (const entry of entries) {
                    const { width, height } = entry.contentRect;
                    const roundedWidth = Math.round(width);
                    const roundedHeight = Math.round(height);
                    if (isManualResizingRef.current) return;
                    setContainerSize(prev => {
                        if (prev?.width === roundedWidth && prev?.height === roundedHeight) return prev;
                        return { width: roundedWidth, height: roundedHeight };
                    });
                }
            });
        });
        observer.observe(el);
        return () => {
            observer.disconnect();
            if (rafId) cancelAnimationFrame(rafId);
        };
    }, []);


    // --- RENDER ---
    if (!url && !showPicker && !previewSrc) return null;

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
    const isPreviewing = previewSrc && !isSelectingRef.current;
    const effectiveCrop = isPreviewing ? { x: 0, y: 0 } : crop;
    const effectiveZoom = isPreviewing ? 1 : zoom;

    return (
        <div
            className={cn("relative w-full bg-muted/20 shrink-0 select-none overflow-hidden group")}
            style={{ height: coverHeight }}
            ref={containerRef}
        >
            <CoverRenderer
                displaySrc={displaySrc}
                isImageReady={isImageReady}
                isResizing={isResizing}
                wrapperRef={wrapperRef}
                frozenImgRef={frozenImgRef}
                frozenImageState={frozenImageState}
                crop={effectiveCrop}
                zoom={effectiveZoom}
                effectiveContainerSize={effectiveContainerSize}
                effectiveMinZoom={effectiveMinZoom}
                effectiveMaxZoom={effectiveMaxZoom}
                objectFitMode={objectFitMode}
                onCropperCropChange={onCropperCropChange}
                onCropperZoomChange={onCropperZoomChange}
                onInteractionStart={handleInteractionStart}
                onInteractionEnd={handleInteractionEnd}
                onMediaLoaded={(media) => {
                    setMediaSize({ width: media.naturalWidth, height: media.naturalHeight });
                    if (effectiveContainerSize && !isImageReady) {
                        const targetX = previewSrc ? 50 : positionX;
                        const targetY = previewSrc ? 50 : positionY;
                        const targetZoom = previewSrc ? 1 : zoom;
                        const pixels = calculateCropPixels({ x: targetX, y: targetY }, { width: media.naturalWidth, height: media.naturalHeight }, effectiveContainerSize, targetZoom);
                        setCrop(pixels);
                        setZoom(targetZoom);
                    } else if (!isImageReady) {
                        setCrop({ x: 0, y: 0 });
                        setZoom(1);
                    }
                    if (!isImageReady) setIsImageReady(true);
                }}
                positionX={positionX}
                positionY={positionY}
            />

            {/* Error Overlay */}
            {isError && (
                <div
                    className={cn(
                        "absolute inset-0 flex flex-col items-center justify-center bg-muted/20 text-muted-foreground z-10",
                        !readOnly && "cursor-pointer hover:bg-muted/30 transition-colors"
                    )}
                    onMouseDown={() => !readOnly && setShowPicker(true)}
                >
                    <MdBrokenImage className="w-8 h-8 mb-2 opacity-50" />
                    <span className="text-xs font-medium opacity-70">Image failed to load</span>
                    {!readOnly && <span className="text-[10px] opacity-50 mt-1">Click to replace</span>}
                </div>
            )}

            {/* Overlay Triggers */}
            {!displaySrc && !isError && (
                <div
                    className="absolute inset-0 flex items-center justify-center text-muted-foreground cursor-pointer z-10"
                    onMouseDown={() => !readOnly && setShowPicker(true)}
                >
                    {!readOnly && <span className="text-xs">Click to change cover</span>}
                </div>
            )}

            {readOnly && <div className="absolute inset-0 z-20" />}

            {!readOnly && (
                <div
                    className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize z-40 opacity-0 hover:opacity-100 transition-opacity"
                    onMouseDown={handleResizeMouseDown}
                    onDoubleClick={() => {
                        const goldenHeight = Math.round(window.innerHeight * 0.236);
                        setCoverHeight(goldenHeight);
                        onUpdate(url, positionX, positionY, goldenHeight, scale);
                    }}
                />
            )}

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
