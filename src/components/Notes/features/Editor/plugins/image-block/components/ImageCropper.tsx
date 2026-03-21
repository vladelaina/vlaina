import React, { useRef } from 'react';
import Cropper from 'react-easy-crop';
import { cn } from '@/lib/utils';
import { CropParams } from '../utils/cropUtils';
import { InvisibleResizeHandles } from './InvisibleResizeHandles';
import { CropperControls } from './CropperControls';
import { useCropperState } from '../hooks/useCropperState';
import { useCropperInteraction } from '../hooks/useCropperInteraction';
import type { CropArea, CropperViewportState, LoadedMediaSize, ResizeDirection } from '../types';

const MAX_ZOOM = 5;

interface ImageCropperProps {
    imageSrc: string;
    initialCropParams: CropParams | null;
    containerSize: { width: number; height: number };
    onSave: (percentageCrop: CropArea, ratio: number) => void;
    onCancel: () => void;
    isSaving: boolean;
    onResizeStart?: (direction: ResizeDirection) => (e: React.MouseEvent) => void;
    isActive: boolean;
    onMediaLoaded?: (mediaSize: LoadedMediaSize) => void;
    overrideState?: CropperViewportState | null;
    onStateChange?: (state: CropperViewportState) => void;
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
    onMediaLoaded: externalOnMediaLoaded,
    overrideState,
    onStateChange
}) => {
    const containerRef = useRef<HTMLDivElement>(null);

    const {
        crop, setCrop,
        zoom, setZoom,
        minZoomLimit,
        originalAspectRatioRef,
        onMediaLoaded
    } = useCropperState({ 
        initialCropParams, 
        containerSize, 
        onMediaLoaded: externalOnMediaLoaded,
        overrideState,
        onStateChange
    });

    const {
        isCtrlPressed,
        handleInteractionEnd,
        onCropChangeComplete,
        handleCancelClick,
        handleSaveClick
    } = useCropperInteraction({
        isActive,
        containerRef,
        minZoomLimit,
        setZoom,
        setCrop,
        onSave,
        onCancel,
        initialCropParams,
        containerSize,
        originalAspectRatioRef
    });

    return (
        <>
            <div
                ref={containerRef}
                className={cn(
                    "relative overflow-hidden z-0 select-none",
                    isCtrlPressed && "cursor-move"
                )}
                style={{ width: '100%', height: '100%' }}
            >
                {imageSrc && (
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
                        zoomWithScroll={isActive}
                        zoomSpeed={0.5}
                        minZoom={minZoomLimit}
                        maxZoom={MAX_ZOOM}
                        restrictPosition={true}
                        objectFit="cover"
                        style={{
                            containerStyle: {
                                borderRadius: '0',
                                pointerEvents: (isActive || isCtrlPressed) ? 'auto' : 'none'
                            },
                            cropAreaStyle: { 
                                border: 'none', 
                                boxShadow: 'none', 
                                color: 'transparent',
                                outline: 'none',
                                background: 'transparent'
                            },
                            mediaStyle: { borderRadius: '0' }
                        }}
                        onInteractionEnd={handleInteractionEnd}
                    />
                )}

                {onResizeStart && (
                    <InvisibleResizeHandles
                        onResizeStart={onResizeStart}
                        verticalEnabled={isActive}
                    />
                )}
            </div>

            <CropperControls 
                zoom={zoom}
                setZoom={setZoom}
                minZoom={minZoomLimit}
                maxZoom={MAX_ZOOM}
                isActive={isActive}
                isSaving={isSaving}
                onSave={handleSaveClick}
                onCancel={handleCancelClick}
            />
        </>
    );
};
