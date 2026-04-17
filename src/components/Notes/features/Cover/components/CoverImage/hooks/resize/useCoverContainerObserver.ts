import { useLayoutEffect } from 'react';

interface UseCoverContainerObserverOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  isManualResizingRef: React.MutableRefObject<boolean>;
  setContainerSize: React.Dispatch<React.SetStateAction<{ width: number; height: number } | null>>;
  setIsContainerResizing?: (resizing: boolean) => void;
  observeKey?: string | null;
  suspended?: boolean;
  freezeSizeSync?: boolean;
}

export function useCoverContainerObserver({
  containerRef,
  isManualResizingRef,
  setContainerSize,
  setIsContainerResizing,
  observeKey,
  suspended = false,
  freezeSizeSync = false,
}: UseCoverContainerObserverOptions) {
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let resizeIdleTimer: number | null = null;
    let resizeActive = false;
    let lastObservedWidth = 0;
    let lastObservedHeight = 0;

    const clearResizeIdleTimer = () => {
      if (resizeIdleTimer === null) return;
      window.clearTimeout(resizeIdleTimer);
      resizeIdleTimer = null;
    };

    const scheduleResizeSettled = () => {
      if (!setIsContainerResizing) return;
      if (!resizeActive) {
        resizeActive = true;
      }
      setIsContainerResizing(true);
      clearResizeIdleTimer();
      resizeIdleTimer = window.setTimeout(() => {
        resizeActive = false;
        setIsContainerResizing(false);
        resizeIdleTimer = null;
      }, 96);
    };

    const updateContainerSize = (width: number, height: number, syncState = true) => {
      if (width <= 0 || height <= 0) return;

      if (lastObservedWidth === width && lastObservedHeight === height) {
        return;
      }

      lastObservedWidth = width;
      lastObservedHeight = height;

      if (!syncState) {
        return;
      }

      setContainerSize((prev) => {
        if (prev?.width === width && prev?.height === height) {
          return prev;
        }
        return { width, height };
      });
    };

    const syncContainerSize = () => {
      if (isManualResizingRef.current) return;

      const rect = el.getBoundingClientRect();
      updateContainerSize(Math.round(rect.width), Math.round(rect.height), true);
    };

    const observer = new ResizeObserver((entries) => {
      if (suspended) return;
      if (isManualResizingRef.current) return;

      const entry = entries[entries.length - 1];
      if (!entry) return;

      const roundedWidth = Math.round(entry.contentRect.width);
      const roundedHeight = Math.round(entry.contentRect.height);
      const changed = roundedWidth !== lastObservedWidth || roundedHeight !== lastObservedHeight;

      if (!changed) {
        return;
      }

      scheduleResizeSettled();
      updateContainerSize(roundedWidth, roundedHeight, !freezeSizeSync);
    });

    syncContainerSize();
    observer.observe(el);
    return () => {
      observer.disconnect();
      clearResizeIdleTimer();
      resizeActive = false;
      setIsContainerResizing?.(false);
    };
  }, [containerRef, freezeSizeSync, isManualResizingRef, observeKey, setContainerSize, setIsContainerResizing, suspended]);
}
