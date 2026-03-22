import { useCallback, useEffect, useRef, useState } from 'react';
import { calculateCropPercentage } from '../../../utils/coverUtils';
import {
  buildResizeSnapshot,
  calculateResizedScale,
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
  setZoom: (zoom: number) => void;
  setIsResizing: (resizing: boolean) => void;
  isManualResizingRef: React.MutableRefObject<boolean>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  wrapperRef: React.RefObject<HTMLDivElement | null>;
  onUpdate: (url: string | null, x: number, y: number, h?: number, s?: number) => void;
  url: string | null;
}

export function useCoverResize({
  mediaSize,
  effectiveContainerSize,
  zoom,
  crop,
  coverHeight,
  setCoverHeight,
  setCrop,
  setZoom,
  setIsResizing,
  isManualResizingRef,
  containerRef,
  wrapperRef,
  onUpdate,
  url,
}: UseCoverResizeProps) {
  const [frozenImageState, setFrozenImageState] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);
  const [isResizeSettling, setIsResizeSettling] = useState(false);

  const frozenImgRef = useRef<HTMLImageElement>(null);
  const ignoreCropSyncRef = useRef(false);
  const disposeResizeSessionRef = useRef<(() => void) | null>(null);
  const manualResizeResetTimerRef = useRef<number | null>(null);
  const resizeSettleRafRef = useRef<number | null>(null);
  const resizeFinishRafRef = useRef<number | null>(null);

  const disposeResizeSession = useCallback(() => {
    if (!disposeResizeSessionRef.current) return;
    disposeResizeSessionRef.current();
    disposeResizeSessionRef.current = null;
  }, []);

  const clearResizeSettleFrames = useCallback(() => {
    if (resizeSettleRafRef.current !== null) {
      cancelAnimationFrame(resizeSettleRafRef.current);
      resizeSettleRafRef.current = null;
    }
    if (resizeFinishRafRef.current !== null) {
      cancelAnimationFrame(resizeFinishRafRef.current);
      resizeFinishRafRef.current = null;
    }
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
      clearResizeSettleFrames();
      resetResizeVisualState();
      if (manualResizeResetTimerRef.current !== null) {
        window.clearTimeout(manualResizeResetTimerRef.current);
        manualResizeResetTimerRef.current = null;
      }
      isManualResizingRef.current = false;
    };
  }, [clearResizeSettleFrames, disposeResizeSession, isManualResizingRef, resetResizeVisualState]);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!mediaSize || !effectiveContainerSize) return;
    disposeResizeSession();
    clearResizeSettleFrames();
    setIsResizeSettling(false);

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

        ignoreCropSyncRef.current = true;
        setCoverHeight(effectiveHeight);
        setCrop(finalCrop);

        const tempContainerSize = { width: effectiveContainerSize.width, height: effectiveHeight };
        const nextScale = calculateResizedScale(snapshot, mediaSize, tempContainerSize);
        const percent = calculateCropPercentage(finalCrop, mediaSize, tempContainerSize, nextScale);
        const safePctX = Number.isFinite(percent.x) ? percent.x : 50;
        const safePctY = Number.isFinite(percent.y) ? percent.y : 50;
        setZoom(nextScale);

        onUpdate(url, safePctX, safePctY, effectiveHeight, nextScale);

        setIsResizeSettling(true);
        resizeSettleRafRef.current = requestAnimationFrame(() => {
          resizeSettleRafRef.current = null;
          setIsResizing(false);
          resizeFinishRafRef.current = requestAnimationFrame(() => {
            resizeFinishRafRef.current = null;
            setIsResizeSettling(false);
            setFrozenImageState(null);
            resetResizeVisualState();
            releaseManualResizeSoon();
          });
        });
      },
    });
  }, [
    clearResizeSettleFrames,
    disposeResizeSession,
    mediaSize,
    effectiveContainerSize,
    zoom,
    crop,
    coverHeight,
    setCoverHeight,
    setCrop,
    setZoom,
    setIsResizing,
    isManualResizingRef,
    containerRef,
    wrapperRef,
    resetResizeVisualState,
    releaseManualResizeSoon,
    onUpdate,
    url,
  ]);

  return {
    handleResizeMouseDown,
    isResizeSettling,
    frozenImageState,
    frozenImgRef,
    ignoreCropSyncRef
  };
}
