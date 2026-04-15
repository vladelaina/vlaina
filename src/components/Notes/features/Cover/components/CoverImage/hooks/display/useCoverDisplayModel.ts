import { useCallback, useEffect, useState } from 'react';
import type { CoverFlowPhase } from '../../coverFlowPhase';
import { DEFAULT_POSITION_PERCENT, DEFAULT_SCALE } from '../../../../utils/coverConstants';

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
  const useSelectionDefaults = phase === 'previewing' || phase === 'committing';
  const displayPositionX = useSelectionDefaults ? DEFAULT_POSITION_PERCENT : positionX;
  const displayPositionY = useSelectionDefaults ? DEFAULT_POSITION_PERCENT : positionY;
  const effectiveCrop = useSelectionDefaults ? { x: 0, y: 0 } : crop;
  const effectiveZoom = useSelectionDefaults ? DEFAULT_SCALE : zoom;
  const syncPositionX = useSelectionDefaults ? DEFAULT_POSITION_PERCENT : positionX;
  const syncPositionY = useSelectionDefaults ? DEFAULT_POSITION_PERCENT : positionY;
  const syncZoom = useSelectionDefaults ? DEFAULT_SCALE : zoom;
  const sourceIsReady = Boolean(mediaSrc) && readySrc === mediaSrc && isImageReady;
  const placeholderSrc = sourceIsReady
    ? mediaSrc
    : (readySrc || prevSrcRef.current || mediaSrc);
  const suspendPositionSync = phase !== 'ready' || !sourceIsReady;

  useEffect(() => {
    if (!mediaSrc || readySrc !== mediaSrc || isImageReady) return;
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
