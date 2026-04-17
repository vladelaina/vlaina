import { useCallback, useEffect, type MouseEvent as ReactMouseEvent } from 'react';
import { useWindowDragGesture } from './useWindowDragGesture';

type OutsidePointerEvent = Event & {
  detail?: {
    originalEvent?: MouseEvent;
  };
};

interface UseDialogWindowDragOptions {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  closeOnOutsidePointerUp?: boolean;
  errorLabel?: string;
  outsideDragHandleHeight?: number;
  threshold?: number;
}

const DEFAULT_OUTSIDE_DRAG_HANDLE_HEIGHT = 56;

export function useDialogWindowDrag({
  open,
  onOpenChange,
  closeOnOutsidePointerUp = true,
  errorLabel,
  outsideDragHandleHeight = DEFAULT_OUTSIDE_DRAG_HANDLE_HEIGHT,
  threshold,
}: UseDialogWindowDragOptions) {
  const {
    beginWindowDragTracking,
    isWindowDragActive,
    stopWindowDragTracking,
  } = useWindowDragGesture({ errorLabel, threshold });

  useEffect(() => {
    if (open) return;
    stopWindowDragTracking();
  }, [open, stopWindowDragTracking]);

  const handleInteractOutside = useCallback((event: Event) => {
    if (isWindowDragActive()) {
      event.preventDefault();
    }
  }, [isWindowDragActive]);

  const handlePointerDownOutside = useCallback((event: Event) => {
    const originalEvent = (event as OutsidePointerEvent).detail?.originalEvent;
    if (
      originalEvent &&
      originalEvent.button === 0 &&
      originalEvent.clientY <= outsideDragHandleHeight
    ) {
      event.preventDefault();
      beginWindowDragTracking(
        { x: originalEvent.clientX, y: originalEvent.clientY },
        closeOnOutsidePointerUp ? { onReleaseWithoutDrag: () => onOpenChange(false) } : undefined
      );
      return;
    }

    if (isWindowDragActive()) {
      event.preventDefault();
    }
  }, [
    beginWindowDragTracking,
    closeOnOutsidePointerUp,
    isWindowDragActive,
    onOpenChange,
    outsideDragHandleHeight,
  ]);

  const handleDragHandleMouseDown = useCallback((event: ReactMouseEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    beginWindowDragTracking({ x: event.clientX, y: event.clientY });
  }, [beginWindowDragTracking]);

  return {
    handleDragHandleMouseDown,
    handleInteractOutside,
    handlePointerDownOutside,
    stopWindowDragTracking,
  };
}
