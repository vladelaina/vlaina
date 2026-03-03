import { useCallback } from 'react';
import { calculateCropPixels } from '../../../utils/coverUtils';
import type { LoadedCoverMedia } from '../coverRenderer.types';

interface UseCoverMediaSyncProps {
  effectiveContainerSize: { width: number; height: number } | null;
  isImageReady: boolean;
  previewSrc: string | null;
  positionX: number;
  positionY: number;
  zoom: number;
  setMediaSize: (size: { width: number; height: number }) => void;
  setCrop: (crop: { x: number; y: number }) => void;
  setZoom: (zoom: number) => void;
  setIsImageReady: (ready: boolean) => void;
}

export function useCoverMediaSync({
  effectiveContainerSize,
  isImageReady,
  previewSrc,
  positionX,
  positionY,
  zoom,
  setMediaSize,
  setCrop,
  setZoom,
  setIsImageReady,
}: UseCoverMediaSyncProps) {
  const handleMediaLoaded = useCallback((media: LoadedCoverMedia) => {
    setMediaSize({ width: media.naturalWidth, height: media.naturalHeight });

    if (effectiveContainerSize && !isImageReady) {
      const targetX = previewSrc ? 50 : positionX;
      const targetY = previewSrc ? 50 : positionY;
      const targetZoom = previewSrc ? 1 : zoom;
      const pixels = calculateCropPixels(
        { x: targetX, y: targetY },
        { width: media.naturalWidth, height: media.naturalHeight },
        effectiveContainerSize,
        targetZoom
      );
      setCrop(pixels);
      setZoom(targetZoom);
    } else if (!isImageReady) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    }

    if (!isImageReady) {
      setIsImageReady(true);
    }
  }, [
    setMediaSize,
    effectiveContainerSize,
    isImageReady,
    previewSrc,
    positionX,
    positionY,
    zoom,
    setCrop,
    setZoom,
    setIsImageReady,
  ]);

  return { handleMediaLoaded };
}
