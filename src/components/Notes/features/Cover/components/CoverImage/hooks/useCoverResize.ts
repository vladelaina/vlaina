import { useCallback, useEffect, useRef, useState } from 'react';
import { calculateCropPercentage } from '../../../utils/coverUtils';
import {
  buildResizeSnapshot,
} from '../../../utils/coverResizeMath';
import {
  applyFrozenSnapshot,
  hideFrozenImage,
  setContainerHeight,
  setContainerTransitionEnabled,
  setFrozenTop,
  setWrapperVisible,
} from './coverResizeDom';
import { startCoverResizeSession } from './coverResizeSession';

interface UseCoverResizeProps {
  mediaSize: { width: number; height: number } | null;
  effectiveContainerSize: { width: number; height: number } | null;
  zoom: number;
  crop: { x: number; y: number };
  coverHeight: number;
  setCoverHeight: (h: number) => void;
  setCrop: (c: { x: number; y: number }) => void;
  setIsResizing: (resizing: boolean) => void;
  isManualResizingRef: React.MutableRefObject<boolean>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  wrapperRef: React.RefObject<HTMLDivElement | null>;
  onUpdate: (url: string | null, x: number, y: number, h?: number, s?: number) => void;
  url: string | null;
  scale: number;
}

export function useCoverResize({
  mediaSize,
  effectiveContainerSize,
  zoom,
  crop,
  coverHeight,
  setCoverHeight,
  setCrop,
  setIsResizing,
  isManualResizingRef,
  containerRef,
  wrapperRef,
  onUpdate,
  url,
  scale
}: UseCoverResizeProps) {
  const [frozenImageState, setFrozenImageState] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);

  const frozenImgRef = useRef<HTMLImageElement>(null);
  const ignoreCropSyncRef = useRef(false);
  const disposeResizeSessionRef = useRef<(() => void) | null>(null);
  const manualResizeResetTimerRef = useRef<number | null>(null);

  const disposeResizeSession = useCallback(() => {
    if (!disposeResizeSessionRef.current) return;
    disposeResizeSessionRef.current();
    disposeResizeSessionRef.current = null;
  }, []);

  const releaseManualResizeSoon = useCallback(() => {
    if (manualResizeResetTimerRef.current !== null) {
      window.clearTimeout(manualResizeResetTimerRef.current);
      manualResizeResetTimerRef.current = null;
    }
    manualResizeResetTimerRef.current = window.setTimeout(() => {
      isManualResizingRef.current = false;
      manualResizeResetTimerRef.current = null;
    }, 50);
  }, [isManualResizingRef]);

  const resetResizeVisualState = useCallback(() => {
    hideFrozenImage(frozenImgRef.current);
    setWrapperVisible(wrapperRef.current, true);
    setContainerTransitionEnabled(containerRef.current, true);
  }, [containerRef, wrapperRef]);

  useEffect(() => {
    return () => {
      disposeResizeSession();
      resetResizeVisualState();
      if (manualResizeResetTimerRef.current !== null) {
        window.clearTimeout(manualResizeResetTimerRef.current);
        manualResizeResetTimerRef.current = null;
      }
      isManualResizingRef.current = false;
    };
  }, [disposeResizeSession, isManualResizingRef, resetResizeVisualState]);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!mediaSize || !effectiveContainerSize) return;
    disposeResizeSession();

    const snapshot = buildResizeSnapshot(mediaSize, effectiveContainerSize, zoom, crop);

    setFrozenImageState({
      top: snapshot.absoluteTop,
      left: snapshot.absoluteLeft,
      width: snapshot.scaledWidth,
      height: snapshot.scaledHeight
    });

    setIsResizing(true);
    isManualResizingRef.current = true;

    setContainerTransitionEnabled(containerRef.current, false);
    applyFrozenSnapshot(frozenImgRef.current, snapshot);
    setWrapperVisible(wrapperRef.current, false);

    disposeResizeSessionRef.current = startCoverResizeSession({
      startY: e.clientY,
      startHeight: coverHeight,
      snapshot,
      onFrame: ({ effectiveHeight, shiftY }) => {
        setContainerHeight(containerRef.current, effectiveHeight);
        setFrozenTop(frozenImgRef.current, snapshot.absoluteTop + shiftY);
      },
      onCommit: ({ effectiveHeight, finalCrop }) => {
        disposeResizeSessionRef.current = null;
        setIsResizing(false);
        setFrozenImageState(null);
        resetResizeVisualState();
        releaseManualResizeSoon();

        ignoreCropSyncRef.current = true;
        setCoverHeight(effectiveHeight);
        setCrop(finalCrop);

        const tempContainerSize = { width: effectiveContainerSize.width, height: effectiveHeight };
        const percent = calculateCropPercentage(finalCrop, mediaSize, tempContainerSize, zoom);
        const safePctX = Number.isFinite(percent.x) ? percent.x : 50;
        const safePctY = Number.isFinite(percent.y) ? percent.y : 50;

        onUpdate(url, safePctX, safePctY, effectiveHeight, scale);
      },
    });
  }, [
    disposeResizeSession,
    mediaSize,
    effectiveContainerSize,
    zoom,
    crop,
    coverHeight,
    setCoverHeight,
    setCrop,
    setIsResizing,
    isManualResizingRef,
    containerRef,
    wrapperRef,
    resetResizeVisualState,
    releaseManualResizeSoon,
    onUpdate,
    url,
    scale,
  ]);

  return {
    handleResizeMouseDown,
    frozenImageState,
    frozenImgRef,
    ignoreCropSyncRef
  };
}
