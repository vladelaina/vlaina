import { useCallback } from 'react';
import { calculateCropPixels, DEFAULT_SCALE } from '../../../utils/coverUtils';
import type { LoadedCoverMedia } from '../coverRenderer.types';

interface UseCoverMediaSyncProps {
  currentSrc: string;
  effectiveContainerSize: { width: number; height: number } | null;
  isImageReady: boolean;
  syncPositionX: number;
  syncPositionY: number;
  syncZoom: number;
  setMediaSize: (size: { width: number; height: number }) => void;
  setCrop: (crop: { x: number; y: number }) => void;
  setZoom: (zoom: number) => void;
  setIsImageReady: (ready: boolean) => void;
  onSourceReady?: (src: string) => void;
}

export function useCoverMediaSync({
  currentSrc,
  effectiveContainerSize,
  isImageReady,
  syncPositionX,
  syncPositionY,
  syncZoom,
  setMediaSize,
  setCrop,
  setZoom,
  setIsImageReady,
  onSourceReady,
}: UseCoverMediaSyncProps) {
  const handleMediaLoaded = useCallback((media: LoadedCoverMedia) => {
    setMediaSize({ width: media.naturalWidth, height: media.naturalHeight });

    if (effectiveContainerSize && !isImageReady) {
      const pixels = calculateCropPixels(
        { x: syncPositionX, y: syncPositionY },
        { width: media.naturalWidth, height: media.naturalHeight },
        effectiveContainerSize,
        syncZoom
      );
      setCrop(pixels);
      setZoom(syncZoom);
    } else if (!isImageReady) {
      setCrop({ x: 0, y: 0 });
      setZoom(DEFAULT_SCALE);
    }

    if (!isImageReady) {
      setIsImageReady(true);
      if (currentSrc) {
        onSourceReady?.(currentSrc);
      }
    }
  }, [
    currentSrc,
    setMediaSize,
    effectiveContainerSize,
    isImageReady,
    syncPositionX,
    syncPositionY,
    syncZoom,
    setCrop,
    setZoom,
    setIsImageReady,
    onSourceReady,
  ]);

  return { handleMediaLoaded };
}
