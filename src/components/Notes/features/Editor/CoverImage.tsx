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
}: CoverImageProps) {
    // Display state
    const [dragX, setDragX] = useState(positionX);
    const [dragY, setDragY] = useState(positionY);
    const [currentScale, setCurrentScale] = useState(scale);
    const [coverHeight, setCoverHeight] = useState(height ?? DEFAULT_HEIGHT);
    const [isAnimating, setIsAnimating] = useState(false);
    
    // Image sources
    const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);
    const [previewSrc, setPreviewSrc] = useState<string | null>(null);
    
    // Image ready state - prevents "jump" by hiding image until dimensions are available
    const [isImageReady, setIsImageReady] = useState(false);
    
    // UI state
    const [showPicker, setShowPicker] = useState(false);

    // Refs for DOM elements
    const containerRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);
    
    // Refs for current values (avoid stale closures)
    const currentXRef = useRef(positionX);
    const currentYRef = useRef(positionY);
    const currentScaleRef = useRef(scale);
    const currentHeightRef = useRef(height ?? DEFAULT_HEIGHT);
    
    // Refs for drag state
    const dragStartRef = useRef({ mouseX: 0, mouseY: 0, posX: 0, posY: 0, height: 0 });
    const hasDraggedRef = useRef(false);
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isSelectingRef = useRef(false);
    
    // Cache image dimensions to calculate position before img element is ready
    const cachedDimensionsRef = useRef<{ width: number; height: number } | null>(null);
    
    // Track previous src to show during transition
    const prevSrcRef = useRef<string | null>(null);
    
    // Track last resolved URL to avoid duplicate resolves
    const lastResolvedUrlRef = useRef<string | null>(null);
    
    // Track blob URLs for cleanup
    const blobUrlRef = useRef<string | null>(null);

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

    // Reset image ready state when url changes
    useEffect(() => {
        // 保存当前 src 作为过渡显示
        if (resolvedSrc) {
            prevSrcRef.current = resolvedSrc;
        }
        setIsImageReady(false);
        cachedDimensionsRef.current = null;
        lastResolvedUrlRef.current = null;
    }, [url]);

    // Resolve local path to blob URL with pre-loaded dimensions
    useEffect(() => {
        async function resolve() {
            // 避免重复解析相同的 URL
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
            let isNewBlobUrl = false;
            
            if (url.startsWith('http')) { 
                imageUrl = url;
            } else if (isBuiltinCover(url)) {
                imageUrl = getBuiltinCoverUrl(url);
            } else if (vaultPath) {
                try {
                    const fullPath = buildFullAssetPath(vaultPath, url);
                    imageUrl = await loadImageAsBlob(fullPath);
                    isNewBlobUrl = true;
                } catch {
                    // 文件不存在或加载失败，自动清除封面
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
            
            // 清理旧的 blob URL
            if (blobUrlRef.current) {
                URL.revokeObjectURL(blobUrlRef.current);
            }
            blobUrlRef.current = isNewBlobUrl ? imageUrl : null;
            
            setResolvedSrc(imageUrl);
            setPreviewSrc(null);
            isSelectingRef.current = false;
            lastResolvedUrlRef.current = url;
        }
        resolve();
    }, [url, vaultPath, onUpdate]);

    // Cleanup blob URL on unmount
    useEffect(() => {
        return () => {
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
            if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
        };
    }, []);

    // Debounced save helper - use ref to avoid dependency issues
    const debouncedSaveRef = useRef<(newScale?: number) => void>(() => {});
    
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
        
        currentXRef.current = newX;
        currentYRef.current = newY;
        setDragX(newX);
        setDragY(newY);
    }, []);

    const handleImageMouseUp = useCallback(() => {
        document.removeEventListener('mousemove', handleImageMouseMove);
        document.removeEventListener('mouseup', handleImageMouseUp);
        document.body.style.cursor = '';

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
        dragStartRef.current = { mouseX: e.clientX, mouseY: e.clientY, posX: currentXRef.current, posY: currentYRef.current, height: 0 };
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

    // Height resize handlers
    const handleResizeMouseMove = useCallback((e: globalThis.MouseEvent) => {
        e.preventDefault();
        const newHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, dragStartRef.current.height + e.clientY - dragStartRef.current.mouseY));
        currentHeightRef.current = newHeight;
        setCoverHeight(newHeight);
    }, []);

    const handleResizeMouseUp = useCallback(() => {
        document.removeEventListener('mousemove', handleResizeMouseMove);
        document.removeEventListener('mouseup', handleResizeMouseUp);
        onUpdate(url, dragX, dragY, currentHeightRef.current, currentScale);
    }, [url, dragX, dragY, currentScale, onUpdate, handleResizeMouseMove]);

    const handleResizeMouseDown = useCallback((e: MouseEvent) => {
        if (readOnly || !url) return;
        e.preventDefault();
        e.stopPropagation();
        dragStartRef.current.mouseY = e.clientY;
        dragStartRef.current.height = coverHeight;
        setIsAnimating(false);
        document.addEventListener('mousemove', handleResizeMouseMove);
        document.addEventListener('mouseup', handleResizeMouseUp);
    }, [readOnly, url, coverHeight, handleResizeMouseMove, handleResizeMouseUp]);

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
        const container = containerRef.current;
        // 使用 coverHeight state 而不是 container.clientHeight，确保切换笔记时高度正确
        const containerW = container?.clientWidth || 720;
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
        
        return {
            position: 'absolute',
            width, height,
            left: -(overflowX * dragX / 100),
            top: -(overflowY * dragY / 100),
            maxWidth: 'none',
            maxHeight: 'none',
        };
    }, [dragX, dragY, currentScale, coverHeight]);

    // Handle image load - mark as ready when dimensions are confirmed
    const handleImageLoad = useCallback(() => {
        if (imgRef.current?.naturalWidth) {
            setIsImageReady(true);
            prevSrcRef.current = null;
        }
    }, []);

    // 当 resolvedSrc 设置后，如果图片已经加载（preview 和 resolved 相同），手动标记为 ready
    useEffect(() => {
        if (!resolvedSrc || isImageReady) return;
        
        const img = imgRef.current;
        if (img?.complete && img?.naturalWidth) {
            setIsImageReady(true);
            prevSrcRef.current = null;
        }
    }, [resolvedSrc, isImageReady]);

    // No cover - show aurora background
    if (!url) {
        return (
            <div className="relative w-full">
                <div
                    className={cn("relative h-[120px] w-full shrink-0", !readOnly && "cursor-pointer")}
                    onClick={() => !readOnly && setShowPicker(true)}
                >
                    {previewSrc ? (
                        <img src={previewSrc} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                        <div className="absolute inset-0 pointer-events-none z-0 opacity-60 dark:opacity-40 select-none overflow-hidden">
                            <div className="absolute top-[-40%] left-[-10%] w-[70%] h-[150%] rounded-full bg-[var(--neko-accent)] opacity-[0.08] blur-[80px]" />
                            <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[120%] rounded-full bg-purple-500 opacity-[0.05] blur-[80px]" />
                        </div>
                    )}
                </div>
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
                className="relative w-full bg-muted/20 shrink-0 select-none overflow-hidden"
                style={{ height: coverHeight }}
                ref={containerRef}
            >
                {displaySrc && (
                    <img
                        ref={imgRef}
                        src={displaySrc}
                        alt="Cover"
                        className={cn(
                            !readOnly && "cursor-pointer",
                            isAnimating && "transition-all duration-150 ease-out"
                        )}
                        style={{
                            ...(previewSrc ? { width: '100%', height: '100%', objectFit: 'cover' } : imageStyle),
                            // 显示条件：预览 / 新图片准备好 / 有旧图片过渡
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
