import { useEffect, type RefObject } from 'react';

export function useOverlayScrollbarWindowDrag(
  isDragging: boolean,
  handleWindowPointerMove: (event: PointerEvent) => void,
  stopDragging: () => void,
): void {
  useEffect(() => {
    if (!isDragging) {
      return;
    }

    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', stopDragging);
    window.addEventListener('pointercancel', stopDragging);

    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', stopDragging);
      window.removeEventListener('pointercancel', stopDragging);
    };
  }, [handleWindowPointerMove, isDragging, stopDragging]);
}

export function useCancelOverlayScrollbarMetricsFrame(
  metricsFrameRef: RefObject<number | null>,
  pendingMetricsForceRenderRef: RefObject<boolean>,
): void {
  useEffect(() => {
    return () => {
      if (metricsFrameRef.current !== null) {
        window.cancelAnimationFrame(metricsFrameRef.current);
        metricsFrameRef.current = null;
      }
      pendingMetricsForceRenderRef.current = false;
    };
  }, [metricsFrameRef, pendingMetricsForceRenderRef]);
}

export function useOverlayScrollbarDraggingClass(
  viewportRef: RefObject<HTMLDivElement | null>,
  draggingBodyClassName: string | undefined,
  isDragging: boolean,
): void {
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    if (isDragging) {
      viewport.dataset.overlayScrollbarDragging = 'true';
      if (draggingBodyClassName) {
        document.body.classList.add(draggingBodyClassName);
      }
      return;
    }

    delete viewport.dataset.overlayScrollbarDragging;
    if (draggingBodyClassName) {
      document.body.classList.remove(draggingBodyClassName);
    }

    return () => {
      delete viewport.dataset.overlayScrollbarDragging;
      if (draggingBodyClassName) {
        document.body.classList.remove(draggingBodyClassName);
      }
    };
  }, [draggingBodyClassName, isDragging, viewportRef]);
}
