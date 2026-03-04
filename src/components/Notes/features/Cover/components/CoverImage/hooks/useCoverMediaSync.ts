import { useCallback } from 'react';
import { calculateCropPixels } from '../../../utils/coverUtils';
import type { LoadedCoverMedia } from '../coverRenderer.types';
import { coverDebug } from '../../../utils/debug';

interface UseCoverMediaSyncProps {
  currentSrc: string;
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
  onSourceReady?: (src: string) => void;
}

export function useCoverMediaSync({
  currentSrc,
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
  onSourceReady,
}: UseCoverMediaSyncProps) {
  const handleMediaLoaded = useCallback((media: LoadedCoverMedia) => {
    coverDebug('useCoverMediaSync', 'media-loaded', {
      currentSrc: currentSrc ? currentSrc.slice(0, 120) : '',
      naturalWidth: media.naturalWidth,
      naturalHeight: media.naturalHeight,
      isImageReady,
      hasPreviewSrc: Boolean(previewSrc),
      containerWidth: effectiveContainerSize?.width ?? null,
      containerHeight: effectiveContainerSize?.height ?? null,
    });

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
      coverDebug('useCoverMediaSync', 'media-sync-ready-state', {
        targetX,
        targetY,
        targetZoom,
        cropX: pixels.x,
        cropY: pixels.y,
      });
    } else if (!isImageReady) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      coverDebug('useCoverMediaSync', 'media-sync-ready-state', {
        targetX: 50,
        targetY: 50,
        targetZoom: 1,
        cropX: 0,
        cropY: 0,
      });
    }

    if (!isImageReady) {
      setIsImageReady(true);
      if (currentSrc) {
        onSourceReady?.(currentSrc);
      }
      coverDebug('useCoverMediaSync', 'image-marked-ready');
    }
  }, [
    currentSrc,
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
    onSourceReady,
  ]);

  return { handleMediaLoaded };
}
