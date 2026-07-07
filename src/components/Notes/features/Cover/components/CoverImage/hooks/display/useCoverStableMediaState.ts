import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { getCachedDimensions } from '../../../../utils/coverDimensionCache';

type CoverMediaSize = { width: number; height: number };

export function useCoverStableMediaState({
  sourceIsReady,
  mediaSrc,
  coverHeight,
  containerSize,
  mediaSize,
  setMediaSize,
  isHoldingPreviousFrame,
  placeholderSrc,
}: {
  sourceIsReady: boolean;
  mediaSrc: string | null;
  coverHeight: number;
  containerSize: CoverMediaSize | null;
  mediaSize: CoverMediaSize | null;
  setMediaSize: Dispatch<SetStateAction<CoverMediaSize | null>>;
  isHoldingPreviousFrame: boolean;
  placeholderSrc: string | null;
}) {
  const stableMediaStateRef = useRef<{
    src: string;
    size: CoverMediaSize;
  } | null>(null);
  const stableCoverHeightRef = useRef<{
    src: string;
    height: number;
  } | null>(null);
  const [mediaSizeSrc, setMediaSizeSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!sourceIsReady || !mediaSrc) {
      return;
    }

    stableCoverHeightRef.current = {
      src: mediaSrc,
      height: coverHeight,
    };
  }, [coverHeight, mediaSrc, sourceIsReady]);

  const displayCoverHeight = useMemo(() => {
    if (
      isHoldingPreviousFrame &&
      placeholderSrc &&
      stableCoverHeightRef.current?.src === placeholderSrc
    ) {
      return stableCoverHeightRef.current.height;
    }

    return coverHeight;
  }, [coverHeight, isHoldingPreviousFrame, placeholderSrc]);

  const effectiveContainerSize = useMemo(() => {
    if (!containerSize) return null;
    if (containerSize.width <= 0 || displayCoverHeight <= 0) return null;
    return { width: containerSize.width, height: displayCoverHeight };
  }, [containerSize, displayCoverHeight]);

  const cachedMediaSize = useMemo(() => {
    if (!mediaSrc) {
      return null;
    }

    return getCachedDimensions(mediaSrc) ?? null;
  }, [mediaSrc]);

  const effectiveMediaSize = useMemo(() => {
    if (mediaSize && mediaSizeSrc === mediaSrc) {
      return mediaSize;
    }

    return cachedMediaSize;
  }, [cachedMediaSize, mediaSize, mediaSizeSrc, mediaSrc]);

  useEffect(() => {
    if (!sourceIsReady || !mediaSrc || !effectiveMediaSize) {
      return;
    }

    stableMediaStateRef.current = {
      src: mediaSrc,
      size: effectiveMediaSize,
    };
  }, [effectiveMediaSize, mediaSrc, sourceIsReady]);

  const placeholderMediaSize = useMemo(() => {
    if (
      isHoldingPreviousFrame &&
      placeholderSrc &&
      stableMediaStateRef.current?.src === placeholderSrc
    ) {
      return stableMediaStateRef.current.size;
    }

    return effectiveMediaSize;
  }, [effectiveMediaSize, isHoldingPreviousFrame, placeholderSrc]);

  const handleResolvedMediaSize = useCallback((src: string, size: CoverMediaSize) => {
    setMediaSizeSrc((prevSrc) => (prevSrc === src ? prevSrc : src));
    setMediaSize((prev) => {
      if (prev?.width === size.width && prev?.height === size.height) {
        return prev;
      }
      return size;
    });
  }, [setMediaSize]);

  useEffect(() => {
    if (!mediaSrc) {
      setMediaSizeSrc(null);
      setMediaSize(null);
      return;
    }

    if (!cachedMediaSize) {
      if (mediaSizeSrc !== mediaSrc) {
        setMediaSizeSrc(null);
        setMediaSize(null);
      }
      return;
    }

    setMediaSizeSrc(mediaSrc);
    setMediaSize((prev) => {
      if (prev?.width === cachedMediaSize.width && prev?.height === cachedMediaSize.height) {
        return prev;
      }
      return { width: cachedMediaSize.width, height: cachedMediaSize.height };
    });
  }, [cachedMediaSize, mediaSizeSrc, mediaSrc, setMediaSize]);

  return {
    displayCoverHeight,
    effectiveContainerSize,
    effectiveMediaSize,
    placeholderMediaSize,
    handleResolvedMediaSize,
  };
}
