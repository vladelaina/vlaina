import { useState, useRef, useEffect, MouseEvent } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Image, X, Upload } from 'lucide-react';
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
    const [isResizing, setIsResizing] = useState(false);
    const [isRepositioning, setIsRepositioning] = useState(false);

    const containerRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);
    
    // For image position dragging
    const startYRef = useRef<number>(0);
    const startPosRef = useRef<number>(0);
    const currentYRef = useRef<number>(positionY);
    
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

    // Image position dragging
    const handleImageMouseDown = (e: MouseEvent) => {
        if (readOnly || !url) return;
        e.preventDefault();

        setIsRepositioning(true);
        startYRef.current = e.clientY;
        startPosRef.current = currentYRef.current;

        document.addEventListener('mousemove', handleImageMouseMove);
        document.addEventListener('mouseup', handleImageMouseUp);
        document.body.style.cursor = 'move';
    };

    const handleImageMouseMove = (e: globalThis.MouseEvent) => {
        if (!containerRef.current || !imgRef.current) return;
        e.preventDefault();

        const containerHeight = containerRef.current.clientHeight;
        const imgHeight = imgRef.current.naturalHeight * (imgRef.current.clientWidth / imgRef.current.naturalWidth);
        const scrollableRange = imgHeight - containerHeight;

        if (scrollableRange <= 0) return;

        const deltaY = e.clientY - startYRef.current;
        const deltaPercentage = (deltaY / scrollableRange) * 100;

        let newY = startPosRef.current - deltaPercentage;
        newY = Math.max(0, Math.min(100, newY));

        currentYRef.current = newY;

        if (imgRef.current) {
            imgRef.current.style.objectPosition = `50% ${newY}%`;
        }
    };

    const handleImageMouseUp = () => {
        setIsRepositioning(false);

        document.removeEventListener('mousemove', handleImageMouseMove);
        document.removeEventListener('mouseup', handleImageMouseUp);
        document.body.style.cursor = '';

        const newY = currentYRef.current;
        setDragY(newY);
        onUpdate(url, newY, coverHeight);
    };

    // Height resizing
    const handleResizeMouseDown = (e: MouseEvent) => {
        if (readOnly || !url) return;
        e.preventDefault();
        e.stopPropagation();

        setIsResizing(true);
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
        setIsResizing(false);

        document.removeEventListener('mousemove', handleResizeMouseMove);
        document.removeEventListener('mouseup', handleResizeMouseUp);

        // Save the new height using ref (avoids stale closure)
        onUpdate(url, dragY, currentHeightRef.current);
    };

    const handleCoverSelect = (assetPath: string) => {
        onUpdate(assetPath, 50, DEFAULT_HEIGHT);
        setShowPicker(false);
    };

    // Default Atmospheric Header (Aurora) if no URL
    if (!url && !localPreview) {
        return (
            <>
                <div className="group relative h-[120px] w-full shrink-0">
                    {/* Aurora Atmosphere (Legacy/Default) */}
                    <div className="absolute inset-0 pointer-events-none z-0 opacity-60 dark:opacity-40 select-none overflow-hidden">
                        <div className="absolute top-[-40%] left-[-10%] w-[70%] h-[150%] rounded-full bg-[var(--neko-accent)] opacity-[0.08] blur-[80px]" />
                        <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[120%] rounded-full bg-purple-500 opacity-[0.05] blur-[80px]" />
                    </div>

                    {/* Add Cover Button (Shows on Hover) */}
                    {!readOnly && (
                        <div className="absolute bottom-4 right-12 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowPicker(true)}
                                className="text-xs text-muted-foreground hover:bg-black/5 hover:text-foreground h-7"
                            >
                                <Image className="w-3.5 h-3.5 mr-1.5" />
                                Add cover
                            </Button>
                        </div>
                    )}
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
                className="group relative w-full bg-muted/20 shrink-0 select-none overflow-hidden"
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
                            !readOnly && "cursor-move"
                        )}
                        style={{ objectPosition: `50% ${displayY}%` }}
                        draggable={false}
                        onMouseDown={handleImageMouseDown}
                    />
                )}

                {/* Controls Overlay */}
                {!readOnly && (
                    <div className={cn(
                        "absolute bottom-4 right-12 transition-opacity duration-200 z-20 flex gap-2",
                        (isResizing || isRepositioning) ? "opacity-0" : "opacity-0 group-hover:opacity-100"
                    )}>
                        <Button
                            variant="secondary"
                            size="sm"
                            className="h-7 text-xs bg-white/50 backdrop-blur-md hover:bg-white/80 dark:bg-black/50 dark:hover:bg-black/70 shadow-sm border border-black/5"
                            onClick={() => setShowPicker(true)}
                        >
                            <Upload className="w-3.5 h-3.5 mr-1.5" /> Change
                        </Button>

                        <Button
                            variant="secondary"
                            size="sm"
                            className="h-7 w-7 p-0 bg-white/50 backdrop-blur-md hover:bg-white/80 dark:bg-black/50 dark:hover:bg-black/70 shadow-sm border border-black/5 text-muted-foreground hover:text-red-500"
                            onClick={() => onUpdate(null, 50)}
                        >
                            <X className="w-3.5 h-3.5" />
                        </Button>
                    </div>
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
                vaultPath={vaultPath}
            />
        </>
    );
}
