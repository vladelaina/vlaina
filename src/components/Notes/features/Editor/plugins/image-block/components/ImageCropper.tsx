import React, { useRef, useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { X, Check } from 'lucide-react';
import { PremiumSlider } from '@/components/ui/premium-slider';
import { CropParams, calculateRestoredCrop } from '../utils/cropUtils';

interface ImageCropperProps {
    imageSrc: string;
    initialCropParams: CropParams | null;
    containerSize: { width: number; height: number };
    onSave: (percentageCrop: any, ratio: number) => void;
    onCancel: () => void;
    isSaving: boolean;
}

export const ImageCropper: React.FC<ImageCropperProps> = ({
    imageSrc,
    initialCropParams,
    containerSize,
    onSave,
    onCancel,
    isSaving
}) => {
    // Editor State
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [minZoomLimit, setMinZoomLimit] = useState(1);
    
    // Internal refs for crop data
    const lastPercentageCrop = useRef<any>(null);
    const originalAspectRatioRef = useRef<number>(1);
    const [isCropperReady, setIsCropperReady] = useState(false);

    const onCropChangeComplete = useCallback((percentageCrop: any, _pixelCrop: any) => {
        lastPercentageCrop.current = percentageCrop;
    }, []);

    const onMediaLoaded = useCallback((mediaSize: { width: number, height: number, naturalWidth: number, naturalHeight: number }) => {
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

    const handleSave = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (lastPercentageCrop.current) {
            const pc = lastPercentageCrop.current;
            // Calculate the ACTUAL aspect ratio of the cropped area
            // Ratio = (Width% / Height%) * ImageRatio
            // This ensures the container in View Mode matches the shape of the Crop Box
            const cropRatio = (pc.width / pc.height) * originalAspectRatioRef.current;
            
            onSave(pc, cropRatio);
        }
    };

    return (
        <div 
            className="relative overflow-hidden bg-black/5"
            style={{
                width: containerSize.width,
                height: containerSize.height,
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
                showGrid={false}
                zoomWithScroll={true}
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

            {/* Floating HUD */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2 bg-[var(--neko-bg-primary)]/80 backdrop-blur-md border border-[var(--neko-border)] rounded-full shadow-lg z-50">
                <div className="w-32 flex items-center">
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
                        onClick={handleSave}
                        disabled={isSaving || !isCropperReady}
                        className="p-1.5 rounded-full bg-[var(--neko-accent)] hover:bg-[var(--neko-accent-hover)] text-white shadow-sm transition-all active:scale-95 disabled:opacity-50"
                        title="Save"
                    >
                        <Check size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
};
