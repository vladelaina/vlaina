import { useState, useRef, useEffect, MouseEvent } from 'react';
import { cn } from '@/lib/utils';
import { CoverPicker } from '../AssetLibrary';
import { loadImageAsBlob } from '@/lib/assets/imageLoader';

interface CoverImageProps {
    url: string | null;
    positionY: number;
    height?: number;
    readOnly?: boolean;
    onUpdate: (url: string | null, positionY: number, height?: number) => void;
    vaultPath: string;
}

const MIN_HEIGHT = 120;
const MAX_HEIGHT = 400;
const DEFAULT_HEIGHT = 200;

export function CoverImage({
    url,
    positionY,
    height,
    readOnly = false,
    onUpdate,
    vaultPath,
}: CoverImageProps) {
    const [dragY, setDragY] = useState(positionY);
    const [localPreview, setLocalPreview] = useState<string | null>(null);
    const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);
    const [showPicker, setShowPicker] = useState(false);
    const [coverHeight, setCoverHeight] = useState(height ?? DEFAULT_HEIGHT);

    const containerRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);
    
    // For image position dragging
    const startYRef = useRef<number>(0);
    const startPosRef = useRef<number>(0);
    const currentYRef = useRef<number>(positionY);
    const hasDraggedRef = useRef<boolean>(false);
    const DRAG_THRESHOLD = 5; // pixels to distinguish click from drag
    
    // For height resizing
    const startHeightRef = useRef<number>(0);
    const startResizeYRef = useRef<number>(0);
    const currentHeightRef = useRef<number>(height ?? DEFAULT_HEIGHT);

    // Sync state with props
    useEffect(() => {
        currentYRef.current = positionY;
        setDragY(positionY);
    }, [positionY]);

    // Sync height with props
    useEffect(() => {
        if (height !== undefined) {
            setCoverHeight(height);
            currentHeightRef.current = height;
        }
    }, [height]);

    // Clear local preview when url changes
    useEffect(() => {
        if (url) {
            setLocalPreview(null);
        }
    }, [url]);

    // Resolve local raw path to asset URL
    useEffect(() => {
        async function resolve() {
            if (!url) {
                setResolvedSrc(null);
                return;
            }

            try {
                if (url.startsWith('http')) {
                    setResolvedSrc(url);
                    return;
                }

                const separator = vaultPath.includes('\\') ? '\\' : '/';
                const assetsDir = `.nekotick${separator}assets${separator}covers`;
                const fullPath = `${vaultPath}${separator}${assetsDir}${separator}${url}`;

                const blobUrl = await loadImageAsBlob(fullPath);
                setResolvedSrc(blobUrl);
            } catch (e) {
                console.error('Failed to resolve asset URL', e);
                setResolvedSrc(null);
            }
        }
        resolve();
    }, [url, vaultPath]);

    // Image position dragging (click = open picker, drag = reposition)
    const handleImageMouseDown = (e: MouseEvent) => {
        if (readOnly) return;
        e.preventDefault();

        hasDraggedRef.current = false;
        startYRef.current = e.clientY;
        startPosRef.current = currentYRef.current;

        document.addEventListener('mousemove', handleImageMouseMove);
        document.addEventListener('mouseup', handleImageMouseUp);
    };

    const handleImageMouseMove = (e: globalThis.MouseEvent) => {
        if (!containerRef.current || !imgRef.current) return;
        e.preventDefault();

        const deltaY = e.clientY - startYRef.current;
        
        // Mark as dragged if moved beyond threshold
        if (Math.abs(deltaY) > DRAG_THRESHOLD) {
            hasDraggedRef.current = true;
            document.body.style.cursor = 'move';
        }

        if (!hasDraggedRef.current) return;

        const containerHeight = containerRef.current.clientHeight;
        const imgHeight = imgRef.current.naturalHeight * (imgRef.current.clientWidth / imgRef.current.naturalWidth);
        const scrollableRange = imgHeight - containerHeight;

        if (scrollableRange <= 0) return;

        const deltaPercentage = (deltaY / scrollableRange) * 100;

        let newY = startPosRef.current - deltaPercentage;
        newY = Math.max(0, Math.min(100, newY));

        currentYRef.current = newY;

        if (imgRef.current) {
            imgRef.current.style.objectPosition = `50% ${newY}%`;
        }
    };

    const handleImageMouseUp = () => {
        document.removeEventListener('mousemove', handleImageMouseMove);
        document.removeEventListener('mouseup', handleImageMouseUp);
        document.body.style.cursor = '';

        if (hasDraggedRef.current) {
            // Was a drag - save new position
            const newY = currentYRef.current;
            setDragY(newY);
            onUpdate(url, newY, coverHeight);
        } else {
            // Was a click - open picker
            setShowPicker(true);
        }
    };

    // Height resizing
    const handleResizeMouseDown = (e: MouseEvent) => {
        if (readOnly || !url) return;
        e.preventDefault();
        e.stopPropagation();

        startResizeYRef.current = e.clientY;
        startHeightRef.current = coverHeight;

        document.addEventListener('mousemove', handleResizeMouseMove);
        document.addEventListener('mouseup', handleResizeMouseUp);
    };

    const handleResizeMouseMove = (e: globalThis.MouseEvent) => {
        e.preventDefault();

        const deltaY = e.clientY - startResizeYRef.current;
        let newHeight = startHeightRef.current + deltaY;
        newHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, newHeight));

        currentHeightRef.current = newHeight;
        setCoverHeight(newHeight);
    };

    const handleResizeMouseUp = () => {
        document.removeEventListener('mousemove', handleResizeMouseMove);
        document.removeEventListener('mouseup', handleResizeMouseUp);

        // Save the new height using ref (avoids stale closure)
        onUpdate(url, dragY, currentHeightRef.current);
    };

    const handleCoverSelect = (assetPath: string) => {
        onUpdate(assetPath, 50, DEFAULT_HEIGHT);
        setShowPicker(false);
    };

    const handleCoverRemove = () => {
        onUpdate(null, 50);
    };

    // Default Atmospheric Header (Aurora) if no URL
    if (!url && !localPreview) {
        return (
            <>
                <div
                    className={cn(
                        "relative h-[120px] w-full shrink-0",
                        !readOnly && "cursor-pointer"
                    )}
                    onClick={() => !readOnly && setShowPicker(true)}
                >
                    {/* Aurora Atmosphere (Legacy/Default) */}
                    <div className="absolute inset-0 pointer-events-none z-0 opacity-60 dark:opacity-40 select-none overflow-hidden">
                        <div className="absolute top-[-40%] left-[-10%] w-[70%] h-[150%] rounded-full bg-[var(--neko-accent)] opacity-[0.08] blur-[80px]" />
                        <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[120%] rounded-full bg-purple-500 opacity-[0.05] blur-[80px]" />
                    </div>
                </div>

                <CoverPicker
                    isOpen={showPicker}
                    onClose={() => setShowPicker(false)}
                    onSelect={handleCoverSelect}
                    vaultPath={vaultPath}
                />
            </>
        );
    }

    // Active Cover
    const activeSrc = localPreview || resolvedSrc || '';
    const displayY = dragY;

    return (
        <>
            <div
                className="relative w-full bg-muted/20 shrink-0 select-none overflow-hidden"
                style={{ height: coverHeight }}
                ref={containerRef}
            >
                {activeSrc && (
                    <img
                        ref={imgRef}
                        src={activeSrc}
                        alt="Cover"
                        className={cn(
                            "absolute inset-0 w-full h-full object-cover",
                            !readOnly && "cursor-pointer"
                        )}
                        style={{ objectPosition: `50% ${displayY}%` }}
                        draggable={false}
                        onMouseDown={handleImageMouseDown}
                    />
                )}

                {/* Bottom edge resize handle */}
                {!readOnly && (
                    <div
                        className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize z-30"
                        onMouseDown={handleResizeMouseDown}
                    />
                )}
            </div>

            <CoverPicker
                isOpen={showPicker}
                onClose={() => setShowPicker(false)}
                onSelect={handleCoverSelect}
                onRemove={url ? handleCoverRemove : undefined}
                vaultPath={vaultPath}
            />
        </>
    );
}
