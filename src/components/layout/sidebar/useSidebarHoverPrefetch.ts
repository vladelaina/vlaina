import { useCallback, useEffect, useRef } from 'react';

const DEFAULT_PREFETCH_DELAY_MS = 140;

interface SidebarHoverPrefetchOptions {
  enabled?: boolean;
  delayMs?: number;
  cancel?: () => void;
}

export function useSidebarHoverPrefetch(
  prefetch: () => void | Promise<void>,
  { enabled = true, delayMs = DEFAULT_PREFETCH_DELAY_MS, cancel }: SidebarHoverPrefetchOptions = {},
) {
  const timerRef = useRef<number | null>(null);
  const prefetchRef = useRef(prefetch);
  prefetchRef.current = prefetch;

  const clearTimer = useCallback(() => {
    if (timerRef.current == null) {
      return;
    }
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const cancelPrefetch = useCallback(() => {
    clearTimer();
    cancel?.();
  }, [cancel, clearTimer]);

  const schedulePrefetch = useCallback(() => {
    if (!enabled) {
      return;
    }

    clearTimer();
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      void prefetchRef.current();
    }, delayMs);
  }, [clearTimer, delayMs, enabled]);

  useEffect(() => cancelPrefetch, [cancelPrefetch]);

  return {
    onMouseEnter: schedulePrefetch,
    onMouseLeave: cancelPrefetch,
  };
}
