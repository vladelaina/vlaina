import React, { useRef } from 'react';
import Cropper from 'react-easy-crop';
import { cn } from '@/lib/utils';
import type { CropParams } from '../utils/imageSourceFragment';
import { InvisibleResizeHandles } from './InvisibleResizeHandles';
import { CropperControls } from './CropperControls';
import { useCropperState } from '../hooks/useCropperState';
import { useCropperInteraction } from '../hooks/useCropperInteraction';
import { resolveCropperMaxZoom } from '../utils/cropperViewport';
import type { CropArea, CropperViewportState, LoadedMediaSize, ResizeDirection } from '../types';
import { themeImageBlockStyleTokens, themeStyleResetTokens } from '@/styles/themeTokens';

interface ImageCropperProps {
    imageSrc: string;
    sourceSrc?: string;
    sourceAlt?: string;
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
    sourceSrc,
    sourceAlt,
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
    const maxZoomLimit = resolveCropperMaxZoom(minZoomLimit);

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
        <div className="relative h-full w-full">
            <div
                ref={containerRef}
                className={cn(
                    "relative overflow-hidden z-[var(--vlaina-z-0)] select-none",
                    isCtrlPressed && "cursor-move"
                )}
                style={{
                    width: themeImageBlockStyleTokens.widthFull,
                    height: themeImageBlockStyleTokens.sizeFull,
                }}
            >
                {imageSrc && (
                    <Cropper
                        image={imageSrc}
                        mediaProps={{
                            'data-src': sourceSrc || undefined,
                            'data-inject-url': sourceSrc || undefined,
                            alt: sourceAlt ?? '',
                        } as React.ImgHTMLAttributes<HTMLElement>}
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
                        maxZoom={maxZoomLimit}
                        restrictPosition={true}
                        objectFit="cover"
                        style={{
                            containerStyle: {
                                borderRadius: themeStyleResetTokens.borderRadiusNone,
                                pointerEvents: (isActive || isCtrlPressed) ? 'auto' : 'none'
                            },
                            cropAreaStyle: { 
                                border: themeStyleResetTokens.borderNone,
                                boxShadow: themeStyleResetTokens.boxShadowNone,
                                color: themeStyleResetTokens.colorTransparent,
                                outline: themeStyleResetTokens.outlineNone,
                                background: themeStyleResetTokens.backgroundTransparent
                            },
                            mediaStyle: { borderRadius: themeStyleResetTokens.borderRadiusNone }
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
                maxZoom={maxZoomLimit}
                isActive={isActive}
                isSaving={isSaving}
                onSave={handleSaveClick}
                onCancel={handleCancelClick}
            />
        </div>
    );
};
