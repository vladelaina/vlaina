export const VERTICAL_EDGE_AUTO_SCROLL_EDGE_PX = 96;
export const VERTICAL_EDGE_AUTO_SCROLL_MAX_STEP_PX = 42;
const VERTICAL_EDGE_AUTO_SCROLL_CURVE_POWER = 1.15;

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
  const distanceFromTop = pointerY - scrollRootRect.top;
  const distanceFromBottom = scrollRootRect.bottom - pointerY;
  if (
    distanceFromTop < VERTICAL_EDGE_AUTO_SCROLL_EDGE_PX &&
    distanceFromTop < distanceFromBottom
  ) {
    const distanceIntoEdge = VERTICAL_EDGE_AUTO_SCROLL_EDGE_PX - distanceFromTop;
    const intensity = Math.min(distanceIntoEdge, VERTICAL_EDGE_AUTO_SCROLL_EDGE_PX) / VERTICAL_EDGE_AUTO_SCROLL_EDGE_PX;
    return -Math.ceil(
      (intensity ** VERTICAL_EDGE_AUTO_SCROLL_CURVE_POWER) * VERTICAL_EDGE_AUTO_SCROLL_MAX_STEP_PX
    );
  }

  if (
    distanceFromBottom < VERTICAL_EDGE_AUTO_SCROLL_EDGE_PX &&
    distanceFromBottom < distanceFromTop
  ) {
    const distanceIntoEdge = VERTICAL_EDGE_AUTO_SCROLL_EDGE_PX - distanceFromBottom;
    const intensity = Math.min(distanceIntoEdge, VERTICAL_EDGE_AUTO_SCROLL_EDGE_PX) / VERTICAL_EDGE_AUTO_SCROLL_EDGE_PX;
    return Math.ceil(
      (intensity ** VERTICAL_EDGE_AUTO_SCROLL_CURVE_POWER) * VERTICAL_EDGE_AUTO_SCROLL_MAX_STEP_PX
    );
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
