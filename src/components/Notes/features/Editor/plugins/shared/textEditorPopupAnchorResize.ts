export function createTextEditorPopupAnchorResizeTracker(args: {
  resolveAnchor: () => HTMLElement | null;
  onAnchorResize: () => void;
}) {
  let observedAnchor: HTMLElement | null = null;
  let observer: ResizeObserver | null = null;
  let pendingFrame: number | null = null;

  const scheduleResize = () => {
    if (typeof window === 'undefined') {
      args.onAnchorResize();
      return;
    }

    if (pendingFrame !== null) {
      window.cancelAnimationFrame(pendingFrame);
    }

    pendingFrame = window.requestAnimationFrame(() => {
      pendingFrame = null;
      args.onAnchorResize();
    });
  };

  const ensureObserver = () => {
    if (observer || typeof ResizeObserver === 'undefined') {
      return observer;
    }

    observer = new ResizeObserver(scheduleResize);
    return observer;
  };

  return {
    update() {
      const nextAnchor = args.resolveAnchor();
      if (nextAnchor === observedAnchor) {
        return;
      }

      observer?.disconnect();
      observedAnchor = nextAnchor;

      if (nextAnchor) {
        ensureObserver()?.observe(nextAnchor);
      }
    },
    scheduleResize,
    destroy() {
      observer?.disconnect();
      observer = null;
      observedAnchor = null;

      if (pendingFrame !== null && typeof window !== 'undefined') {
        window.cancelAnimationFrame(pendingFrame);
      }
      pendingFrame = null;
    },
  };
}
