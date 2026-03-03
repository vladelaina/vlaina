import { useCallback, useRef, useState } from 'react';
import { 
  MIN_HEIGHT, 
  MAX_HEIGHT, 
  getBaseDimensions, 
  calculateCropPercentage 
} from '../../../utils/coverUtils';

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

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!mediaSize || !effectiveContainerSize) return;

    const baseDims = getBaseDimensions(mediaSize, effectiveContainerSize);
    const scaledW = baseDims.width * zoom;
    const scaledH = baseDims.height * zoom;

    const absoluteTop = (effectiveContainerSize.height / 2) + crop.y - (scaledH / 2);
    const absoluteLeft = (effectiveContainerSize.width / 2) + crop.x - (scaledW / 2);

    setFrozenImageState({
      top: absoluteTop,
      left: absoluteLeft,
      width: scaledW,
      height: scaledH
    });

    setIsResizing(true);
    isManualResizingRef.current = true;

    const startY = e.clientY;
    const startH = coverHeight;
    const snapTop = absoluteTop;
    const maxVisualH_NoShift = snapTop + scaledH;
    const maxShiftDown = Math.max(0, -snapTop);
    const absMaxMechHeight = maxVisualH_NoShift + maxShiftDown;

    if (containerRef.current) containerRef.current.style.transition = 'none';

    if (frozenImgRef.current) {
      frozenImgRef.current.style.top = `${absoluteTop}px`;
      frozenImgRef.current.style.left = `${absoluteLeft}px`;
      frozenImgRef.current.style.width = `${scaledW}px`;
      frozenImgRef.current.style.height = `${scaledH}px`;
      frozenImgRef.current.style.opacity = '1';
      frozenImgRef.current.style.visibility = 'visible';
    }

    if (wrapperRef.current) {
      wrapperRef.current.style.opacity = '0';
    }

    let rafId: number;

    const onMove = (me: MouseEvent) => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const delta = me.clientY - startY;
        const rawH = startH + delta;
        const limitH = Math.min(MAX_HEIGHT, absMaxMechHeight);
        const effectiveH = Math.max(MIN_HEIGHT, Math.min(limitH, rawH));

        let shiftY = 0;
        if (effectiveH > maxVisualH_NoShift) {
          shiftY = effectiveH - maxVisualH_NoShift;
        }
        shiftY = Math.max(0, Math.min(shiftY, maxShiftDown));

        if (containerRef.current) {
          containerRef.current.style.height = `${effectiveH}px`;
        }
        if (frozenImgRef.current) {
          frozenImgRef.current.style.top = `${snapTop + shiftY}px`;
        }
      });
    };

    const onUp = (me: MouseEvent) => {
      if (rafId) cancelAnimationFrame(rafId);
      const delta = me.clientY - startY;
      const rawH = startH + delta;
      const limitH = Math.min(MAX_HEIGHT, absMaxMechHeight);
      const effectiveH = Math.max(MIN_HEIGHT, Math.min(limitH, rawH));

      let shiftY = 0;
      if (effectiveH > maxVisualH_NoShift) {
        shiftY = effectiveH - maxVisualH_NoShift;
      }
      shiftY = Math.max(0, Math.min(shiftY, maxShiftDown));

      const finalImageTop = snapTop + shiftY;
      const newCropY = finalImageTop - (effectiveH / 2) + (scaledH / 2);
      const newCropX = absoluteLeft - (effectiveContainerSize.width / 2) + (scaledW / 2);

      const maxAbsY = (scaledH - effectiveH) / 2;
      const maxAbsX = (scaledW - effectiveContainerSize.width) / 2;
      const safeCropX = isNaN(newCropX) ? 0 : Math.max(-maxAbsX, Math.min(maxAbsX, newCropX));
      const safeCropY = isNaN(newCropY) ? 0 : Math.max(-maxAbsY, Math.min(maxAbsY, newCropY));
      const finalCrop = { x: safeCropX, y: safeCropY };

      setIsResizing(false);
      setFrozenImageState(null);

      if (frozenImgRef.current) {
        frozenImgRef.current.style.opacity = '0';
        frozenImgRef.current.style.visibility = 'hidden';
      }
      if (wrapperRef.current) {
        wrapperRef.current.style.opacity = '1';
      }

      setTimeout(() => { isManualResizingRef.current = false; }, 50);

      if (containerRef.current) {
        containerRef.current.style.transition = '';
      }

      ignoreCropSyncRef.current = true;
      setCoverHeight(effectiveH);
      setCrop(finalCrop);

      const currentW = effectiveContainerSize.width;
      const tempContainerSize = { width: currentW, height: effectiveH };
      const percent = calculateCropPercentage(finalCrop, mediaSize, tempContainerSize, zoom);
      const safePctX = Number.isFinite(percent.x) ? percent.x : 50;
      const safePctY = Number.isFinite(percent.y) ? percent.y : 50;

      onUpdate(url, safePctX, safePctY, effectiveH, scale);

      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [
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
  ]);

  return {
    handleResizeMouseDown,
    frozenImageState,
    frozenImgRef,
    ignoreCropSyncRef
  };
}
