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
  getMaxWidth?: () => number;
  defaultWidth: number;
  getDefaultWidth?: () => number;
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

function resolveMaxWidth(
  minWidth: number,
  maxWidth: number,
  getMaxWidth: (() => number) | undefined,
): number {
  const dynamicMaxWidth = getMaxWidth?.() ?? maxWidth;
  return Math.max(minWidth, Math.min(maxWidth, dynamicMaxWidth));
}

export function useResizableDivider({
  width,
  minWidth,
  maxWidth,
  getMaxWidth,
  defaultWidth,
  getDefaultWidth,
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
    const effectiveMaxWidth = resolveMaxWidth(minWidth, maxWidth, getMaxWidth);

    if (snap) {
      const { threshold, resistance } = snap;
      if (nextWidth < minWidth + threshold) {
        const overMin = minWidth - nextWidth;
        if (overMin > 0) nextWidth = minWidth - (overMin * resistance);
      } else if (nextWidth > effectiveMaxWidth - threshold) {
        const overMax = nextWidth - effectiveMaxWidth;
        if (overMax > 0) nextWidth = effectiveMaxWidth + (overMax * resistance);
      }
    }

    return clampWidth(nextWidth, minWidth, effectiveMaxWidth);
  }, [direction, getMaxWidth, maxWidth, minWidth, snap]);

  const {
    isDragging,
    beginDrag,
    resetToDefaultValue,
  } = useResizeDragSession<number>({
    value: width,
    defaultValue: clampWidth(defaultWidth, minWidth, resolveMaxWidth(minWidth, maxWidth, getMaxWidth)),
    getDefaultValue: getDefaultWidth
      ? () => clampWidth(
          getDefaultWidth(),
          minWidth,
          resolveMaxWidth(minWidth, maxWidth, getMaxWidth),
        )
      : undefined,
    onValueChange: onWidthChange,
    onValueCommit: onWidthCommit,
    onDragStateChange,
    computeNextValue: computeNextWidth,
    cursor: themeDomStyleTokens.cursorColumnResize,
    eventType: 'mouse',
    listenTarget: 'document',
    liveUpdateMode,
    useOverlay,
    allowDoubleClickReset: false,
  });

  const handleDragStart = useCallback((event: ResizeDragStartEvent) => {
    if (allowDoubleClickReset && event.detail === 2) {
      event.preventDefault();
      return;
    }
    beginDrag(event);
  }, [allowDoubleClickReset, beginDrag]);

  const handleDoubleClick = useCallback((event: ResizeDragStartEvent) => {
    event.preventDefault();
    resetToDefaultValue();
  }, [resetToDefaultValue]);

  return {
    isDragging,
    handleDragStart,
    handleDoubleClick: allowDoubleClickReset ? handleDoubleClick : undefined,
    resetToDefaultWidth: resetToDefaultValue,
  };
}
