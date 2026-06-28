import { useCallback } from 'react';
import { useResizeDragSession, type ResizeDragStartEvent } from './useResizeDragSession';

export interface ResizableBoxSize {
  width: number;
  height: number;
}

export type ResizableBoxEdge =
  | 'left'
  | 'right'
  | 'top'
  | 'bottom'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';

interface UseResizableBoxOptions<TSize extends ResizableBoxSize> {
  size: TSize;
  minSize: ResizableBoxSize;
  maxSize: ResizableBoxSize;
  defaultSize: TSize;
  getMaxSize?: () => ResizableBoxSize;
  onSizeChange: (size: TSize) => void;
  onSizeCommit?: (size: TSize) => void;
  onDragStateChange?: (isDragging: boolean) => void;
  liveUpdateMode?: 'animation-frame' | 'sync';
  useOverlay?: boolean;
  allowDoubleClickReset?: boolean;
}

function clampSize<TSize extends ResizableBoxSize>(
  size: ResizableBoxSize,
  minSize: ResizableBoxSize,
  maxSize: ResizableBoxSize,
): TSize {
  return {
    width: Math.max(minSize.width, Math.min(maxSize.width, Math.round(size.width))),
    height: Math.max(minSize.height, Math.min(maxSize.height, Math.round(size.height))),
  } as TSize;
}

function resolveMaxSize(
  minSize: ResizableBoxSize,
  maxSize: ResizableBoxSize,
  getMaxSize: (() => ResizableBoxSize) | undefined,
): ResizableBoxSize {
  const dynamicMaxSize = getMaxSize?.() ?? maxSize;
  return {
    width: Math.max(minSize.width, Math.min(maxSize.width, dynamicMaxSize.width)),
    height: Math.max(minSize.height, Math.min(maxSize.height, dynamicMaxSize.height)),
  };
}

function sizesEqual(left: ResizableBoxSize, right: ResizableBoxSize): boolean {
  return left.width === right.width && left.height === right.height;
}

function cursorForEdge(edge: ResizableBoxEdge): string {
  switch (edge) {
    case 'left':
    case 'right':
      return 'ew-resize';
    case 'top':
    case 'bottom':
      return 'ns-resize';
    case 'top-right':
    case 'bottom-left':
      return 'nesw-resize';
    case 'top-left':
    case 'bottom-right':
      return 'nwse-resize';
  }
}

export function useResizableBox<TSize extends ResizableBoxSize>({
  size,
  minSize,
  maxSize,
  defaultSize,
  getMaxSize,
  onSizeChange,
  onSizeCommit,
  onDragStateChange,
  liveUpdateMode,
  useOverlay = false,
  allowDoubleClickReset = true,
}: UseResizableBoxOptions<TSize>) {
  const computeNextSize = useCallback(({
    context: edge,
    startValue,
    startClientX,
    startClientY,
    clientX,
    clientY,
  }: {
    context: ResizableBoxEdge;
    startValue: TSize;
    startClientX: number;
    startClientY: number;
    clientX: number;
    clientY: number;
  }) => {
    const adjustsLeft = edge.includes('left');
    const adjustsRight = edge.includes('right');
    const adjustsTop = edge.includes('top');
    const adjustsBottom = edge.includes('bottom');
    const dynamicMaxSize = resolveMaxSize(minSize, maxSize, getMaxSize);

    return clampSize<TSize>({
      width: adjustsLeft
        ? startValue.width + startClientX - clientX
        : adjustsRight
          ? startValue.width + clientX - startClientX
          : startValue.width,
      height: adjustsTop
        ? startValue.height + startClientY - clientY
        : adjustsBottom
          ? startValue.height + clientY - startClientY
          : startValue.height,
    }, minSize, dynamicMaxSize);
  }, [getMaxSize, maxSize, minSize]);

  const {
    isDragging,
    beginDrag,
    resetToDefaultValue,
  } = useResizeDragSession<TSize, ResizableBoxEdge>({
    value: size,
    defaultValue: clampSize<TSize>(defaultSize, minSize, maxSize),
    onValueChange: onSizeChange,
    onValueCommit: onSizeCommit,
    onDragStateChange,
    computeNextValue: computeNextSize,
    valuesEqual: sizesEqual,
    cursor: cursorForEdge,
    eventType: 'pointer',
    listenTarget: 'window',
    liveUpdateMode,
    useOverlay,
    allowDoubleClickReset,
  });

  const handleResizeStart = useCallback((
    edge: ResizableBoxEdge,
    event: ResizeDragStartEvent<HTMLDivElement>,
  ) => {
    event.stopPropagation();
    beginDrag(event, edge);
  }, [beginDrag]);

  return {
    isDragging,
    handleResizeStart,
    resetToDefaultSize: resetToDefaultValue,
  };
}
