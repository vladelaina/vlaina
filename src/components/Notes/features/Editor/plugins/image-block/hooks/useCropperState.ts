import { useState, useRef, useEffect, useCallback } from 'react';
import { CropParams, calculateRestoredCrop } from '../utils/cropUtils';

const ZOOM_COVER_MULTIPLIER = 1.001;

interface UseCropperStateProps {
    initialCropParams: CropParams | null;
    containerSize: { width: number; height: number };
    onMediaLoaded?: (mediaSize: { width: number; height: number; naturalWidth: number; naturalHeight: number }) => void;
}

export function useCropperState({ initialCropParams, containerSize, onMediaLoaded: externalOnMediaLoaded }: UseCropperStateProps) {
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [minZoomLimit, setMinZoomLimit] = useState(1);

    const mediaSizeRef = useRef<{ naturalWidth: number; naturalHeight: number } | null>(null);
    const originalAspectRatioRef = useRef<number>(1);

    // Recalculate zoom limits when container size changes
    useEffect(() => {
        if (mediaSizeRef.current && containerSize.width && containerSize.height) {
            const mediaSize = mediaSizeRef.current;

            const fitRatio = Math.min(
                containerSize.width / mediaSize.naturalWidth,
                containerSize.height / mediaSize.naturalHeight
            );

            const displayedWidthAtZoom1 = mediaSize.naturalWidth * fitRatio;
            const displayedHeightAtZoom1 = mediaSize.naturalHeight * fitRatio;

            const widthScale = containerSize.width / displayedWidthAtZoom1;
            const heightScale = containerSize.height / displayedHeightAtZoom1;

            const coverZoom = Math.max(widthScale, heightScale) * ZOOM_COVER_MULTIPLIER;

            setMinZoomLimit(coverZoom);
            setZoom(prev => Math.max(prev, coverZoom));
        }
    }, [containerSize.width, containerSize.height]);

    // Enforce min zoom
    useEffect(() => {
        if (zoom < minZoomLimit) {
            setZoom(minZoomLimit);
        }
    }, [zoom, minZoomLimit]);

    const onMediaLoaded = useCallback((mediaSize: { width: number, height: number, naturalWidth: number, naturalHeight: number }) => {
        mediaSizeRef.current = mediaSize;
        if (externalOnMediaLoaded) {
            externalOnMediaLoaded(mediaSize);
        }
        originalAspectRatioRef.current = mediaSize.naturalWidth / mediaSize.naturalHeight;

        if (!containerSize.width || !containerSize.height) return;

        const fitRatio = Math.min(
            containerSize.width / mediaSize.naturalWidth,
            containerSize.height / mediaSize.naturalHeight
        );

        const displayedWidthAtZoom1 = mediaSize.naturalWidth * fitRatio;
        const displayedHeightAtZoom1 = mediaSize.naturalHeight * fitRatio;

        const widthScale = containerSize.width / displayedWidthAtZoom1;
        const heightScale = containerSize.height / displayedHeightAtZoom1;

        const coverZoom = Math.max(widthScale, heightScale) * ZOOM_COVER_MULTIPLIER;

        setMinZoomLimit(coverZoom);

        if (initialCropParams) {
            const restoredZoom = 100 / initialCropParams.width;
            setZoom(restoredZoom);

            const restoredCrop = calculateRestoredCrop(
                initialCropParams,
                displayedWidthAtZoom1,
                displayedHeightAtZoom1
            );
            setCrop(restoredCrop);
        } else {
            setZoom(coverZoom);
            setCrop({ x: 0, y: 0 });
        }
    }, [containerSize, initialCropParams, externalOnMediaLoaded]);

    return {
        crop, setCrop,
        zoom, setZoom,
        minZoomLimit,
        mediaSizeRef,
        originalAspectRatioRef,
        onMediaLoaded
    };
}
