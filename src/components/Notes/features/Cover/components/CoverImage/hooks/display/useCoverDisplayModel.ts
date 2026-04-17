import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CoverFlowPhase } from '../../coverFlowPhase';
import { DEFAULT_POSITION_PERCENT, DEFAULT_SCALE } from '../../../../utils/coverConstants';
import { getCachedDimensions } from '../../../../utils/coverDimensionCache';

interface UseCoverDisplayModelProps {
  phase: CoverFlowPhase;
  previewSrc: string | null;
  resolvedSrc: string | null;
  isSourceStale: boolean;
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
  isSourceStale,
  prevSrcRef,
  crop,
  zoom,
  positionX,
  positionY,
  isImageReady,
  setIsImageReady,
}: UseCoverDisplayModelProps) {
  const [readySrc, setReadySrc] = useState<string | null>(null);
  const stableDisplayStateRef = useRef<{
    src: string;
    positionX: number;
    positionY: number;
    crop: { x: number; y: number };
    zoom: number;
  } | null>(null);

  const mediaSrc = previewSrc || resolvedSrc || prevSrcRef.current || '';
  const cachedMediaDimensions = mediaSrc ? (getCachedDimensions(mediaSrc) ?? null) : null;
  const cachedPreviewDimensions =
    previewSrc && mediaSrc === previewSrc
      ? cachedMediaDimensions
      : (previewSrc ? (getCachedDimensions(previewSrc) ?? null) : null);
  const shouldPreferPreviewFrame = phase === 'previewing' || phase === 'committing';
  const preferCurrentPreviewFrame = shouldPreferPreviewFrame && Boolean(previewSrc);
  const previewIsPreloaded = preferCurrentPreviewFrame && Boolean(cachedPreviewDimensions);
  const currentMediaIsCached = Boolean(cachedMediaDimensions);
  const sourceIsReady = Boolean(mediaSrc) && (
    currentMediaIsCached ||
    (!isSourceStale && readySrc === mediaSrc && isImageReady)
  );
  const placeholderSrc = sourceIsReady
    ? mediaSrc
    : (preferCurrentPreviewFrame
        ? (mediaSrc || readySrc || prevSrcRef.current)
        : (readySrc || prevSrcRef.current || mediaSrc));
  const stableDisplayState = stableDisplayStateRef.current;
  const stableSrc = stableDisplayState?.src ?? null;
  const shouldHoldPreviousFrame =
    !preferCurrentPreviewFrame &&
    (isSourceStale || !sourceIsReady) &&
    Boolean(stableDisplayState) &&
    (
      stableSrc === mediaSrc ||
      (Boolean(placeholderSrc) && stableSrc === placeholderSrc)
    );
  const useSelectionDefaults = phase === 'previewing';
  const baseDisplayPositionX = useSelectionDefaults ? DEFAULT_POSITION_PERCENT : positionX;
  const baseDisplayPositionY = useSelectionDefaults ? DEFAULT_POSITION_PERCENT : positionY;
  const baseEffectiveCrop = useSelectionDefaults ? { x: 0, y: 0 } : crop;
  const baseEffectiveZoom = useSelectionDefaults ? DEFAULT_SCALE : zoom;
  const frozenDisplayState = shouldHoldPreviousFrame ? stableDisplayState : null;
  const displayPositionX = frozenDisplayState?.positionX ?? baseDisplayPositionX;
  const displayPositionY = frozenDisplayState?.positionY ?? baseDisplayPositionY;
  const effectiveCrop = frozenDisplayState?.crop ?? baseEffectiveCrop;
  const effectiveZoom = frozenDisplayState?.zoom ?? baseEffectiveZoom;
  const syncPositionX = useSelectionDefaults ? DEFAULT_POSITION_PERCENT : positionX;
  const syncPositionY = useSelectionDefaults ? DEFAULT_POSITION_PERCENT : positionY;
  const syncZoom = useSelectionDefaults ? DEFAULT_SCALE : zoom;
  const suspendPositionSync = phase !== 'ready' || !sourceIsReady || isSourceStale;

  useLayoutEffect(() => {
    if (!mediaSrc || !cachedMediaDimensions) return;
    if (readySrc === mediaSrc && isImageReady) return;

    if (readySrc !== mediaSrc) {
      setReadySrc(mediaSrc);
    }
    if (!isImageReady) {
      setIsImageReady(true);
    }
  }, [
    cachedMediaDimensions,
    cachedPreviewDimensions,
    isImageReady,
    isSourceStale,
    mediaSrc,
    phase,
    previewIsPreloaded,
    previewSrc,
    readySrc,
    setIsImageReady,
  ]);

  useEffect(() => {
    if (!sourceIsReady || !mediaSrc) return;

    stableDisplayStateRef.current = {
      src: mediaSrc,
      positionX: baseDisplayPositionX,
      positionY: baseDisplayPositionY,
      crop: baseEffectiveCrop,
      zoom: baseEffectiveZoom,
    };
  }, [
    baseDisplayPositionX,
    baseDisplayPositionY,
    baseEffectiveCrop,
    baseEffectiveZoom,
    mediaSrc,
    sourceIsReady,
  ]);

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
    isHoldingPreviousFrame: shouldHoldPreviousFrame,
    suspendPositionSync,
    handleSourceReady,
  };
}
