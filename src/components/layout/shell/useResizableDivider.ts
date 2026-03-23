import { useCallback, useEffect, useRef, useState } from 'react';

export interface ResizableSnapOptions {
  threshold: number;
  resistance: number;
}

interface UseResizableDividerOptions {
  width: number;
  minWidth: number;
  maxWidth: number;
  defaultWidth: number;
  onWidthChange: (width: number) => void;
  onWidthCommit?: (width: number) => void;
  onDragStateChange?: (isDragging: boolean) => void;
  direction?: 'normal' | 'reverse';
  snap?: ResizableSnapOptions;
  useOverlay?: boolean;
  allowDoubleClickReset?: boolean;
}

function clampWidth(width: number, minWidth: number, maxWidth: number): number {
  return Math.max(minWidth, Math.min(maxWidth, width));
}

export function useResizableDivider({
  width,
  minWidth,
  maxWidth,
  defaultWidth,
  onWidthChange,
  onWidthCommit,
  onDragStateChange,
  direction = 'normal',
  snap,
  useOverlay = false,
  allowDoubleClickReset = true,
}: UseResizableDividerOptions) {
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);
  const currentWidthRef = useRef(width);
  const pendingWidth = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const didCreateOverlayRef = useRef(false);
  const dragStateRef = useRef(false);

  const notifyDragState = useCallback((next: boolean) => {
    if (dragStateRef.current === next) {
      return;
    }
    dragStateRef.current = next;
    onDragStateChange?.(next);
  }, [onDragStateChange]);

  useEffect(() => {
    if (!isDragging) {
      currentWidthRef.current = width;
    }
  }, [isDragging, width]);

  const applyDefaultWidth = useCallback(() => {
    const nextWidth = clampWidth(defaultWidth, minWidth, maxWidth);
    currentWidthRef.current = nextWidth;
    onWidthChange(nextWidth);
    onWidthCommit?.(nextWidth);
  }, [defaultWidth, maxWidth, minWidth, onWidthChange, onWidthCommit]);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();

    if (allowDoubleClickReset && e.detail === 2) {
      applyDefaultWidth();
      return;
    }

    dragStartX.current = e.clientX;
    dragStartWidth.current = width;
    currentWidthRef.current = width;
    setIsDragging(true);
    notifyDragState(true);

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    if (!useOverlay) return;

    const overlay = document.createElement('div');
    overlay.id = 'resize-overlay';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.zIndex = '99999';
    overlay.style.cursor = 'col-resize';
    document.body.appendChild(overlay);
    didCreateOverlayRef.current = true;
  }, [allowDoubleClickReset, applyDefaultWidth, notifyDragState, useOverlay, width]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - dragStartX.current;
      let nextWidth = direction === 'reverse'
        ? dragStartWidth.current - delta
        : dragStartWidth.current + delta;

      if (snap) {
        const { threshold, resistance } = snap;
        if (nextWidth < minWidth + threshold) {
          const overMin = minWidth - nextWidth;
          if (overMin > 0) nextWidth = minWidth - (overMin * resistance);
        } else if (nextWidth > maxWidth - threshold) {
          const overMax = nextWidth - maxWidth;
          if (overMax > 0) nextWidth = maxWidth + (overMax * resistance);
        }
      }

      nextWidth = clampWidth(nextWidth, minWidth, maxWidth);
      currentWidthRef.current = nextWidth;
      pendingWidth.current = nextWidth;

      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        if (pendingWidth.current !== null) {
          onWidthChange(pendingWidth.current);
          pendingWidth.current = null;
        }
        rafRef.current = null;
      });
    };

    const clearDraggingStyle = () => {
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    const handleMouseUp = () => {
      let committedWidth = currentWidthRef.current;

      if (pendingWidth.current !== null) {
        committedWidth = pendingWidth.current;
        onWidthChange(committedWidth);
        pendingWidth.current = null;
      }

      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      if (didCreateOverlayRef.current) {
        document.getElementById('resize-overlay')?.remove();
        didCreateOverlayRef.current = false;
      }

      clearDraggingStyle();
      setIsDragging(false);
      notifyDragState(false);
      onWidthCommit?.(committedWidth);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleMouseUp();
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('blur', handleMouseUp);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('blur', handleMouseUp);
      document.removeEventListener('visibilitychange', handleVisibilityChange);

      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      if (didCreateOverlayRef.current) {
        document.getElementById('resize-overlay')?.remove();
        didCreateOverlayRef.current = false;
      }

      clearDraggingStyle();
      notifyDragState(false);
    };
  }, [direction, isDragging, maxWidth, minWidth, notifyDragState, onWidthChange, onWidthCommit, snap]);

  return {
    isDragging,
    handleDragStart,
    resetToDefaultWidth: applyDefaultWidth,
  };
}
