import React, { useRef, useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { X, Check } from 'lucide-react';
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
    const [isCropperReady, setIsCropperReady] = useState(false);

    // Auto-save debouncer
    const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Manual Wheel Handler for Ctrl+Scroll Zooming when NOT active
    const handleWheel = (e: React.WheelEvent) => {
        if (isActive) return; // If active, let react-easy-crop handle it if enabled, or user is using UI

        if (e.ctrlKey) {
            e.preventDefault();
            e.stopPropagation();

            const delta = -e.deltaY / 200; // Sensitivity
            const newZoom = Math.min(5, Math.max(minZoomLimit, zoom + delta));
            
            setZoom(newZoom);
            
            // Trigger auto-save logic
            if (autoSaveTimeoutRef.current) {
                clearTimeout(autoSaveTimeoutRef.current);
            }

            autoSaveTimeoutRef.current = setTimeout(() => {
                // We need to trigger save. 
                // Note: lastPercentageCrop.current is updated by onCropComplete which fires after setZoom
                // So this timeout should see the updated crop.
                if (lastPercentageCrop.current) {
                    const pc = lastPercentageCrop.current;
                    
                    // Force keep the current aspect ratio during zoom to prevent container resizing/jitter
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
            }, 500); // 500ms debounce
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

    const handleSave = (e?: React.MouseEvent) => {
        e?.preventDefault();
        e?.stopPropagation();
        
        if (lastPercentageCrop.current) {
            const pc = lastPercentageCrop.current;
            // Calculate the ACTUAL aspect ratio of the cropped area
            // Ratio = (Width% / Height%) * ImageRatio
            // This ensures the container in View Mode matches the shape of the Crop Box
            const cropRatio = (pc.width / pc.height) * originalAspectRatioRef.current;
            
            onSave(pc, cropRatio);
        }
    };
    
    // Expose handleSave to be called programmatically if needed?
    // For now, parent passes us onSave, but we need to pass CURRENT crop state back.
    // We can use an effect or expose a ref, but simple way: 
    // If the parent wants to auto-save on resize end, it needs access to lastPercentageCrop.
    // BUT, simpler approach: Parent handles the resize logic (width/height), 
    // and Cropper updates the internal crop state.
    // When resize ends (MouseUp in parent), parent needs to trigger a "Save" with the NEW crop data.
    // Wait, onResizeStart is in Parent. onMouseUp is in Parent.
    // Parent doesn't know about `lastPercentageCrop`.
    // We need to lift `lastPercentageCrop` up or provide a way to get it.
    
    // Quick Fix: Call onSave (or a specific onCropUpdate) whenever crop completes? 
    // No, that would spam.
    
    // Better: Allow parent to pass a ref to get the current crop state.
    // OR: Just keep the "Check" button for explicit confirmation of ZOOM/PAN changes.
    // For RESIZE changes, the parent updates the container, Cropper adapts, and `onCropChangeComplete` fires.
    // We probably need to auto-save after resize?
    
    return (
        <>
            <div 
                className="relative overflow-hidden z-0"
                style={{
                    width: containerSize.width,
                    height: containerSize.height,
                }}
                onWheel={handleWheel}
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
                        containerStyle: { borderRadius: '0' },
                        mediaStyle: { borderRadius: '0' }
                    }}
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
                    "absolute top-full left-1/2 -translate-x-1/2 mt-2 flex items-center gap-3 px-4 py-2 bg-[var(--neko-bg-primary)]/95 backdrop-blur-sm border border-[var(--neko-border)] rounded-full shadow-sm z-50",
                    "transition-all duration-200 origin-top",
                    isActive ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 -translate-y-2 pointer-events-none"
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
                <div className="h-4 w-px bg-[var(--neko-border)]" />
                <div className="flex items-center gap-1">
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onCancel();
                        }}
                        className="p-1.5 rounded-full hover:bg-[var(--neko-hover)] text-[var(--neko-text-secondary)] transition-colors"
                        title="Cancel"
                    >
                        <X size={16} />
                    </button>
                    <button
                        onClick={(e) => handleSave(e)}
                        disabled={isSaving || !isCropperReady}
                        className="p-1.5 rounded-full bg-[var(--neko-accent)] hover:bg-[var(--neko-accent-hover)] text-white shadow-sm transition-all active:scale-95 disabled:opacity-50"
                        title="Save"
                    >
                        <Check size={16} />
                    </button>
                </div>
            </div>
        </>
    );
};
