import { useLayoutEffect } from 'react';
import { resolveDefaultCoverHeight } from '../../../../utils/coverConstants';

const COVER_VIEWPORT_SELECTOR = '[data-note-cover-viewport="true"]';

interface UseAutomaticCoverHeightProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  enabled: boolean;
  observeKey: string;
  setCoverHeight: (height: number) => void;
}

export function useAutomaticCoverHeight({
  containerRef,
  enabled,
  observeKey,
  setCoverHeight,
}: UseAutomaticCoverHeightProps) {
  useLayoutEffect(() => {
    if (!enabled) return;

    const viewport = containerRef.current?.closest<HTMLElement>(COVER_VIEWPORT_SELECTOR);
    if (!viewport) return;

    const syncHeight = () => {
      if (viewport.clientHeight <= 0) return;
      setCoverHeight(resolveDefaultCoverHeight(viewport.clientHeight));
    };

    syncHeight();
    if (typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(syncHeight);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [containerRef, enabled, observeKey, setCoverHeight]);
}
