import { useEffect, useMemo, useRef, useState } from 'react';
import { calculateTextStats, type TextStats } from '../utils/textStats';

const IMMEDIATE_TEXT_STATS_CHARS = 20_000;
const DEFERRED_TEXT_STATS_DELAY_MS = 180;
const DEFERRED_TEXT_STATS_IDLE_TIMEOUT_MS = 600;

function scheduleDeferredTextStats(callback: () => void): () => void {
  if (typeof window === 'undefined') {
    const timeoutId = setTimeout(callback, DEFERRED_TEXT_STATS_DELAY_MS);
    return () => clearTimeout(timeoutId);
  }

  if (typeof window.requestIdleCallback === 'function') {
    const idleId = window.requestIdleCallback(callback, {
      timeout: DEFERRED_TEXT_STATS_IDLE_TIMEOUT_MS,
    });
    return () => window.cancelIdleCallback?.(idleId);
  }

  const timeoutId = window.setTimeout(callback, DEFERRED_TEXT_STATS_DELAY_MS);
  return () => window.clearTimeout(timeoutId);
}

export function useDeferredTextStats(notePath: string | null | undefined, text: string): TextStats {
  const initialStats = useMemo(() => calculateTextStats(text), [notePath]);
  const [stats, setStats] = useState(initialStats);
  const statsNotePathRef = useRef(notePath);

  useEffect(() => {
    statsNotePathRef.current = notePath;
    setStats(calculateTextStats(text));
  }, [notePath]);

  useEffect(() => {
    if (text.length <= IMMEDIATE_TEXT_STATS_CHARS) {
      setStats(calculateTextStats(text));
      return;
    }

    let cancelled = false;
    const cancelSchedule = scheduleDeferredTextStats(() => {
      if (cancelled) return;
      setStats(calculateTextStats(text));
    });
    return () => {
      cancelled = true;
      cancelSchedule();
    };
  }, [text]);

  useEffect(() => () => {
    statsNotePathRef.current = null;
  }, []);

  if (statsNotePathRef.current !== notePath) {
    return initialStats;
  }

  return stats;
}
