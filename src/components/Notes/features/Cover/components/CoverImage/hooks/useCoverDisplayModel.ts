import { useCallback, useEffect, useState } from 'react';
import type { CoverFlowPhase } from './useCoverSelectionFlow';
import { DEFAULT_POSITION_PERCENT, DEFAULT_SCALE } from '../../../utils/coverUtils';

interface UseCoverDisplayModelProps {
  phase: CoverFlowPhase;
  previewSrc: string | null;
  resolvedSrc: string | null;
  prevSrcRef: React.MutableRefObject<string | null>;
  crop: { x: number; y: number };
  zoom: number;
  positionX: number;
  positionY: number;
  isImageReady: boolean;
  setIsImageReady: (ready: boolean) => void;
}

export function useCoverDisplayModel({
  phase,
  previewSrc,
  resolvedSrc,
  prevSrcRef,
  crop,
  zoom,
  positionX,
  positionY,
  isImageReady,
  setIsImageReady,
}: UseCoverDisplayModelProps) {
  const [readySrc, setReadySrc] = useState<string | null>(null);

  const mediaSrc = previewSrc || resolvedSrc || prevSrcRef.current || '';
  const isPreviewingPhase = phase === 'previewing' || phase === 'committing';
  const isPreviewing = Boolean(previewSrc) && isPreviewingPhase;
  const displayPositionX = isPreviewing ? DEFAULT_POSITION_PERCENT : positionX;
  const displayPositionY = isPreviewing ? DEFAULT_POSITION_PERCENT : positionY;
  const effectiveCrop = isPreviewing ? { x: 0, y: 0 } : crop;
  const effectiveZoom = isPreviewing ? DEFAULT_SCALE : zoom;
  const syncPositionX = isPreviewing ? DEFAULT_POSITION_PERCENT : positionX;
  const syncPositionY = isPreviewing ? DEFAULT_POSITION_PERCENT : positionY;
  const syncZoom = isPreviewing ? DEFAULT_SCALE : zoom;
  const sourceIsReady = Boolean(mediaSrc) && readySrc === mediaSrc;
  const placeholderSrc = sourceIsReady
    ? mediaSrc
    : (readySrc || prevSrcRef.current || mediaSrc);
  const suspendPositionSync = phase !== 'ready' || !sourceIsReady;

  useEffect(() => {
    if (!mediaSrc || readySrc !== mediaSrc || isImageReady) return;
    // Commit can keep the same src string as preview; restore ready state immediately.
    setIsImageReady(true);
  }, [mediaSrc, readySrc, isImageReady, setIsImageReady]);

  useEffect(() => {
    if (mediaSrc) return;
    setReadySrc(null);
  }, [mediaSrc]);

  const handleSourceReady = useCallback((src: string) => {
    setReadySrc(src);
  }, []);

  return {
    mediaSrc,
    sourceIsReady,
    displayPositionX,
    displayPositionY,
    effectiveCrop,
    effectiveZoom,
    syncPositionX,
    syncPositionY,
    syncZoom,
    placeholderSrc,
    suspendPositionSync,
    handleSourceReady,
  };
}
