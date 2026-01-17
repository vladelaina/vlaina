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
    const wrapperRef = useRef<HTMLDivElement>(null); // New Wrapper for counter-transform
    const lastHeightProp = useRef(initialHeight);
    const isManualResizingRef = useRef(false); // Flag to bypass Observer

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
                    // Pixel Rounding: Avoid sub-pixel jitter
                    const roundedWidth = Math.round(width);
                    const roundedHeight = Math.round(height);

                    // SKIP update if manual resizing is active to prevent fighting
                    if (isManualResizingRef.current) return;

                    setContainerSize(prev => {
                        // Prevent loops if dimensions match
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
    // Track if we are currently resizing the container
    const [isResizing, setIsResizing] = useState(false);

    // FIX: Construct Effective Container Size
    // Use `coverHeight` (Source of Truth) for height to avoid ResizeObserver lag.
    // Use `containerSize.width` for width (reactive to window resize).
    const effectiveContainerSize = useMemo(() => {
        if (!containerSize) return null;
        return {
            width: containerSize.width,
            height: coverHeight
        };
    }, [containerSize, coverHeight]);


    // SNAPSHOT STATE: The absolute position of the image when drag started.
    // This allows us to render a completely static "Frozen Layer" that ignores container updates.
    const [frozenImageState, setFrozenImageState] = useState<{
        top: number;
        left: number;
        width: number;
        height: number;
    } | null>(null);
    const frozenImgRef = useRef<HTMLImageElement>(null); // For direct manipulation during pull-down

    // Determine objectFit mode for true "cover" behavior
    // If image aspect ratio > container aspect ratio: image is wider, so fill height (vertical-cover)
    // If image aspect ratio < container aspect ratio: image is taller, so fill width (horizontal-cover)
    const objectFitMode: 'contain' | 'horizontal-cover' | 'vertical-cover' = (() => {
        if (!mediaSize || !effectiveContainerSize) return 'horizontal-cover'; // Safe default
        const imageAspect = mediaSize.width / mediaSize.height;
        const containerAspect = effectiveContainerSize.width / effectiveContainerSize.height;

        // Hysteresis: If aspect ratios are very close, prefer horizontal-cover to prevent thrashing
        if (Math.abs(imageAspect - containerAspect) < 0.01) {
            return 'horizontal-cover';
        }

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

    // Flag to ignore prop sync when we have just manually updated the crop/height
    // and are waiting for props to catch up.
    const ignoreCropSyncRef = useRef(false);

    // Sync Crop Props
    useEffect(() => {
        if (isInteracting || isResizing || !mediaSize || !effectiveContainerSize) return;

        // SKIP Sync if we just manually committed a change
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

    }, [positionX, positionY, scale, mediaSize, effectiveContainerSize, isInteracting, isResizing, zoom]); // Use scale prop for sync

    // --- Interaction Handlers ---

    // --- Handlers for Cropper ---
    // --- Interaction Handlers ---

    // Track if actual modification occurred during interaction
    const dragOccurredRef = useRef(false);
    // Track if picker was open at start of interaction to prevent "Close -> Reopen" race
    const wasPickerOpenRef = useRef(false);

    // Helper to save changes to the database
    const saveToDb = useCallback((currentCrop: { x: number, y: number }, currentZoom: number) => {
        if (!mediaSize || !effectiveContainerSize) return;

        const percent = calculateCropPercentage(
            currentCrop,
            mediaSize,
            effectiveContainerSize,
            currentZoom
        );

        onUpdate(url, percent.x, percent.y, coverHeight, currentZoom);
    }, [mediaSize, effectiveContainerSize, url, coverHeight, onUpdate]);

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

        if (mediaSize && effectiveContainerSize) {
            const baseDims = getBaseDimensions(mediaSize, effectiveContainerSize);
            const scaledW = baseDims.width * zoom;
            const scaledH = baseDims.height * zoom;

            // Calculate max translation allowed (from center)
            const maxTranslateX = Math.max(0, (scaledW - effectiveContainerSize.width) / 2);
            const maxTranslateY = Math.max(0, (scaledH - effectiveContainerSize.height) / 2);

            // Clamp
            const clampedX = Math.max(-maxTranslateX, Math.min(maxTranslateX, newCrop.x));
            const clampedY = Math.max(-maxTranslateY, Math.min(maxTranslateY, newCrop.y));

            setCrop({ x: clampedX, y: clampedY });
        } else {
            setCrop(newCrop);
        }

        dragOccurredRef.current = true;
    }, [readOnly, mediaSize, effectiveContainerSize, zoom]);

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

    // Resize Height Logic - "Snapshot & Freeze" Strategy (Separate Layers)
    const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        // 1. SNAPSHOT: Calculate current absolute visual position
        // We need to know exactly where the image is NOW, relative to the container top-left.
        if (!mediaSize || !effectiveContainerSize) return;

        const baseDims = getBaseDimensions(mediaSize, effectiveContainerSize);
        const scaledW = baseDims.width * zoom;
        const scaledH = baseDims.height * zoom;

        // "Center" of the image relative to the container center
        // crop.x/y is the offset from the center.
        // Container Center is (W/2, H/2)
        // Image Center is (W/2 + crop.x, H/2 + crop.y)
        // Top Left is (Image Center X - ImgW/2, Image Center Y - ImgH/2)

        // Let's derive Top/Left relative to Container (0,0)
        // Container Center Y = containerSize.height / 2
        // Image Top relative to Center Y = crop.y - (scaledH / 2)
        // Absolute Top = (containerSize.height / 2) + crop.y - (scaledH / 2)

        const absoluteTop = (effectiveContainerSize.height / 2) + crop.y - (scaledH / 2);
        const absoluteLeft = (effectiveContainerSize.width / 2) + crop.x - (scaledW / 2);

        setFrozenImageState({
            top: absoluteTop,
            left: absoluteLeft,
            width: scaledW,
            height: scaledH
        });

        setIsResizing(true);
        isManualResizingRef.current = true; // Block Observer updates

        const startY = e.clientY;
        const startH = coverHeight;

        // LIMIT VALUES (Snapshot)
        const snapTop = absoluteTop; // Usually negative
        const snapHeight = scaledH;

        // 1. Where does the image end visibly?
        const maxVisualH_NoShift = snapTop + snapHeight;

        // 2. How much can we shift down? (Until Top hits 0)
        // Ensure non-negative to handle data anomalies
        const maxShiftDown = Math.max(0, -snapTop);

        // 3. Absolute Maximum Container Height allowed by the mechanics
        // = Bottom of image + Max Shift
        const absMaxMechHeight = maxVisualH_NoShift + maxShiftDown;

        // Optimize: Disable transitions for instant response
        if (containerRef.current) containerRef.current.style.transition = 'none';

        let rafId: number;

        const onMove = (me: MouseEvent) => {
            if (rafId) cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => {
                const delta = me.clientY - startY;
                const rawH = startH + delta;

                // LOGIC: Calculate Height FIRST, then Derive Shift

                // 1. Apply Constraints to Height
                // - Min: MIN_HEIGHT
                // - Max: Global MAX_HEIGHT
                // - Mech Max: The physical limit of the image (absMaxMechHeight)
                const limitH = Math.min(MAX_HEIGHT, absMaxMechHeight);
                const effectiveH = Math.max(MIN_HEIGHT, Math.min(limitH, rawH));

                // 2. Derive Shift
                // If effectiveH > maxVisualH_NoShift, we MUST have pulled down
                let shiftY = 0;
                if (effectiveH > maxVisualH_NoShift) {
                    shiftY = effectiveH - maxVisualH_NoShift;
                }

                // Strict Clamp (No Elastic Pull)
                shiftY = Math.max(0, Math.min(shiftY, maxShiftDown));

                // DOM UPDATE 1: Container Height
                if (containerRef.current) {
                    containerRef.current.style.height = `${effectiveH}px`;
                }

                // DOM UPDATE 2: Image Position (Pull Effect)
                if (frozenImgRef.current) {
                    frozenImgRef.current.style.top = `${snapTop + shiftY}px`;
                }
            });
        };

        const onUp = (me: MouseEvent) => {
            if (rafId) cancelAnimationFrame(rafId);
            const delta = me.clientY - startY;

            // RE-RUN LOGIC for consistency
            const rawH = startH + delta;

            // 1. Calculate Height
            const limitH = Math.min(MAX_HEIGHT, absMaxMechHeight);
            const effectiveH = Math.max(MIN_HEIGHT, Math.min(limitH, rawH));

            // 2. Derive Shift (Sync with MouseMove logic)
            // If user pulled down (rawH > limitH), we want to use that 'pull' 
            // to influence the crop (favoring Top alignment).
            let shiftY = 0;
            const isPullingDown = rawH > startH && (rawH > limitH || startH === limitH);

            if (isPullingDown && rawH > limitH) {
                // Elastic Pull Shift
                shiftY = rawH - effectiveH;
            } else if (effectiveH > maxVisualH_NoShift) {
                // Natural Shift (if container exceeds image, shouldn't happen with cover)
                shiftY = effectiveH - maxVisualH_NoShift;
            }

            // Clamp Shift
            shiftY = Math.max(0, Math.min(shiftY, maxShiftDown));



            // 3. RECONCILE
            // Mobile (Frozen) Top = snapTop + shiftY.
            // Image Top relative to Center = crop.y - (scaledH / 2)
            // Absolute Top = CenterY + ImageTopRel
            //              = (effectiveH / 2) + crop.y - (scaledH / 2)
            // We want Absolute Top to equal (snapTop + shiftY)
            // (snapTop + shiftY) = (effectiveH / 2) + newCropY - (scaledH / 2)
            // newCropY = (snapTop + shiftY) - (effectiveH / 2) + (scaledH / 2)

            const finalImageTop = snapTop + shiftY;
            const newCropY = finalImageTop - (effectiveH / 2) + (scaledH / 2);
            const newCropX = absoluteLeft - (effectiveContainerSize.width / 2) + (scaledW / 2);

            // Clamp to Valid Bounds (Snap Back Effect)
            // We allowed elastic pull (overflow) during drag, but on release we must snap to valid edge.
            const maxAbsY = (scaledH - effectiveH) / 2;
            const maxAbsX = (scaledW - effectiveContainerSize.width) / 2;

            // NaN Safety + Clamping
            const safeCropX = isNaN(newCropX) ? 0 : Math.max(-maxAbsX, Math.min(maxAbsX, newCropX));
            const safeCropY = isNaN(newCropY) ? 0 : Math.max(-maxAbsY, Math.min(maxAbsY, newCropY));

            const finalCrop = { x: safeCropX, y: safeCropY };



            // Unlock
            setIsResizing(false);
            setFrozenImageState(null);

            // Allow Observer to take over after a small delay to prevent fighting
            setTimeout(() => {
                isManualResizingRef.current = false;
            }, 50);


            // Clean DOM
            if (containerRef.current) {

                containerRef.current.style.transition = '';
            }

            // Commit State
            ignoreCropSyncRef.current = true;
            setCoverHeight(effectiveH);
            setCrop(finalCrop);

            // Save to DB
            // Use effectiveH as height, width might be same
            const currentW = effectiveContainerSize?.width || 0;
            const tempContainerSize = { width: currentW, height: effectiveH };

            if (currentW > 0) {
                const percent = calculateCropPercentage(
                    finalCrop,
                    mediaSize,
                    tempContainerSize,
                    zoom
                );
                // Ensure percent is finite
                const safePctX = Number.isFinite(percent.x) ? percent.x : 50;
                const safePctY = Number.isFinite(percent.y) ? percent.y : 50;


                onUpdate(url, safePctX, safePctY, effectiveH, scale);
            } else {
                onUpdate(url, positionX, positionY, effectiveH, scale);
            }

            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);

        // Store cleanup
        resizeCleanupRef.current = () => {
            if (rafId) cancelAnimationFrame(rafId);
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            setIsResizing(false);
            setFrozenImageState(null);
            isManualResizingRef.current = false;
        };
    }, [coverHeight, crop, effectiveContainerSize, mediaSize, zoom, onUpdate, url, positionX, positionY, scale]);

    // Safety: Cleanup resize listeners on unmount
    const resizeCleanupRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        return () => {
            if (resizeCleanupRef.current) {
                resizeCleanupRef.current();
            }
        };
    }, []);


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

            {/* Cropper Layer (Standard Mode) - Only show when NOT resizing */}
            {displaySrc && !isResizing && (
                <div
                    ref={wrapperRef}
                    className={cn("absolute inset-0 transition-opacity duration-300", isImageReady ? "opacity-100" : "opacity-0")}
                    style={{ willChange: 'transform' }}
                >
                    <Cropper
                        image={displaySrc}
                        crop={crop}
                        zoom={zoom}
                        cropSize={effectiveContainerSize ?? undefined}
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
                            // FIX: Only set crop if this is the FIRST load (image not ready).
                            // If image is already ready, it means we have valid local state (e.g. after manual resize),
                            // so we should NOT overwrite it with stale props.
                            if (effectiveContainerSize && !isImageReady) {
                                const pixels = calculateCropPixels(
                                    { x: positionX, y: positionY },
                                    dims,
                                    effectiveContainerSize,
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

            {/* FROZEN LAYER (Resize Mode) - Separate Independent Layer */}
            {isResizing && frozenImageState && displaySrc && (
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    <img
                        ref={frozenImgRef}
                        src={displaySrc}
                        alt="Frozen Cover"
                        style={{
                            position: 'absolute',
                            top: frozenImageState.top,
                            left: frozenImageState.left,
                            width: frozenImageState.width,
                            height: frozenImageState.height,
                            maxWidth: 'none',
                            maxHeight: 'none',
                            objectFit: 'fill'
                        }}
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
