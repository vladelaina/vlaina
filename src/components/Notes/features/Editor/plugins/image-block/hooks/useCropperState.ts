import { useState, useRef, useEffect, useCallback } from 'react';
import type { CropParams } from '../utils/imageSourceFragment';
import { calculateRestoredCrop } from '../utils/cropGeometry';
import type { CropperViewportState, LoadedMediaSize } from '../types';
import { resolveCoverZoom, resolveDisplayedMediaSizeAtZoom1 } from '../utils/cropperViewport';

interface UseCropperStateProps {
    initialCropParams: CropParams | null;
    containerSize: { width: number; height: number };
    onMediaLoaded?: (mediaSize: LoadedMediaSize) => void;
    overrideState?: CropperViewportState | null;
    onStateChange?: (state: CropperViewportState) => void;
}

export function useCropperState({ 
    initialCropParams, 
    containerSize, 
    onMediaLoaded: externalOnMediaLoaded,
    overrideState,
    onStateChange
}: UseCropperStateProps) {
    // If overrideState is provided, use it as initial value
    const [crop, setCrop] = useState(overrideState?.crop || { x: 0, y: 0 });
    const [zoom, setZoom] = useState(overrideState?.zoom || 1);
    const [minZoomLimit, setMinZoomLimit] = useState(1);

    const mediaSizeRef = useRef<{ naturalWidth: number; naturalHeight: number } | null>(null);
    const originalAspectRatioRef = useRef<number>(1);
    const shouldAutoFitViewportRef = useRef(!overrideState && !initialCropParams);

    // Notify parent on change
    useEffect(() => {
        onStateChange?.({ crop, zoom });
    }, [crop, zoom, onStateChange]);

    // Recalculate zoom limits when container size changes
    useEffect(() => {
        if (mediaSizeRef.current && containerSize.width && containerSize.height) {
            const mediaSize = mediaSizeRef.current;
            const coverZoom = resolveCoverZoom(containerSize, {
                width: mediaSize.naturalWidth,
                height: mediaSize.naturalHeight,
            });
            if (coverZoom === null) return;

            setMinZoomLimit(coverZoom);
            
            if (!overrideState) {
                if (shouldAutoFitViewportRef.current) {
                    setZoom(coverZoom);
                    setCrop({ x: 0, y: 0 });
                } else {
                    setZoom(prev => Math.max(prev, coverZoom));
                }
            }
        }
    }, [containerSize.width, containerSize.height, overrideState, setCrop]);

    // Enforce min zoom
    useEffect(() => {
        if (zoom < minZoomLimit) {
            setZoom(minZoomLimit);
        }
    }, [zoom, minZoomLimit]);

    const onMediaLoaded = useCallback((mediaSize: LoadedMediaSize) => {
        mediaSizeRef.current = mediaSize;
        if (externalOnMediaLoaded) {
            externalOnMediaLoaded(mediaSize);
        }
        originalAspectRatioRef.current = mediaSize.naturalWidth / mediaSize.naturalHeight;

        if (!containerSize.width || !containerSize.height) return;
        const displayedMedia = resolveDisplayedMediaSizeAtZoom1(containerSize, {
            width: mediaSize.naturalWidth,
            height: mediaSize.naturalHeight,
        });
        const coverZoom = resolveCoverZoom(containerSize, {
            width: mediaSize.naturalWidth,
            height: mediaSize.naturalHeight,
        });
        if (!displayedMedia || coverZoom === null) return;

        setMinZoomLimit(coverZoom);

        // Priority: Override -> InitialParams -> Default
        if (overrideState) {
            // Ensure we at least cover the container, plus a tiny buffer
            const safeZoom = Math.max(overrideState.zoom, coverZoom);
            setZoom(safeZoom * 1.01);
            setCrop(overrideState.crop);
            shouldAutoFitViewportRef.current = false;
        } else if (initialCropParams) {
            const restoredZoom = 100 / initialCropParams.width;
            setZoom(restoredZoom);

            const restoredCrop = calculateRestoredCrop(
                initialCropParams,
                displayedMedia.width,
                displayedMedia.height
            );
            setCrop(restoredCrop);
            shouldAutoFitViewportRef.current = false;
        } else {
            setZoom(coverZoom);
            setCrop({ x: 0, y: 0 });
            shouldAutoFitViewportRef.current = true;
        }
    }, [containerSize, initialCropParams, externalOnMediaLoaded, overrideState]);

    return {
        crop, setCrop,
        zoom, setZoom,
        minZoomLimit,
        mediaSizeRef,
        originalAspectRatioRef,
        onMediaLoaded
    };
}
