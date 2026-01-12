import { useState, useRef, useEffect, MouseEvent } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Image, X, Upload } from 'lucide-react';
import { convertFileSrc } from '@tauri-apps/api/core';

interface CoverImageProps {
    url: string | null;
    positionY: number;
    readOnly?: boolean;
    onUpdate: (url: string | null, positionY: number) => void;
    onUpload: (file: File) => Promise<void>;
    vaultPath: string;
}

export function CoverImage({
    url,
    positionY,
    readOnly = false,
    onUpdate,
    onUpload,
    vaultPath,
}: CoverImageProps) {
    const [dragY, setDragY] = useState(positionY);
    const [localPreview, setLocalPreview] = useState<string | null>(null);
    const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);

    const containerRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);
    const startYRef = useRef<number>(0);
    const startPosRef = useRef<number>(0);
    const currentYRef = useRef<number>(positionY);
    const isDraggingRef = useRef<boolean>(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Sync state with props
    useEffect(() => {
        currentYRef.current = positionY;
        setDragY(positionY);
    }, [positionY]);

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

                // It's a relative path like .nekotick/cover.jpg
                // We need the full absolute path to use convertFileSrc
                // Construct absolute path: vaultPath + / + url
                const separator = vaultPath.includes('\\') ? '\\' : '/';
                const cleanUrl = url.replace(/\//g, separator);
                const fullPath = `${vaultPath}${separator}${cleanUrl}`;

                const assetUrl = convertFileSrc(fullPath);
                setResolvedSrc(assetUrl);
            } catch (e) {
                console.error('Failed to resolve asset URL', e);
                setResolvedSrc(null);
            }
        }
        resolve();
    }, [url, vaultPath]);

    const handleMouseDown = (e: MouseEvent) => {
        if (readOnly || !url) return;
        e.preventDefault();

        isDraggingRef.current = true;
        startYRef.current = e.clientY;
        startPosRef.current = currentYRef.current;

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        document.body.style.cursor = 'move';
    };

    const handleMouseMove = (e: globalThis.MouseEvent) => {
        if (!containerRef.current || !imgRef.current || !isDraggingRef.current) return;
        e.preventDefault();

        const containerHeight = containerRef.current.clientHeight;
        const imgHeight = imgRef.current.naturalHeight * (imgRef.current.clientWidth / imgRef.current.naturalWidth);
        const scrollableRange = imgHeight - containerHeight;

        // If image is smaller than container, no drag needed (or it's clamped)
        if (scrollableRange <= 0) return;

        const deltaY = e.clientY - startYRef.current;

        // Calculate percentage change required to move image by deltaY pixels
        // Formula derived from how object-position works:
        // Position P% means: align point P% of image with point P% of container.
        // Screen Pixel Shift = (P_new - P_old)/100 * (ImageHeight - ContainerHeight)
        // So: Change_in_P = (Pixel_Shift / (ImageHeight - ContainerHeight)) * 100

        const deltaPercentage = (deltaY / scrollableRange) * 100;

        // Note: Dragging down (positive deltaY) should move image down (view moves up), 
        // which corresponds to DECREASING the percentage (showing top of image).
        // Wait, 0% = Top of image. 100% = Bottom of image.
        // If I drag mouse DOWN (+Y), I want to see the TOP of the image (pulling it down).
        // So the image should move DOWN.

        let newY = startPosRef.current - deltaPercentage;

        // Clamp
        newY = Math.max(0, Math.min(100, newY));

        // Update Ref (Source of Truth during drag)
        currentYRef.current = newY;

        // Direct DOM update (High Performance)
        if (imgRef.current) {
            imgRef.current.style.objectPosition = `50% ${newY}%`;
        }
    };

    const handleMouseUp = () => {
        if (!isDraggingRef.current) return;
        isDraggingRef.current = false;

        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';

        // Sync to React state and PERSIST change
        setDragY(currentYRef.current);
        setDragY(positionY);
        currentYRef.current = positionY;
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Create local preview
            const previewUrl = URL.createObjectURL(file);
            setLocalPreview(previewUrl);

            onUpload(file).then(() => {
                // Parent will update URL, forcing re-render.
                // We can clear local preview then, or keep it until url changes.
            });
        }
    };

    // Default Atmospheric Header (Aurora) if no URL
    if (!url && !localPreview) {
        return (
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
                            onClick={() => fileInputRef.current?.click()}
                            className="text-xs text-muted-foreground hover:bg-black/5 hover:text-foreground h-7"
                        >
                            <Image className="w-3.5 h-3.5 mr-1.5" />
                            Add cover
                        </Button>
                    </div>
                )}
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleFileChange}
                />
            </div>
        );
    }

    // Active Cover
    const activeSrc = localPreview || resolvedSrc || '';
    const displayY = dragY;

    return (
        <div
            className="group relative w-full h-[30vh] min-h-[160px] bg-muted/20 shrink-0 select-none overflow-hidden"
            ref={containerRef}
        >
            {activeSrc && (
                <img
                    ref={imgRef}
                    src={activeSrc}
                    alt="Cover"
                    className={cn(
                        "absolute inset-0 w-full h-full object-cover transition-all duration-100",
                        !readOnly ? "cursor-move" : ""
                    )}
                    style={{ objectPosition: `50% ${displayY}%` }}
                    onMouseDown={handleMouseDown}
                />
            )}

            {/* Controls Overlay */}
            {!readOnly && (
                <div className="absolute bottom-4 right-12 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20 flex gap-2">
                    <Button
                        variant="secondary"
                        size="sm"
                        className="h-7 text-xs bg-white/50 backdrop-blur-md hover:bg-white/80 dark:bg-black/50 dark:hover:bg-black/70 shadow-sm border border-black/5"
                        onClick={() => fileInputRef.current?.click()}
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

            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleFileChange}
            />
        </div>
    );
}
