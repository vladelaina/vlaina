const AUTO_SCROLL_EDGE_PX = 56;
const AUTO_SCROLL_MAX_STEP_PX = 18;

export interface VerticalEdgeAutoScrollHandle {
  start: () => void;
  stop: () => void;
}

interface CreateVerticalEdgeAutoScrollOptions {
  scrollRoot: HTMLElement | null;
  getPointerY: () => number | null;
  onScroll: () => void;
}

export function resolveVerticalEdgeAutoScrollDelta(
  pointerY: number,
  scrollRootRect: Pick<DOMRect, 'top' | 'bottom'>,
): number {
  if (pointerY < scrollRootRect.top + AUTO_SCROLL_EDGE_PX) {
    const distanceIntoEdge = scrollRootRect.top + AUTO_SCROLL_EDGE_PX - pointerY;
    const intensity = Math.min(distanceIntoEdge, AUTO_SCROLL_EDGE_PX) / AUTO_SCROLL_EDGE_PX;
    return -Math.ceil(intensity * AUTO_SCROLL_MAX_STEP_PX);
  }

  if (pointerY > scrollRootRect.bottom - AUTO_SCROLL_EDGE_PX) {
    const distanceIntoEdge = pointerY - (scrollRootRect.bottom - AUTO_SCROLL_EDGE_PX);
    const intensity = Math.min(distanceIntoEdge, AUTO_SCROLL_EDGE_PX) / AUTO_SCROLL_EDGE_PX;
    return Math.ceil(intensity * AUTO_SCROLL_MAX_STEP_PX);
  }

  return 0;
}

export function createVerticalEdgeAutoScroll(
  options: CreateVerticalEdgeAutoScrollOptions,
): VerticalEdgeAutoScrollHandle {
  const { scrollRoot, getPointerY, onScroll } = options;
  let rafId = 0;
  let active = false;

  const runFrame = () => {
    rafId = 0;
    if (!active || !scrollRoot) return;

    const pointerY = getPointerY();
    if (pointerY !== null) {
      const deltaY = resolveVerticalEdgeAutoScrollDelta(
        pointerY,
        scrollRoot.getBoundingClientRect(),
      );
      if (deltaY !== 0) {
        const previousScrollTop = scrollRoot.scrollTop;
        scrollRoot.scrollTop = previousScrollTop + deltaY;
        if (scrollRoot.scrollTop !== previousScrollTop) {
          onScroll();
        }
      }
    }

    rafId = window.requestAnimationFrame(runFrame);
  };

  return {
    start() {
      if (!scrollRoot || active) return;
      active = true;
      rafId = window.requestAnimationFrame(runFrame);
    },
    stop() {
      active = false;
      if (rafId !== 0) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
      }
    },
  };
}
