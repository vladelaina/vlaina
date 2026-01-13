import { useState, useRef, useEffect, useCallback, MouseEvent } from 'react';
import { cn } from '@/lib/utils';
import { CoverPicker } from '../AssetLibrary';
import { loadImageAsBlob } from '@/lib/assets/imageLoader';

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

const MIN_HEIGHT = 120;
const MAX_HEIGHT = 400;
const DEFAULT_HEIGHT = 200;
const MIN_SCALE = 1;
const MAX_SCALE = 3;
const DRAG_THRESHOLD = 5;

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
    const [dragX, setDragX] = useState(positionX);
    const [dragY, setDragY] = useState(positionY);
    const [currentScale, setCurrentScale] = useState(scale);
    const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);
    const [previewSrc, setPreviewSrc] = useState<string | null>(null); // For hover preview
    const [showPicker, setShowPicker] = useState(false);
    const [coverHeight, setCoverHeight] = useState(height ?? DEFAULT_HEIGHT);
    const [isAnimating, setIsAnimating] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [, forceUpdate] = useState(0);

    const containerRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);
    const currentXRef = useRef(positionX);
    const currentYRef = useRef(positionY);
    const currentScaleRef = useRef(scale);
    const currentHeightRef = useRef(height ?? DEFAULT_HEIGHT);
    const dragStartRef = useRef({ mouseX: 0, mouseY: 0, posX: 0, posY: 0, height: 0 });
    const hasDraggedRef = useRef(false);
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    // Reset imageLoaded when url changes
    useEffect(() => { setImageLoaded(false); }, [url]);

    // Resolve local path to blob URL
    useEffect(() => {
        let blobUrl: string | null = null;
        
        async function resolve() {
            if (!url) { setResolvedSrc(null); return; }
            if (url.startsWith('http')) { setResolvedSrc(url); return; }

            try {
                const sep = vaultPath.includes('\\') ? '\\' : '/';
                const fullPath = `${vaultPath}${sep}.nekotick${sep}assets${sep}covers${sep}${url}`;
                blobUrl = await loadImageAsBlob(fullPath);
                setResolvedSrc(blobUrl);
            } catch {
                setResolvedSrc(null);
            }
        }
        resolve();
        
        return () => { if (blobUrl) URL.revokeObjectURL(blobUrl); };
    }, [url, vaultPath]);

    // Cleanup & window resize
    useEffect(() => {
        const onResize = () => forceUpdate(n => n + 1);
        window.addEventListener('resize', onResize);
        return () => {
            window.removeEventListener('resize', onResize);
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        };
    }, []);

    // Debounced save helper
    const debouncedSave = useCallback((newScale?: number) => {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
            onUpdate(url, currentXRef.current, currentYRef.current, currentHeightRef.current, newScale ?? currentScaleRef.current);
            setIsAnimating(false);
        }, 200);
    }, [url, onUpdate]);

    // Image drag handlers
    const handleImageMouseDown = (e: MouseEvent) => {
        if (readOnly) return;
        e.preventDefault();
        hasDraggedRef.current = false;
        dragStartRef.current = { mouseX: e.clientX, mouseY: e.clientY, posX: currentXRef.current, posY: currentYRef.current, height: 0 };
        document.addEventListener('mousemove', handleImageMouseMove);
        document.addEventListener('mouseup', handleImageMouseUp);
    };

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

    // Mouse wheel zoom
    useEffect(() => {
        const container = containerRef.current;
        if (!container || readOnly || !url) return;

        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            e.stopPropagation();

            const isFast = e.ctrlKey || e.metaKey;
            const step = isFast ? 0.15 : 0.03;
            const delta = -Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 100) / 100 * step;
            
            const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, currentScaleRef.current + delta));
            if (newScale === currentScaleRef.current) return;

            currentScaleRef.current = newScale;
            setCurrentScale(newScale);
            setIsAnimating(true);
            debouncedSave(newScale);
        };

        container.addEventListener('wheel', handleWheel, { passive: false });
        return () => container.removeEventListener('wheel', handleWheel);
    }, [readOnly, url, debouncedSave]);

    // Height resize handlers
    const handleResizeMouseDown = (e: MouseEvent) => {
        if (readOnly || !url) return;
        e.preventDefault();
        e.stopPropagation();
        dragStartRef.current.mouseY = e.clientY;
        dragStartRef.current.height = coverHeight;
        setIsAnimating(false);
        document.addEventListener('mousemove', handleResizeMouseMove);
        document.addEventListener('mouseup', handleResizeMouseUp);
    };

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

    const handleCoverSelect = (assetPath: string) => {
        setPreviewSrc(null);
        onUpdate(assetPath, 50, 50, DEFAULT_HEIGHT, 1);
        setShowPicker(false);
    };

    // Handle preview on hover
    const handlePreview = useCallback(async (assetPath: string | null) => {
        if (!assetPath) {
            setPreviewSrc(null);
            return;
        }
        try {
            const sep = vaultPath.includes('\\') ? '\\' : '/';
            const fullPath = `${vaultPath}${sep}.nekotick${sep}assets${sep}covers${sep}${assetPath}`;
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

    // Calculate image style
    const getImageStyle = (): React.CSSProperties => {
        const img = imgRef.current;
        const container = containerRef.current;
        
        if (!img || !container || !imageLoaded || !img.naturalWidth) {
            return { width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${dragX}% ${dragY}%` };
        }
        
        const { width, height, overflowX, overflowY } = calcImageDimensions(
            container.clientWidth, container.clientHeight,
            img.naturalWidth, img.naturalHeight,
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
    };

    // Display source: preview > resolved
    const displaySrc = previewSrc || resolvedSrc || '';

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
                        className={cn(!readOnly && "cursor-pointer", isAnimating && "transition-all duration-150 ease-out")}
                        style={previewSrc ? { width: '100%', height: '100%', objectFit: 'cover' } : getImageStyle()}
                        draggable={false}
                        onMouseDown={previewSrc ? undefined : handleImageMouseDown}
                        onLoad={() => setImageLoaded(true)}
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
