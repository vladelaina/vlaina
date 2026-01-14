import { useState, useRef, useEffect, useCallback, useMemo, MouseEvent } from 'react';
import { cn } from '@/lib/utils';
import { CoverPicker } from '../AssetLibrary';
import { loadImageAsBlob } from '@/lib/assets/imageLoader';
import { buildFullAssetPath } from '@/lib/assets/pathUtils';
import { isBuiltinCover, getBuiltinCoverUrl } from '@/lib/assets/builtinCovers';

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

// Constants
const MIN_HEIGHT = 120;
const MAX_HEIGHT = 400;
const DEFAULT_HEIGHT = 200;
const MIN_SCALE = 1;
const MAX_SCALE = 3;
const DRAG_THRESHOLD = 5;
const SAVE_DEBOUNCE_MS = 200;

// Calculate image dimensions for cover-fit display
function calcImageDimensions(
    containerW: number,
    containerH: number,
    imgW: number,
    imgH: number,
    scale: number
) {
    const containerRatio = containerW / containerH;
    const imgRatio = imgW / imgH;

    let baseW: number, baseH: number;
    if (imgRatio > containerRatio) {
        baseH = containerH;
        baseW = containerH * imgRatio;
    } else {
        baseW = containerW;
        baseH = containerW / imgRatio;
    }

    return {
        width: baseW * scale,
        height: baseH * scale,
        overflowX: baseW * scale - containerW,
        overflowY: baseH * scale - containerH,
    };
}

// Load image and get its natural dimensions
async function loadImageWithDimensions(src: string): Promise<{ width: number; height: number } | null> {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => resolve(null);
        img.src = src;
    });
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
    // Display state
    const [dragX, setDragX] = useState(positionX);
    const [dragY, setDragY] = useState(positionY);
    const [currentScale, setCurrentScale] = useState(scale);
    const [coverHeight, setCoverHeight] = useState(height ?? DEFAULT_HEIGHT);
    const [isAnimating, setIsAnimating] = useState(false);
    const [containerWidth, setContainerWidth] = useState(720);
    const [isResizingHeight, setIsResizingHeight] = useState(false);

    // Image sources
    const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);
    const [previewSrc, setPreviewSrc] = useState<string | null>(null);

    // Image ready state - prevents "jump" by hiding image until dimensions are available
    const [isImageReady, setIsImageReady] = useState(false);

    // UI state - use external control if provided
    const [internalShowPicker, setInternalShowPicker] = useState(false);
    const showPicker = pickerOpen ?? internalShowPicker;
    const setShowPicker = useCallback((open: boolean) => {
        if (onPickerOpenChange) {
            onPickerOpenChange(open);
        } else {
            setInternalShowPicker(open);
        }
    }, [onPickerOpenChange]);

    // Refs for DOM elements
    const containerRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);

    // Refs for current values (avoid stale closures)
    const currentXRef = useRef(positionX);
    const currentYRef = useRef(positionY);
    const currentScaleRef = useRef(scale);
    const currentHeightRef = useRef(height ?? DEFAULT_HEIGHT);

    // Refs for drag state
    const dragStartRef = useRef({ mouseX: 0, mouseY: 0, posX: 0, posY: 0, height: 0, pixelOffsetY: 0 });
    const hasDraggedRef = useRef(false);
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isSelectingRef = useRef(false);

    // Cache image dimensions to calculate position before img element is ready
    const cachedDimensionsRef = useRef<{ width: number; height: number } | null>(null);

    // Track previous src to show during transition
    const prevSrcRef = useRef<string | null>(null);

    // Track last resolved URL to avoid duplicate resolves
    const lastResolvedUrlRef = useRef<string | null>(null);

    // ResizeObserver to track container width changes (for sidebar toggle)
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                if (entry.contentRect.width > 0) {
                    setContainerWidth(entry.contentRect.width);
                }
            }
        });

        resizeObserver.observe(container);
        return () => resizeObserver.disconnect();
    }, []);

    // Sync props to state/refs
    useEffect(() => {
        currentXRef.current = positionX;
        currentYRef.current = positionY;
        currentScaleRef.current = scale;
        setDragX(positionX);
        setDragY(positionY);
        setCurrentScale(scale);
        if (height !== undefined) {
            setCoverHeight(height);
            currentHeightRef.current = height;
        }
    }, [positionX, positionY, scale, height]);

    // Track previous url to detect "add new" vs "switch" scenarios
    const prevUrlRef = useRef<string | null>(null);

    // Reset image ready state when url changes
    useEffect(() => {
        // Only save old src for transition when "switching cover"
        // If going from no cover to having a cover (new addition), don't save old src to avoid flashing the previously removed cover
        if (prevUrlRef.current && resolvedSrc) {
            prevSrcRef.current = resolvedSrc;
        } else {
            // Adding new cover or removing cover, clear transition src
            prevSrcRef.current = null;
        }

        prevUrlRef.current = url;
        setIsImageReady(false);
        cachedDimensionsRef.current = null;
        lastResolvedUrlRef.current = null;
    }, [url]);

    // Resolve local path to blob URL with pre-loaded dimensions
    useEffect(() => {
        async function resolve() {
            // Avoid duplicate resolution of the same URL
            if (url === lastResolvedUrlRef.current && resolvedSrc) {
                return;
            }

            if (!url) {
                setResolvedSrc(null);
                setPreviewSrc(null);
                isSelectingRef.current = false;
                return;
            }

            let imageUrl: string;

            if (url.startsWith('http')) {
                imageUrl = url;
            } else if (isBuiltinCover(url)) {
                imageUrl = getBuiltinCoverUrl(url);
            } else if (vaultPath) {
                try {
                    const fullPath = buildFullAssetPath(vaultPath, url);
                    imageUrl = await loadImageAsBlob(fullPath);
                } catch {
                    // File doesn't exist or failed to load, automatically clear cover
                    setResolvedSrc(null);
                    setPreviewSrc(null);
                    isSelectingRef.current = false;
                    onUpdate(null, 50, 50);
                    return;
                }
            } else {
                return;
            }

            // Pre-load image to get dimensions before rendering
            const dimensions = await loadImageWithDimensions(imageUrl);
            if (dimensions) {
                cachedDimensionsRef.current = dimensions;
            }

            // Note: We don't revoke blob URLs here because loadImageAsBlob caches them globally
            // The cache manages the lifecycle of blob URLs

            setResolvedSrc(imageUrl);
            setPreviewSrc(null);
            isSelectingRef.current = false;
            lastResolvedUrlRef.current = url;
        }
        resolve();
    }, [url, vaultPath, onUpdate]);

    // Cleanup on unmount - only clear timeouts, not blob URLs (managed by cache)
    useEffect(() => {
        return () => {
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
            // Note: We don't revoke blob URLs here because loadImageAsBlob caches them globally
        };
    }, []);

    // Debounced save helper - use ref to avoid dependency issues
    const debouncedSaveRef = useRef<(newScale?: number) => void>(() => { });

    useEffect(() => {
        debouncedSaveRef.current = (newScale?: number) => {
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
            saveTimeoutRef.current = setTimeout(() => {
                onUpdate(url, currentXRef.current, currentYRef.current, currentHeightRef.current, newScale ?? currentScaleRef.current);
                setIsAnimating(false);
            }, SAVE_DEBOUNCE_MS);
        };
    }, [url, onUpdate]);

    // Image drag handlers
    // Image drag state refs
    const imageRafRef = useRef<number | null>(null);
    const pendingDragPos = useRef<{ x: number; y: number } | null>(null);

    const handleImageMouseMove = useCallback((e: globalThis.MouseEvent) => {
        const container = containerRef.current;
        const img = imgRef.current;
        if (!container || !img?.naturalWidth) return;
        e.preventDefault();

        const deltaX = e.clientX - dragStartRef.current.mouseX;
        const deltaY = e.clientY - dragStartRef.current.mouseY;

        if (!hasDraggedRef.current && (Math.abs(deltaX) > DRAG_THRESHOLD || Math.abs(deltaY) > DRAG_THRESHOLD)) {
            hasDraggedRef.current = true;
            setIsAnimating(false);
            document.body.style.cursor = 'move';
        }
        if (!hasDraggedRef.current) return;

        const { overflowX, overflowY } = calcImageDimensions(
            container.clientWidth, container.clientHeight,
            img.naturalWidth, img.naturalHeight,
            currentScaleRef.current
        );

        const newX = overflowX > 0
            ? Math.max(0, Math.min(100, dragStartRef.current.posX - (deltaX / overflowX) * 100))
            : 50;
        const newY = overflowY > 0
            ? Math.max(0, Math.min(100, dragStartRef.current.posY - (deltaY / overflowY) * 100))
            : 50;

        // Store pending position and schedule update with rAF for smooth 60fps
        pendingDragPos.current = { x: newX, y: newY };

        if (imageRafRef.current === null) {
            imageRafRef.current = requestAnimationFrame(() => {
                if (pendingDragPos.current !== null) {
                    currentXRef.current = pendingDragPos.current.x;
                    currentYRef.current = pendingDragPos.current.y;
                    setDragX(pendingDragPos.current.x);
                    setDragY(pendingDragPos.current.y);
                    pendingDragPos.current = null;
                }
                imageRafRef.current = null;
            });
        }
    }, []);

    const handleImageMouseUp = useCallback(() => {
        document.removeEventListener('mousemove', handleImageMouseMove);
        document.removeEventListener('mouseup', handleImageMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';

        // Apply any pending position immediately
        if (pendingDragPos.current !== null) {
            currentXRef.current = pendingDragPos.current.x;
            currentYRef.current = pendingDragPos.current.y;
            setDragX(pendingDragPos.current.x);
            setDragY(pendingDragPos.current.y);
            pendingDragPos.current = null;
        }

        // Cancel any pending rAF
        if (imageRafRef.current !== null) {
            cancelAnimationFrame(imageRafRef.current);
            imageRafRef.current = null;
        }

        if (hasDraggedRef.current) {
            onUpdate(url, currentXRef.current, currentYRef.current, coverHeight, currentScaleRef.current);
        } else {
            setShowPicker(true);
        }
    }, [url, coverHeight, onUpdate, handleImageMouseMove]);

    const handleImageMouseDown = useCallback((e: MouseEvent) => {
        if (readOnly) return;
        e.preventDefault();
        hasDraggedRef.current = false;
        dragStartRef.current = { mouseX: e.clientX, mouseY: e.clientY, posX: currentXRef.current, posY: currentYRef.current, height: 0, pixelOffsetY: 0 };

        // Prevent text selection during drag
        document.body.style.userSelect = 'none';

        document.addEventListener('mousemove', handleImageMouseMove);
        document.addEventListener('mouseup', handleImageMouseUp);
    }, [readOnly, handleImageMouseMove, handleImageMouseUp]);

    // Mouse wheel zoom
    useEffect(() => {
        const container = containerRef.current;
        if (!container || readOnly || !url) return;

        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            e.stopPropagation();

            const img = imgRef.current;
            if (!img?.naturalWidth) return;

            const isFast = e.ctrlKey || e.metaKey;
            const step = isFast ? 0.15 : 0.03;
            const delta = -Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 100) / 100 * step;

            const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, currentScaleRef.current + delta));
            if (newScale === currentScaleRef.current) return;

            currentScaleRef.current = newScale;
            setCurrentScale(newScale);
            setIsAnimating(true);
            debouncedSaveRef.current(newScale);
        };

        container.addEventListener('wheel', handleWheel, { passive: false });
        return () => container.removeEventListener('wheel', handleWheel);
    }, [readOnly, url]);

    // Height resize state refs
    const resizeRafRef = useRef<number | null>(null);
    const pendingHeight = useRef<number | null>(null);

    // Height resize handlers
    const handleResizeMouseMove = useCallback((e: globalThis.MouseEvent) => {
        e.preventDefault();
        const newHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, dragStartRef.current.height + e.clientY - dragStartRef.current.mouseY));

        // Store pending height and schedule update with rAF for smooth 60fps
        pendingHeight.current = newHeight;

        if (resizeRafRef.current === null) {
            resizeRafRef.current = requestAnimationFrame(() => {
                if (pendingHeight.current !== null) {
                    currentHeightRef.current = pendingHeight.current;
                    setCoverHeight(pendingHeight.current);
                    pendingHeight.current = null;
                }
                resizeRafRef.current = null;
            });
        }
    }, []);

    const handleResizeMouseUp = useCallback(() => {
        document.removeEventListener('mousemove', handleResizeMouseMove);
        document.removeEventListener('mouseup', handleResizeMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';

        // Apply any pending height immediately
        if (pendingHeight.current !== null) {
            currentHeightRef.current = pendingHeight.current;
            setCoverHeight(pendingHeight.current);
            pendingHeight.current = null;
        }

        // Cancel any pending rAF
        if (resizeRafRef.current !== null) {
            cancelAnimationFrame(resizeRafRef.current);
            resizeRafRef.current = null;
        }

        // Recalculate dragY based on new height and preserved pixel offset
        const img = imgRef.current;
        const container = containerRef.current;
        if (img?.naturalWidth && container) {
            const { overflowY } = calcImageDimensions(
                container.clientWidth, currentHeightRef.current,
                img.naturalWidth, img.naturalHeight,
                currentScaleRef.current
            );
            // Convert preserved pixel offset back to percentage
            const newDragY = overflowY > 0 ? Math.max(0, Math.min(100, (dragStartRef.current.pixelOffsetY / overflowY) * 100)) : 50;
            setDragY(newDragY);
            currentYRef.current = newDragY;
            onUpdate(url, dragX, newDragY, currentHeightRef.current, currentScale);
        } else {
            onUpdate(url, dragX, dragY, currentHeightRef.current, currentScale);
        }

        setIsResizingHeight(false);
    }, [url, dragX, dragY, currentScale, onUpdate, handleResizeMouseMove]);

    const handleResizeMouseDown = useCallback((e: MouseEvent) => {
        if (readOnly || !url) return;
        e.preventDefault();
        e.stopPropagation();

        // Calculate and store current pixel offset
        const img = imgRef.current;
        const container = containerRef.current;
        if (img?.naturalWidth && container) {
            const { overflowY } = calcImageDimensions(
                container.clientWidth, coverHeight,
                img.naturalWidth, img.naturalHeight,
                currentScaleRef.current
            );
            dragStartRef.current.pixelOffsetY = overflowY * dragY / 100;
        } else {
            dragStartRef.current.pixelOffsetY = 0;
        }

        dragStartRef.current.mouseY = e.clientY;
        dragStartRef.current.height = coverHeight;
        setIsAnimating(false);
        setIsResizingHeight(true);

        // Prevent text selection and set cursor
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'ns-resize';

        document.addEventListener('mousemove', handleResizeMouseMove);
        document.addEventListener('mouseup', handleResizeMouseUp);
    }, [readOnly, url, coverHeight, dragY, handleResizeMouseMove, handleResizeMouseUp]);

    // Cover selection handler
    const handleCoverSelect = useCallback(async (assetPath: string) => {
        isSelectingRef.current = true;

        const container = containerRef.current;
        const containerWidth = container?.clientWidth || 720;

        try {
            // Get image URL based on type
            let imageUrl: string;
            if (isBuiltinCover(assetPath)) {
                imageUrl = getBuiltinCoverUrl(assetPath);
            } else {
                const fullPath = buildFullAssetPath(vaultPath, assetPath);
                imageUrl = await loadImageAsBlob(fullPath);
            }

            const dimensions = await loadImageWithDimensions(imageUrl);

            if (dimensions) {
                const imgRatio = dimensions.width / dimensions.height;
                const minHeightForCover = Math.ceil(containerWidth / imgRatio);
                const finalHeight = coverHeight <= minHeightForCover && coverHeight <= MAX_HEIGHT
                    ? coverHeight
                    : Math.min(minHeightForCover, MAX_HEIGHT);

                onUpdate(assetPath, 50, 50, Math.max(finalHeight, MIN_HEIGHT), 1);
            } else {
                onUpdate(assetPath, 50, 50, coverHeight, 1);
            }
        } catch {
            onUpdate(assetPath, 50, 50, coverHeight, 1);
        }

        setShowPicker(false);
    }, [vaultPath, coverHeight, onUpdate]);

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
            // loadImageAsBlob has internal caching, no need to manage blob URLs here
            const blobUrl = await loadImageAsBlob(fullPath);
            setPreviewSrc(blobUrl);
        } catch {
            setPreviewSrc(null);
        }
    }, [vaultPath]);

    const handlePickerClose = useCallback(() => {
        setPreviewSrc(null);
        setShowPicker(false);
    }, []);

    // Calculate image style - use cached dimensions if img element not ready yet
    const imageStyle = useMemo((): React.CSSProperties => {
        // Use containerWidth state for responsive resizing
        const containerW = containerWidth;
        const containerH = coverHeight;

        // Use img element dimensions if available, otherwise use cached dimensions
        const imgW = imgRef.current?.naturalWidth || cachedDimensionsRef.current?.width;
        const imgH = imgRef.current?.naturalHeight || cachedDimensionsRef.current?.height;

        if (!imgW || !imgH) {
            return { width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${dragX}% ${dragY}%` };
        }

        const { width, height, overflowX, overflowY } = calcImageDimensions(
            containerW, containerH,
            imgW, imgH,
            currentScale
        );

        // During height resize, use fixed pixel offset to prevent visual jumping
        const topOffset = isResizingHeight && dragStartRef.current.pixelOffsetY > 0
            ? -dragStartRef.current.pixelOffsetY
            : -(overflowY * dragY / 100);

        return {
            position: 'absolute',
            width, height,
            left: -(overflowX * dragX / 100),
            top: topOffset,
            maxWidth: 'none',
            maxHeight: 'none',
        };
    }, [dragX, dragY, currentScale, coverHeight, containerWidth, isResizingHeight]);

    // Handle image load - mark as ready when dimensions are confirmed
    const handleImageLoad = useCallback(() => {
        if (imgRef.current?.naturalWidth) {
            setIsImageReady(true);
            prevSrcRef.current = null;
        }
    }, []);

    // When resolvedSrc is set, if image is already loaded (preview and resolved are the same), manually mark as ready
    useEffect(() => {
        if (!resolvedSrc || isImageReady) return;

        const img = imgRef.current;
        if (img?.complete && img?.naturalWidth) {
            setIsImageReady(true);
            prevSrcRef.current = null;
        }
    }, [resolvedSrc, isImageReady]);

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
                            ...(previewSrc ? { width: '100%', height: '100%', objectFit: 'cover' } : imageStyle),
                            // GPU acceleration hint during resize/drag
                            willChange: isResizingHeight ? 'width, height, top' : 'auto',
                            // Display condition: preview / new image ready / has old image for transition
                            opacity: previewSrc || isImageReady || prevSrcRef.current ? 1 : 0,
                        }}
                        draggable={false}
                        onMouseDown={previewSrc ? undefined : handleImageMouseDown}
                        onLoad={handleImageLoad}
                    />
                )}
                {!readOnly && !showPicker && (
                    <div className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize z-30" onMouseDown={handleResizeMouseDown} />
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
