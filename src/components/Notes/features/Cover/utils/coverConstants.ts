import { themeCoverLayoutTokens } from '@/styles/themeTokens';

export const MIN_HEIGHT = themeCoverLayoutTokens.minHeightPx;
export const MAX_HEIGHT = themeCoverLayoutTokens.maxHeightPx;
export const DEFAULT_POSITION_PERCENT = 50;
export const DEFAULT_SCALE = themeCoverLayoutTokens.minScale;
export const MAX_SCALE = themeCoverLayoutTokens.maxScale;
export const DRAG_THRESHOLD = 5;
export const SAVE_DEBOUNCE_MS = 200;

export function resolveDefaultCoverHeight(
  viewportHeight = typeof window === 'undefined'
    ? themeCoverLayoutTokens.fallbackViewportHeightPx
    : window.innerHeight,
) {
  const proportionalHeight = Math.round(
    viewportHeight * themeCoverLayoutTokens.defaultViewportHeightRatio,
  );
  return Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, proportionalHeight));
}
