import {
  layout,
  prepareWithSegments,
  walkLineRanges,
  type PreparedTextWithSegments,
} from '@/lib/text-layout';
import { getChatContentWidth, normalizeChatContainerWidth } from './chatWidthBuckets';
import {
  BODY_FONT,
  BODY_LINE_HEIGHT,
} from './chatAssistantMarkdownTheme';

const USER_BUBBLE_MAX_RATIO = 0.9;
const USER_BUBBLE_PADDING_X = 32;
const preparedCache = new Map<string, PreparedTextWithSegments>();
const widthCache = new Map<string, number>();
const PREPARED_CACHE_LIMIT = 300;
const WIDTH_CACHE_LIMIT = 800;

function setPreparedCacheEntry(text: string, prepared: PreparedTextWithSegments): void {
  if (preparedCache.has(text)) {
    preparedCache.delete(text);
  } else if (preparedCache.size >= PREPARED_CACHE_LIMIT) {
    const oldestKey = preparedCache.keys().next().value;
    if (oldestKey !== undefined) {
      preparedCache.delete(oldestKey);
    }
  }

  preparedCache.set(text, prepared);
}

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

function getPreparedText(text: string): PreparedTextWithSegments {
  const cached = preparedCache.get(text);
  if (cached) {
    return cached;
  }

  const prepared = prepareWithSegments(text, BODY_FONT, {
    whiteSpace: 'pre-wrap',
  });
  setPreparedCacheEntry(text, prepared);
  return prepared;
}

function collectWrapMetrics(
  prepared: PreparedTextWithSegments,
  maxWidth: number,
): {
  lineCount: number;
  maxLineWidth: number;
} {
  let maxLineWidth = 0;
  const lineCount = walkLineRanges(prepared, maxWidth, (line) => {
    if (line.width > maxLineWidth) {
      maxLineWidth = line.width;
    }
  });

  return {
    lineCount,
    maxLineWidth,
  };
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
  const prepared = getPreparedText(text);
  const initialMetrics = collectWrapMetrics(prepared, maxTextWidth);

  if (initialMetrics.lineCount <= 1) {
    const width = Math.min(maxBubbleWidth, Math.ceil(initialMetrics.maxLineWidth) + USER_BUBBLE_PADDING_X);
    setWidthCacheEntry(cacheKey, width);
    return width;
  }

  let low = 1;
  let high = Math.max(1, Math.ceil(maxTextWidth));

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const midLineCount = layout(prepared, mid, BODY_LINE_HEIGHT).lineCount;
    if (midLineCount <= initialMetrics.lineCount) {
      high = mid;
    } else {
      low = mid + 1;
    }
  }

  const tightMetrics = collectWrapMetrics(prepared, low);
  const width = Math.min(maxBubbleWidth, Math.ceil(tightMetrics.maxLineWidth) + USER_BUBBLE_PADDING_X);
  setWidthCacheEntry(cacheKey, width);
  return width;
}
