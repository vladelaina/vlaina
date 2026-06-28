import { useCallback } from 'react';
import { themeDomStyleTokens } from '@/styles/themeTokens';
import { useResizeDragSession, type ResizeDragStartEvent } from './useResizeDragSession';

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
  liveUpdateMode?: 'animation-frame' | 'sync';
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
  liveUpdateMode,
  useOverlay = false,
  allowDoubleClickReset = true,
}: UseResizableDividerOptions) {
  const computeNextWidth = useCallback(({
    startValue,
    startClientX,
    clientX,
  }: {
    startValue: number;
    startClientX: number;
    clientX: number;
  }) => {
    const delta = clientX - startClientX;
    let nextWidth = direction === 'reverse'
      ? startValue - delta
      : startValue + delta;

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

    return clampWidth(nextWidth, minWidth, maxWidth);
  }, [direction, maxWidth, minWidth, snap]);

  const {
    isDragging,
    beginDrag,
    resetToDefaultValue,
  } = useResizeDragSession<number>({
    value: width,
    defaultValue: clampWidth(defaultWidth, minWidth, maxWidth),
    onValueChange: onWidthChange,
    onValueCommit: onWidthCommit,
    onDragStateChange,
    computeNextValue: computeNextWidth,
    cursor: themeDomStyleTokens.cursorColumnResize,
    eventType: 'mouse',
    listenTarget: 'document',
    liveUpdateMode,
    useOverlay,
    allowDoubleClickReset,
  });

  const handleDragStart = useCallback((event: ResizeDragStartEvent) => {
    beginDrag(event);
  }, [beginDrag]);

  return {
    isDragging,
    handleDragStart,
    resetToDefaultWidth: resetToDefaultValue,
  };
}
