import React, { useRef, useState, useCallback, useEffect } from 'react';
import Cropper from 'react-easy-crop';
import { MdClose, MdCheck } from 'react-icons/md';
import { cn } from '@/lib/utils';
import { PremiumSlider } from '@/components/ui/premium-slider';
import { CropParams, calculateRestoredCrop } from '../utils/cropUtils';
import { InvisibleResizeHandles } from './InvisibleResizeHandles';

interface ImageCropperProps {
    imageSrc: string;
    initialCropParams: CropParams | null;
    containerSize: { width: number; height: number };
    onSave: (percentageCrop: any, ratio: number) => void;
    onCancel: () => void;
    isSaving: boolean;
    onResizeStart?: (direction: 'left' | 'right' | 'top' | 'bottom' | 'bottom-left' | 'bottom-right') => (e: React.MouseEvent) => void;
    isActive: boolean;
    onMediaLoaded?: (mediaSize: { width: number; height: number; naturalWidth: number; naturalHeight: number }) => void;
}

export const ImageCropper: React.FC<ImageCropperProps> = ({
    imageSrc,
    initialCropParams,
    containerSize,
    onSave,
    onCancel,
    isSaving,
    onResizeStart,
    isActive,
    onMediaLoaded: externalOnMediaLoaded
}) => {
    // Editor State
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [minZoomLimit, setMinZoomLimit] = useState(1);
    
    // Internal refs for crop data
    const lastPercentageCrop = useRef<any>(null);
    const originalAspectRatioRef = useRef<number>(1);
    const mediaSizeRef = useRef<{ naturalWidth: number; naturalHeight: number } | null>(null);
    const [isCropperReady, setIsCropperReady] = useState(false);
    
    // Ctrl key state for panning access
    const [isCtrlPressed, setIsCtrlPressed] = useState(false);

    // Watch for container resize to update minZoomLimit and ensure cover
    useEffect(() => {
        if (mediaSizeRef.current && containerSize.width && containerSize.height) {
            const mediaSize = mediaSizeRef.current;
            
            // Calculate fit ratio (what react-easy-crop uses for Zoom=1)
            const fitRatio = Math.min(
                containerSize.width / mediaSize.naturalWidth,
                containerSize.height / mediaSize.naturalHeight
            );

            const displayedWidthAtZoom1 = mediaSize.naturalWidth * fitRatio;
            const displayedHeightAtZoom1 = mediaSize.naturalHeight * fitRatio;

            // Calculate minimum scale to cover the container
            const widthScale = containerSize.width / displayedWidthAtZoom1;
            const heightScale = containerSize.height / displayedHeightAtZoom1;
            
            // Add tiny buffer (1.001) to avoid sub-pixel gaps
            const coverZoom = Math.max(widthScale, heightScale) * 1.001;
            
            setMinZoomLimit(coverZoom);
            
            // Force zoom to be at least coverZoom to prevent whitespace
            setZoom(prev => {
                const newZoom = Math.max(prev, coverZoom);
                return newZoom;
            });
        }
    }, [containerSize.width, containerSize.height]);

    // Safety net: Ensure zoom never falls below minimum limit
    useEffect(() => {
        if (zoom < minZoomLimit) {
            setZoom(minZoomLimit);
        }
    }, [zoom, minZoomLimit]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Control' || e.key === 'Meta') setIsCtrlPressed(true);
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Control' || e.key === 'Meta') setIsCtrlPressed(false);
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    const containerRef = useRef<HTMLDivElement>(null);

    // Auto-save debouncer
    const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const performSave = () => {
        if (lastPercentageCrop.current) {
            const pc = lastPercentageCrop.current;
            
            // Force keep the current aspect ratio during zoom/pan to prevent container resizing/jitter
            // Use initialCropParams.ratio if available (which reflects current container state),
            // otherwise calculate from container size directly.
            let currentRatio = initialCropParams?.ratio;
            
            if (!currentRatio && containerSize.width && containerSize.height) {
                currentRatio = containerSize.width / containerSize.height;
            }
            
            // Fallback if somehow neither is available
            if (!currentRatio) {
                currentRatio = (pc.width / pc.height) * originalAspectRatioRef.current;
            }

            onSave(pc, currentRatio);
        }
    };

    // Manual Wheel Handler for Ctrl+Scroll Zooming when NOT active
    // Attached via useEffect to allow { passive: false }
    useEffect(() => {
        const currentRef = containerRef.current;
        if (!currentRef) return;

        const onWheel = (e: WheelEvent) => {
            if (isActive) return;

            if (e.ctrlKey) {
                e.preventDefault();
                e.stopPropagation();

                const delta = -e.deltaY / 200;
                
                setZoom(prevZoom => {
                    const newZoom = Math.min(5, Math.max(minZoomLimit, prevZoom + delta));
                    return newZoom;
                });

                // Trigger auto-save logic
                if (autoSaveTimeoutRef.current) {
                    clearTimeout(autoSaveTimeoutRef.current);
                }

                autoSaveTimeoutRef.current = setTimeout(() => {
                    performSave();
                }, 500);
            }
        };

        currentRef.addEventListener('wheel', onWheel, { passive: false });

        return () => {
            currentRef.removeEventListener('wheel', onWheel);
        };
    }, [isActive, minZoomLimit, performSave]);

    const handleInteractionEnd = () => {
        if (!isActive) {
            performSave();
        }
    };

    // Cleanup timeout
    React.useEffect(() => {
        return () => {
            if (autoSaveTimeoutRef.current) {
                clearTimeout(autoSaveTimeoutRef.current);
            }
        };
    }, []);

    const onCropChangeComplete = useCallback((percentageCrop: any, _pixelCrop: any) => {
        lastPercentageCrop.current = percentageCrop;
    }, []);

    const onMediaLoaded = useCallback((mediaSize: { width: number, height: number, naturalWidth: number, naturalHeight: number }) => {
        mediaSizeRef.current = mediaSize;
        if (externalOnMediaLoaded) {
            externalOnMediaLoaded(mediaSize);
        }
        originalAspectRatioRef.current = mediaSize.naturalWidth / mediaSize.naturalHeight;

        if (!containerSize.width || !containerSize.height) return;

        // Calculate fit ratio (what react-easy-crop uses for Zoom=1)
        const fitRatio = Math.min(
            containerSize.width / mediaSize.naturalWidth,
            containerSize.height / mediaSize.naturalHeight
        );

        const displayedWidthAtZoom1 = mediaSize.naturalWidth * fitRatio;
        const displayedHeightAtZoom1 = mediaSize.naturalHeight * fitRatio;

        // Calculate minimum scale to cover the container
        const widthScale = containerSize.width / displayedWidthAtZoom1;
        const heightScale = containerSize.height / displayedHeightAtZoom1;
        
        // Add tiny buffer (1.001) to avoid sub-pixel gaps
        const coverZoom = Math.max(widthScale, heightScale) * 1.001;
        
        setMinZoomLimit(coverZoom);

        // Restore State
        if (initialCropParams) {
            // Restore Zoom
            const restoredZoom = 100 / initialCropParams.width;
            setZoom(restoredZoom);
            
            // Restore Position
            const restoredCrop = calculateRestoredCrop(
                initialCropParams, 
                displayedWidthAtZoom1, 
                displayedHeightAtZoom1
            );
            setCrop(restoredCrop);
        } else {
            // Default: Zoom to cover
            setZoom(coverZoom);
            setCrop({ x: 0, y: 0 });
        }

        setIsCropperReady(true);
    }, [containerSize, initialCropParams]);

    const handleCancel = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Reset to initial state
        if (initialCropParams) {
            const restoredZoom = 100 / initialCropParams.width;
            setZoom(restoredZoom);
        } else {
            setZoom(minZoomLimit);
            setCrop({ x: 0, y: 0 });
        }
        
        onCancel();
    };

    const handleSave = (e?: React.MouseEvent) => {
        e?.preventDefault();
        e?.stopPropagation();
        
        const pc = lastPercentageCrop.current || { x: 0, y: 0, width: 100, height: 100 };
        // Calculate the ACTUAL aspect ratio of the cropped area
        // Ratio = (Width% / Height%) * ImageRatio
        const cropRatio = (pc.width / pc.height) * originalAspectRatioRef.current;
        
        onSave(pc, cropRatio);
    };
    
    return (
        <>
            <div 
                ref={containerRef}
                className={cn(
                    "relative overflow-hidden z-0 select-none",
                    isCtrlPressed && "cursor-move"
                )}
                style={{
                    width: '100%',
                    height: '100%',
                }}
            >
                <Cropper
                    image={imageSrc}
                    crop={crop}
                    zoom={zoom}
                    cropSize={containerSize}
                    aspect={undefined}
                    onCropChange={setCrop}
                    onCropComplete={onCropChangeComplete}
                    onZoomChange={setZoom}
                    onMediaLoaded={onMediaLoaded}
                    showGrid={false} // Never show grid
                    zoomWithScroll={isActive} // Only zoom with scroll when active
                    zoomSpeed={0.5}
                    minZoom={minZoomLimit}
                    maxZoom={5}
                    restrictPosition={true}
                    objectFit="cover"
                    style={{
                        containerStyle: { 
                            borderRadius: '0',
                            // Disable pointer events (panning) when not active and Ctrl is not pressed.
                            // This allows Wheel events to bubble up to the parent for Zooming,
                            // while preventing react-easy-crop from capturing dragging/panning.
                            pointerEvents: (isActive || isCtrlPressed) ? 'auto' : 'none'
                        },
                        mediaStyle: { borderRadius: '0' }
                    }}
                    onInteractionEnd={handleInteractionEnd}
                />
                
                {/* Borderless Resize Handlers - Always Available */}
                {onResizeStart && (
                    <InvisibleResizeHandles 
                        onResizeStart={onResizeStart} 
                        verticalEnabled={isActive} 
                    />
                )}
            </div>

            {/* Floating HUD - Only show when Active */}
            <div 
                className={cn(
                    "absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 px-3 py-1.5 bg-white dark:bg-[#1e1e1e] border border-black/5 dark:border-white/10 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] z-[60]",
                    "transition-all duration-200 origin-bottom",
                    isActive ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-2 pointer-events-none"
                )}
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                draggable={false}
            >
                <div 
                    className="w-32 flex items-center"
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <span className="text-[10px] font-bold text-[var(--neko-text-tertiary)] mr-2 uppercase tracking-wide">Zoom</span>
                    <PremiumSlider
                        min={minZoomLimit} // Should not go below cover
                        max={5}
                        step={0.1}
                        value={zoom}
                        onChange={(v) => setZoom(v)}
                        className="w-full"
                    />
                </div>
                <div className="h-4 w-px bg-gray-200 dark:bg-zinc-700" />
                <div className="flex items-center gap-1">
                    <button
                        onClick={handleCancel}
                        className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-zinc-500 dark:text-zinc-400 transition-colors"
                        title="Cancel"
                    >
                        <MdClose size={16} />
                    </button>
                    <button
                        onClick={(e) => handleSave(e)}
                        disabled={isSaving}
                        className="p-1 rounded-lg bg-[var(--neko-accent)] hover:bg-[var(--neko-accent-hover)] text-white shadow-sm transition-all active:scale-95 disabled:opacity-50"
                        title="Save"
                    >
                        <MdCheck size={16} />
                    </button>
                </div>
            </div>
        </>
    );
};