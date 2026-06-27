import { useLayoutEffect, type Dispatch, type SetStateAction } from 'react';
import { calculateCropPixels } from '../../../../utils/coverGeometry';

interface UseCoverPositionSyncProps {
  positionX: number;
  positionY: number;
  mediaSize: { width: number; height: number } | null;
  effectiveContainerSize: { width: number; height: number } | null;
  zoom: number;
  isInteracting: boolean;
  isResizing: boolean;
  suspendSync?: boolean;
  ignoreCropSyncRef: React.MutableRefObject<boolean>;
  setCrop: Dispatch<SetStateAction<{ x: number; y: number }>>;
}

export function useCoverPositionSync({
  positionX,
  positionY,
  mediaSize,
  effectiveContainerSize,
  zoom,
  isInteracting,
  isResizing,
  suspendSync = false,
  ignoreCropSyncRef,
  setCrop,
}: UseCoverPositionSyncProps) {
  useLayoutEffect(() => {
    if (suspendSync) return;
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
    setCrop((currentCrop) => (
      currentCrop.x === pixels.x && currentCrop.y === pixels.y ? currentCrop : pixels
    ));
  }, [
    positionX,
    positionY,
    mediaSize,
    effectiveContainerSize,
    isInteracting,
    isResizing,
    zoom,
    setCrop,
    ignoreCropSyncRef,
    suspendSync,
  ]);
}
