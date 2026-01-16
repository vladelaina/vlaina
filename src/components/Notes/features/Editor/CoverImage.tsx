import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import Cropper from 'react-easy-crop';
import { ImageOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CoverPicker } from '../AssetLibrary';
import { loadImageAsBlob } from '@/lib/assets/imageLoader';
import { buildFullAssetPath } from '@/lib/assets/pathUtils';
import { isBuiltinCover, getBuiltinCoverUrl } from '@/lib/assets/builtinCovers';
import { useCoverSource } from './hooks/useCoverSource';
// We import constants for consistent constraints
import {
    MIN_HEIGHT, MAX_HEIGHT, DEFAULT_HEIGHT, MAX_SCALE,
    calculateCropPixels, calculateCropPercentage, getBaseDimensions
} from './hooks/coverUtils';

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
    // --- Height State (Managed Manually) ---
    const [coverHeight, setCoverHeight] = useState(initialHeight ?? DEFAULT_HEIGHT);
    const containerRef = useRef<HTMLDivElement>(null);
    const lastHeightProp = useRef(initialHeight);

    // Sync height if prop changes externally
    if (initialHeight !== undefined && initialHeight !== lastHeightProp.current) {
        lastHeightProp.current = initialHeight;
        setCoverHeight(initialHeight);
    }

    // --- Data Source ---
    const {
        resolvedSrc,
        previewSrc,
        isImageReady,
        setPreviewSrc,
        setIsImageReady,
        prevSrcRef,
        isError,
        isSelectingRef
    } = useCoverSource({ url, vaultPath, onUpdate });


    // --- Resize Observer for Container ---
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        let rafId: number;

        const observer = new ResizeObserver(entries => {
            // Cancel previous pending frame to ensure we only run the latest
            if (rafId) cancelAnimationFrame(rafId);

            rafId = requestAnimationFrame(() => {
                for (const entry of entries) {
                    const { width, height } = entry.contentRect;
                    setContainerSize(prev => {
                        // Prevent loops if dimensions match
                        if (prev?.width === width && prev?.height === height) return prev;
                        return { width, height };
                    });
                }
            });
        });

        observer.observe(el);
        return () => {
            observer.disconnect();
            if (rafId) cancelAnimationFrame(rafId);
        };
    }, []); // containerRef is stable


    // --- Picker State ---
    const [internalShowPicker, setInternalShowPicker] = useState(false);
    const showPicker = pickerOpen ?? internalShowPicker;

    const setShowPicker = useCallback((open: boolean) => {
        if (onPickerOpenChange) {
            onPickerOpenChange(open);
        } else {
            setInternalShowPicker(open);
        }
    }, [onPickerOpenChange]);

    // --- Cropper State ---
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(scale);
    const [mediaSize, setMediaSize] = useState<{ width: number, height: number } | null>(null);
    const [containerSize, setContainerSize] = useState<{ width: number, height: number } | null>(null);
    // Track if we are currently interacting to prevent state loops
    const [isInteracting, setIsInteracting] = useState(false);

    // Determine objectFit mode for true "cover" behavior
    // If image aspect ratio > container aspect ratio: image is wider, so fill height (vertical-cover)
    // If image aspect ratio < container aspect ratio: image is taller, so fill width (horizontal-cover)
    const objectFitMode: 'contain' | 'horizontal-cover' | 'vertical-cover' = (() => {
        if (!mediaSize || !containerSize) return 'horizontal-cover'; // Safe default
        const imageAspect = mediaSize.width / mediaSize.height;
        const containerAspect = containerSize.width / containerSize.height;
        return imageAspect > containerAspect ? 'vertical-cover' : 'horizontal-cover';
    })();

    // With objectFit='...-cover', Zoom 1 always means "Perfectly Covered".
    // So we just need to ensure Zoom never drops below 1.
    const effectiveMinZoom = 1;

    // Use a reasonable max zoom (e.g. 5x or 10x the cover size)
    const effectiveMaxZoom = MAX_SCALE;

    // Sync Zoom Prop & Enforce Min Scale
    useEffect(() => {
        if (!isInteracting) {
            // Ensure we don't drop below 1.0
            const safeZoom = Math.max(scale, 1);
            if (zoom !== safeZoom) {
                setZoom(safeZoom);
            }
        }
    }, [scale, isInteracting]);

    // Sync Crop Props
    useEffect(() => {
        if (isInteracting || !mediaSize || !containerSize) return;

        const pixels = calculateCropPixels(
            { x: positionX, y: positionY },
            mediaSize,
            containerSize,
            zoom
        );
        setCrop(pixels);

    }, [positionX, positionY, scale, mediaSize, containerSize, isInteracting, zoom]); // Use scale prop for sync

    // --- Interaction Handlers ---

    // --- Handlers for Cropper ---
    // --- Interaction Handlers ---

    // Track if actual modification occurred during interaction
    const dragOccurredRef = useRef(false);
    // Track if picker was open at start of interaction to prevent "Close -> Reopen" race
    const wasPickerOpenRef = useRef(false);

    // Helper to save changes to the database
    const saveToDb = useCallback((currentCrop: { x: number, y: number }, currentZoom: number) => {
        if (!mediaSize || !containerSize) return;

        const percent = calculateCropPercentage(
            currentCrop,
            mediaSize,
            containerSize,
            currentZoom
        );

        onUpdate(url, percent.x, percent.y, coverHeight, currentZoom);
    }, [mediaSize, containerSize, url, coverHeight, onUpdate]);

    // --- Interaction Handlers (Memoized) ---
    // Define handlers for Start/End to manage interacting state and saving
    const handleInteractionStart = useCallback(() => {
        setIsInteracting(true);
        dragOccurredRef.current = false;
        wasPickerOpenRef.current = showPicker;
    }, [showPicker]);

    const handleInteractionEnd = useCallback(() => {
        setIsInteracting(false);

        if (dragOccurredRef.current) {
            // If dragged/zoomed, save changes
            saveToDb(crop, zoom);
        } else if (!readOnly && !wasPickerOpenRef.current) {
            // If closed, open it
            setShowPicker(true);
        } else if (!readOnly && wasPickerOpenRef.current) {
            // If open, close it
            setShowPicker(false);
        }
    }, [readOnly, crop, zoom, saveToDb, setShowPicker]);

    // --- Handlers for Cropper (Memoized) ---
    // Update local state only
    const onCropperCropChange = useCallback((newCrop: { x: number, y: number }) => {
        if (readOnly) return;

        // Manual Hard Clamp to prevent "Rubber Banding" (Whitespace)
        // Access state directly or via refs if needed, but here we depend on mediaSize/containerSize
        // We include them in dependency array.
        // NOTE: To avoid re-creating this function if mediaSize changes (which shouldn't happen during drag often),
        // we are fine. But zoom changes? No, zoom is stable during pan.
        // Actually, zoom might change during zoom interactions.

        if (mediaSize && containerSize) {
            const baseDims = getBaseDimensions(mediaSize, containerSize);
            const scaledW = baseDims.width * zoom;
            const scaledH = baseDims.height * zoom;

            // Calculate max translation allowed (from center)
            const maxTranslateX = Math.max(0, (scaledW - containerSize.width) / 2);
            const maxTranslateY = Math.max(0, (scaledH - containerSize.height) / 2);

            // Clamp
            const clampedX = Math.max(-maxTranslateX, Math.min(maxTranslateX, newCrop.x));
            const clampedY = Math.max(-maxTranslateY, Math.min(maxTranslateY, newCrop.y));

            setCrop({ x: clampedX, y: clampedY });
        } else {
            setCrop(newCrop);
        }

        dragOccurredRef.current = true;
    }, [readOnly, mediaSize, containerSize, zoom]);

    const onCropperZoomChange = useCallback((newZoom: number) => {
        if (readOnly) return;
        // Hard Clamp: Enforce "No Whitespace" during interaction
        const safeZoom = Math.max(newZoom, effectiveMinZoom);
        setZoom(safeZoom);
        dragOccurredRef.current = true;
    }, [readOnly, effectiveMinZoom]);

    // Memoize static style objects to prevent re-renders
    const cropperStyle = useMemo(() => ({
        containerStyle: { backgroundColor: 'transparent' },
        cropAreaStyle: { border: 'none', boxShadow: 'none', color: 'transparent' },
        mediaStyle: {
            willChange: 'transform',
            backfaceVisibility: 'hidden' as 'hidden',
            transform: 'translateZ(0)',
            maxWidth: 'none',
            maxHeight: 'none'
        }
    }), []);

    const mediaProps = useMemo(() => ({
        style: {
            willChange: 'transform',
            backfaceVisibility: 'hidden' as 'hidden',
            transform: 'translateZ(0)',
            maxWidth: 'none',
            maxHeight: 'none'
        }
    }), []);

    // --- Other Handlers (Copy reused) ---
    const handleCoverSelect = useCallback((assetPath: string) => {
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
    }, [url, coverHeight, onUpdate, setPreviewSrc, isSelectingRef, setShowPicker]);

    const lastPreviewPathRef = useRef<string | null>(null);
    const handlePreview = useCallback(async (assetPath: string | null) => {
        lastPreviewPathRef.current = assetPath;
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
    }, [vaultPath, isSelectingRef, setPreviewSrc]);

    const handlePickerClose = useCallback(() => {
        setPreviewSrc(null);
        setShowPicker(false);
    }, [setPreviewSrc, setShowPicker]);

    // Resize Height Logic (Simplified from useCoverInteraction)
    const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const startY = e.clientY;
        const startH = coverHeight;

        let rafId: number;

        const onMove = (me: MouseEvent) => {
            if (rafId) cancelAnimationFrame(rafId);

            rafId = requestAnimationFrame(() => {
                const delta = me.clientY - startY;
                const newH = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, startH + delta));
                setCoverHeight(newH);
            });
        };

        const onUp = (me: MouseEvent) => {
            if (rafId) cancelAnimationFrame(rafId);
            const delta = me.clientY - startY;
            const newH = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, startH + delta));
            // Save final height
            // We assume Crop/Zoom didn't change, we use current Prop values?
            // Yes, resize height only changes height.
            onUpdate(url, positionX, positionY, newH, scale);

            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }, [coverHeight, onUpdate, url, positionX, positionY, scale]);


    // Return Render
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

    // If we have no displaySrc but url exists (e.g. loading or error), Show Placeholder
    // Actually displaySrc includes 'prevSrcRef' so it handles transitions.
    // If absolutely nothing, show error.

    return (
        <div
            className={cn("relative w-full bg-muted/20 shrink-0 select-none overflow-hidden group")}
            style={{ height: coverHeight }}
            ref={containerRef}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
        >
            {/* Static CSS Placeholder (Instant Load) */}
            {displaySrc && (
                <img
                    src={displaySrc}
                    alt="Cover"
                    className={cn(
                        "absolute inset-0 w-full h-full object-cover transition-opacity duration-300",
                        isImageReady ? "opacity-0 pointer-events-none" : "opacity-100 placeholder-active"
                    )}
                    style={{
                        objectPosition: `${positionX}% ${positionY}%`
                    }}
                />
            )}

            {/* Cropper Layer */}
            {displaySrc && (
                <div
                    className={cn("absolute inset-0 transition-opacity duration-300", isImageReady ? "opacity-100" : "opacity-0")}
                >
                    <Cropper
                        image={displaySrc}
                        crop={crop}
                        zoom={zoom}
                        cropSize={containerSize ?? undefined}
                        minZoom={effectiveMinZoom}
                        maxZoom={effectiveMaxZoom}
                        objectFit={objectFitMode}
                        restrictPosition={true}
                        showGrid={false}
                        onCropChange={onCropperCropChange}
                        onZoomChange={onCropperZoomChange}
                        onInteractionStart={handleInteractionStart}
                        onInteractionEnd={handleInteractionEnd}
                        onMediaLoaded={(media) => {
                            const dims = { width: media.naturalWidth, height: media.naturalHeight };
                            setMediaSize(dims);

                            // Pre-calculate crop to prevent "Center -> Position" flash
                            // We must ensure the first visible frame has the correct crop
                            if (containerSize) {
                                const pixels = calculateCropPixels(
                                    { x: positionX, y: positionY },
                                    dims,
                                    containerSize,
                                    zoom
                                );
                                setCrop(pixels);
                                setIsImageReady(true);
                            }
                        }}
                        style={cropperStyle}
                        mediaProps={mediaProps}
                    />
                </div>
            )}


            {/* Error State Overlay */}
            {isError && (
                <div
                    className={cn(
                        "absolute inset-0 flex flex-col items-center justify-center bg-muted/20 text-muted-foreground z-10",
                        !readOnly && "cursor-pointer hover:bg-muted/30 transition-colors"
                    )}
                    onMouseDown={() => !readOnly && setShowPicker(true)}
                >
                    <ImageOff className="w-8 h-8 mb-2 opacity-50" />
                    <span className="text-xs font-medium opacity-70">Image failed to load</span>
                    {!readOnly && <span className="text-[10px] opacity-50 mt-1">Click to replace</span>}
                </div>
            )}

            {/* ReadOnly Overlay / Picker Trigger */}
            {!displaySrc && !isError && (
                <div
                    className="absolute inset-0 flex items-center justify-center text-muted-foreground cursor-pointer z-10"
                    onMouseDown={() => !readOnly && setShowPicker(true)}
                >
                    {!readOnly && <span className="text-xs">Click to change cover</span>}
                </div>
            )}

            {/* ReadOnly blocker */}
            {readOnly && <div className="absolute inset-0 z-20" />}



            {/* Height Resize Handle */}
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
