import { useCallback, useEffect, useRef } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

interface WindowDragOrigin {
  x: number;
  y: number;
}

interface BeginWindowDragOptions {
  onReleaseWithoutDrag?: () => void;
}

interface UseWindowDragGestureOptions {
  errorLabel?: string;
  threshold?: number;
}

const DEFAULT_WINDOW_DRAG_THRESHOLD = 10;

export function useWindowDragGesture({
  errorLabel = 'window drag',
  threshold = DEFAULT_WINDOW_DRAG_THRESHOLD,
}: UseWindowDragGestureOptions = {}) {
  const dragTrackingRef = useRef(false);
  const windowDraggingRef = useRef(false);
  const dragStartRef = useRef<WindowDragOrigin>({ x: 0, y: 0 });
  const dragCleanupRef = useRef<(() => void) | null>(null);

  const stopWindowDragTracking = useCallback(() => {
    dragCleanupRef.current?.();
    dragCleanupRef.current = null;
    dragTrackingRef.current = false;
    windowDraggingRef.current = false;
  }, []);

  const startWindowDrag = useCallback(async () => {
    dragTrackingRef.current = false;
    windowDraggingRef.current = true;

    try {
      await getCurrentWindow().startDragging();
    } catch (error) {
      console.error(`Failed to start ${errorLabel}`, error);
    } finally {
      windowDraggingRef.current = false;
    }
  }, [errorLabel]);

  const beginWindowDragTracking = useCallback((
    origin: WindowDragOrigin,
    options?: BeginWindowDragOptions
  ) => {
    dragCleanupRef.current?.();
    dragTrackingRef.current = true;
    windowDraggingRef.current = false;
    dragStartRef.current = origin;

    const cleanupListeners = () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
      if (dragCleanupRef.current === cleanupListeners) {
        dragCleanupRef.current = null;
      }
    };

    const handleWindowMouseMove = (moveEvent: MouseEvent) => {
      if (!dragTrackingRef.current || windowDraggingRef.current || (moveEvent.buttons & 1) !== 1) {
        return;
      }

      const dx = moveEvent.clientX - dragStartRef.current.x;
      const dy = moveEvent.clientY - dragStartRef.current.y;
      if (Math.abs(dx) <= threshold && Math.abs(dy) <= threshold) {
        return;
      }

      cleanupListeners();
      void startWindowDrag();
    };

    const handleWindowMouseUp = () => {
      const releasedWithoutDrag = dragTrackingRef.current && !windowDraggingRef.current;
      cleanupListeners();
      stopWindowDragTracking();
      if (releasedWithoutDrag) {
        options?.onReleaseWithoutDrag?.();
      }
    };

    dragCleanupRef.current = cleanupListeners;
    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
  }, [startWindowDrag, stopWindowDragTracking, threshold]);

  const isWindowDragActive = useCallback(() => {
    return dragTrackingRef.current || windowDraggingRef.current;
  }, []);

  useEffect(() => {
    return stopWindowDragTracking;
  }, [stopWindowDragTracking]);

  return {
    beginWindowDragTracking,
    isWindowDragActive,
    stopWindowDragTracking,
  };
}
