import { useCallback, useEffect, useRef } from 'react';

const DEFAULT_PREFETCH_DELAY_MS = 140;

interface SidebarHoverPrefetchOptions {
  enabled?: boolean;
  delayMs?: number;
}

export function useSidebarHoverPrefetch(
  prefetch: () => void | Promise<void>,
  { enabled = true, delayMs = DEFAULT_PREFETCH_DELAY_MS }: SidebarHoverPrefetchOptions = {},
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

  useEffect(() => clearTimer, [clearTimer]);

  return {
    onMouseEnter: schedulePrefetch,
    onMouseLeave: clearTimer,
  };
}
