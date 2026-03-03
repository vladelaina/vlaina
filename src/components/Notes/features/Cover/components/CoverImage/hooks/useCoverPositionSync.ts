import { useEffect } from 'react';
import { calculateCropPixels } from '../../../utils/coverUtils';

interface UseCoverPositionSyncProps {
  positionX: number;
  positionY: number;
  scale: number;
  mediaSize: { width: number; height: number } | null;
  effectiveContainerSize: { width: number; height: number } | null;
  zoom: number;
  isInteracting: boolean;
  isResizing: boolean;
  ignoreCropSyncRef: React.MutableRefObject<boolean>;
  setCrop: (crop: { x: number; y: number }) => void;
}

export function useCoverPositionSync({
  positionX,
  positionY,
  scale,
  mediaSize,
  effectiveContainerSize,
  zoom,
  isInteracting,
  isResizing,
  ignoreCropSyncRef,
  setCrop,
}: UseCoverPositionSyncProps) {
  useEffect(() => {
    if (isInteracting || isResizing || !mediaSize || !effectiveContainerSize) return;
    if (ignoreCropSyncRef.current) {
      ignoreCropSyncRef.current = false;
      return;
    }

    const pixels = calculateCropPixels(
      { x: positionX, y: positionY },
      mediaSize,
      effectiveContainerSize,
      zoom
    );
    setCrop(pixels);
  }, [
    positionX,
    positionY,
    scale,
    mediaSize,
    effectiveContainerSize,
    isInteracting,
    isResizing,
    zoom,
    setCrop,
    ignoreCropSyncRef,
  ]);
}
