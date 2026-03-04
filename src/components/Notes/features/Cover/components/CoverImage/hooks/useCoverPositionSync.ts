import { useEffect } from 'react';
import { calculateCropPixels } from '../../../utils/coverUtils';
import { coverDebug } from '../../../utils/debug';

interface UseCoverPositionSyncProps {
  positionX: number;
  positionY: number;
  scale: number;
  mediaSize: { width: number; height: number } | null;
  effectiveContainerSize: { width: number; height: number } | null;
  zoom: number;
  isInteracting: boolean;
  isResizing: boolean;
  suspendSync?: boolean;
  hasPreviewSrc?: boolean;
  isSelectingCommit?: boolean;
  sourceIsReady?: boolean;
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
  suspendSync = false,
  hasPreviewSrc = false,
  isSelectingCommit = false,
  sourceIsReady = false,
  ignoreCropSyncRef,
  setCrop,
}: UseCoverPositionSyncProps) {
  useEffect(() => {
    if (suspendSync) {
      coverDebug('useCoverPositionSync', 'skip-sync', {
        reason: 'suspendSync',
        hasPreviewSrc,
        isSelectingCommit,
        sourceIsReady,
      });
      return;
    }
    if (isInteracting || isResizing || !mediaSize || !effectiveContainerSize) return;
    if (ignoreCropSyncRef.current) {
      ignoreCropSyncRef.current = false;
      coverDebug('useCoverPositionSync', 'skip-sync-once', {
        reason: 'ignoreCropSyncRef',
      });
      return;
    }

    const pixels = calculateCropPixels(
      { x: positionX, y: positionY },
      mediaSize,
      effectiveContainerSize,
      zoom
    );
    setCrop(pixels);
    coverDebug('useCoverPositionSync', 'apply-position-sync', {
      positionX,
      positionY,
      scale,
      zoom,
      cropX: pixels.x,
      cropY: pixels.y,
      mediaWidth: mediaSize.width,
      mediaHeight: mediaSize.height,
      containerWidth: effectiveContainerSize.width,
      containerHeight: effectiveContainerSize.height,
    });
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
    suspendSync,
    hasPreviewSrc,
    isSelectingCommit,
    sourceIsReady,
  ]);
}
