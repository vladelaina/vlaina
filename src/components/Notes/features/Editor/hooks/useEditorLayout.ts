import { useState, useEffect, useMemo } from 'react';
import { GAP_SCALE, CONTENT_MAX_WIDTH, PADDING_DESKTOP, PADDING_MOBILE } from '@/lib/layout';

function calculateGoldenOffset(viewportWidth: number, sidebarWidth: number, isPeeking: boolean): number {
  if (!isPeeking) return 0;

  const contentPadding = viewportWidth >= 768 ? PADDING_DESKTOP : PADDING_MOBILE;
  const actualContainerWidth = Math.min(viewportWidth, CONTENT_MAX_WIDTH);
  const containerLeftEdge = (viewportWidth - actualContainerWidth) / 2;
  const naturalTextLeftEdge = containerLeftEdge + contentPadding;
  const goldenGap = sidebarWidth / GAP_SCALE;
  const safeZoneLimit = sidebarWidth + goldenGap;
  const intrusion = safeZoneLimit - naturalTextLeftEdge;

  return Math.max(0, intrusion);
}

export function useEditorLayout(isPeeking: boolean, peekOffset: number) {
  const [viewportWidth, setViewportWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const contentOffset = useMemo(() => {
    return calculateGoldenOffset(viewportWidth, peekOffset, isPeeking);
  }, [viewportWidth, peekOffset, isPeeking]);

  return { contentOffset, viewportWidth };
}
