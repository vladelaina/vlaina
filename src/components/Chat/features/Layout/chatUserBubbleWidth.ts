import {
  measureTextLineCount,
  measureTextWrapStats,
} from '@/lib/text-layout';
import { getChatContentWidth, normalizeChatContainerWidth } from './chatWidthBuckets';
import {
  BODY_FONT,
  BODY_LINE_HEIGHT,
} from './chatAssistantMarkdownTheme';

const USER_BUBBLE_MAX_RATIO = 0.9;
const USER_BUBBLE_PADDING_X = 32;
const widthCache = new Map<string, number>();
const WIDTH_CACHE_LIMIT = 800;

function setWidthCacheEntry(key: string, width: number): void {
  if (widthCache.has(key)) {
    widthCache.delete(key);
  } else if (widthCache.size >= WIDTH_CACHE_LIMIT) {
    const oldestKey = widthCache.keys().next().value;
    if (oldestKey !== undefined) {
      widthCache.delete(oldestKey);
    }
  }

  widthCache.set(key, width);
}

export function resolveUserMessageBubbleWidth(text: string, containerWidth: number): number | null {
  if (!text.trim() || containerWidth <= 0) {
    return null;
  }

  const normalizedWidth = normalizeChatContainerWidth(containerWidth);
  const cacheKey = `${normalizedWidth}\u0000${text}`;
  const cachedWidth = widthCache.get(cacheKey);
  if (cachedWidth !== undefined) {
    widthCache.delete(cacheKey);
    widthCache.set(cacheKey, cachedWidth);
    return cachedWidth;
  }

  const maxBubbleWidth = Math.max(1, Math.floor(getChatContentWidth(normalizedWidth) * USER_BUBBLE_MAX_RATIO));
  const maxTextWidth = Math.max(1, maxBubbleWidth - USER_BUBBLE_PADDING_X);
  const measurementOptions = {
    font: BODY_FONT,
    lineHeight: BODY_LINE_HEIGHT,
    prepareOptions: { whiteSpace: 'pre-wrap' as const },
  };
  const initialMetrics = measureTextWrapStats(text, maxTextWidth, measurementOptions);

  if (initialMetrics.lineCount <= 1) {
    const width = Math.min(maxBubbleWidth, Math.ceil(initialMetrics.maxLineWidth) + USER_BUBBLE_PADDING_X);
    setWidthCacheEntry(cacheKey, width);
    return width;
  }

  let low = 1;
  let high = Math.max(1, Math.ceil(maxTextWidth));

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const midLineCount = measureTextLineCount(text, mid, measurementOptions);
    if (midLineCount <= initialMetrics.lineCount) {
      high = mid;
    } else {
      low = mid + 1;
    }
  }

  const tightMetrics = measureTextWrapStats(text, low, measurementOptions);
  const width = Math.min(maxBubbleWidth, Math.ceil(tightMetrics.maxLineWidth) + USER_BUBBLE_PADDING_X);
  setWidthCacheEntry(cacheKey, width);
  return width;
}
