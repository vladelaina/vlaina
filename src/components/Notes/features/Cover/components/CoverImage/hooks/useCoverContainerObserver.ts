import { useEffect } from 'react';

interface UseCoverContainerObserverOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  isManualResizingRef: React.MutableRefObject<boolean>;
  setContainerSize: React.Dispatch<React.SetStateAction<{ width: number; height: number } | null>>;
  observeKey?: string | null;
}

export function useCoverContainerObserver({
  containerRef,
  isManualResizingRef,
  setContainerSize,
  observeKey,
}: UseCoverContainerObserverOptions) {
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const syncContainerSize = () => {
      if (isManualResizingRef.current) return;

      const rect = el.getBoundingClientRect();
      const roundedWidth = Math.round(rect.width);
      const roundedHeight = Math.round(rect.height);
      if (roundedWidth <= 0 || roundedHeight <= 0) return;

      setContainerSize((prev) => {
        if (prev?.width === roundedWidth && prev?.height === roundedHeight) {
          return prev;
        }
        return { width: roundedWidth, height: roundedHeight };
      });
    };

    let rafId: number;
    const observer = new ResizeObserver((entries) => {
      if (rafId) cancelAnimationFrame(rafId);

      rafId = requestAnimationFrame(() => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          const roundedWidth = Math.round(width);
          const roundedHeight = Math.round(height);
          if (isManualResizingRef.current) return;
          if (roundedWidth <= 0 || roundedHeight <= 0) return;

          setContainerSize((prev) => {
            if (prev?.width === roundedWidth && prev?.height === roundedHeight) {
              return prev;
            }
            return { width: roundedWidth, height: roundedHeight };
          });
        }
      });
    });

    syncContainerSize();
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [containerRef, isManualResizingRef, setContainerSize, observeKey]);
}
