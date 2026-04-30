import {
  layout,
  measureNaturalWidth,
  prepare,
  prepareWithSegments,
  walkLineRanges,
  type PrepareOptions,
  type PreparedText,
  type PreparedTextWithSegments,
} from './pretext/layout';

export interface TextLayoutMetrics {
  font: string;
  lineHeight: number;
}

export interface ElementTextLayoutMetrics extends TextLayoutMetrics {
  fontSize: number;
  paddingBlock: number;
}

export interface TextBlockMeasureOptions extends TextLayoutMetrics {
  maxHeight?: number;
  minHeight?: number;
  prepareOptions?: PrepareOptions;
}

export interface TextWrapStats {
  lineCount: number;
  maxLineWidth: number;
}

const preparedCache = new Map<string, PreparedText>();
const preparedSegmentsCache = new Map<string, PreparedTextWithSegments>();
const PREPARED_CACHE_LIMIT = 500;
const DEFAULT_FONT_FAMILY = 'Inter, -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif';
const DEFAULT_FONT_SIZE = 15;
const DEFAULT_LINE_HEIGHT_RATIO = 1.6;

function setPreparedCacheEntry(cacheKey: string, prepared: PreparedText): void {
  if (preparedCache.has(cacheKey)) {
    preparedCache.delete(cacheKey);
  } else if (preparedCache.size >= PREPARED_CACHE_LIMIT) {
    const oldestKey = preparedCache.keys().next().value;
    if (oldestKey !== undefined) {
      preparedCache.delete(oldestKey);
    }
  }

  preparedCache.set(cacheKey, prepared);
}

function setPreparedSegmentsCacheEntry(
  cacheKey: string,
  prepared: PreparedTextWithSegments,
): void {
  if (preparedSegmentsCache.has(cacheKey)) {
    preparedSegmentsCache.delete(cacheKey);
  } else if (preparedSegmentsCache.size >= PREPARED_CACHE_LIMIT) {
    const oldestKey = preparedSegmentsCache.keys().next().value;
    if (oldestKey !== undefined) {
      preparedSegmentsCache.delete(oldestKey);
    }
  }

  preparedSegmentsCache.set(cacheKey, prepared);
}

function getPreparedText(
  text: string,
  font: string,
  options: PrepareOptions | undefined,
): PreparedText {
  const whiteSpace = options?.whiteSpace ?? 'normal';
  const wordBreak = options?.wordBreak ?? 'normal';
  const letterSpacing = options?.letterSpacing ?? 0;
  const cacheKey = `${font}\u0000${whiteSpace}\u0000${wordBreak}\u0000${letterSpacing}\u0000${text}`;
  const cached = preparedCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const prepared = prepare(text, font, options);
  setPreparedCacheEntry(cacheKey, prepared);
  return prepared;
}

function getPreparedTextWithSegments(
  text: string,
  font: string,
  options: PrepareOptions | undefined,
): PreparedTextWithSegments {
  const whiteSpace = options?.whiteSpace ?? 'normal';
  const wordBreak = options?.wordBreak ?? 'normal';
  const letterSpacing = options?.letterSpacing ?? 0;
  const cacheKey = `${font}\u0000${whiteSpace}\u0000${wordBreak}\u0000${letterSpacing}\u0000${text}`;
  const cached = preparedSegmentsCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const prepared = prepareWithSegments(text, font, options);
  setPreparedSegmentsCacheEntry(cacheKey, prepared);
  return prepared;
}

function clampHeight(height: number, minHeight?: number, maxHeight?: number): number {
  const min = minHeight ?? 0;
  const max = maxHeight ?? Number.POSITIVE_INFINITY;
  return Math.max(min, Math.min(max, height));
}

function parsePixelValue(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function resolveElementTextLayoutMetrics(element: HTMLElement): ElementTextLayoutMetrics {
  const styles = window.getComputedStyle(element);
  const fontSize = parsePixelValue(styles.fontSize) ?? DEFAULT_FONT_SIZE;
  const lineHeight =
    parsePixelValue(styles.lineHeight) ?? Math.round(fontSize * DEFAULT_LINE_HEIGHT_RATIO);
  const paddingTop = parsePixelValue(styles.paddingTop) ?? 0;
  const paddingBottom = parsePixelValue(styles.paddingBottom) ?? 0;
  const fontStyle = styles.fontStyle || 'normal';
  const fontWeight = styles.fontWeight || '400';
  const fontSizeToken = `${fontSize}px`;
  const fontFamily = styles.fontFamily || DEFAULT_FONT_FAMILY;

  return {
    font: `${fontStyle} ${fontWeight} ${fontSizeToken} ${fontFamily}`,
    fontSize,
    lineHeight,
    paddingBlock: paddingTop + paddingBottom,
  };
}

export function measureTextareaContentHeight(
  text: string,
  width: number,
  options: TextBlockMeasureOptions,
): number {
  return measureTextBlockHeight(text, width, {
    ...options,
    prepareOptions: {
      whiteSpace: 'pre-wrap',
      ...options.prepareOptions,
    },
  });
}

export function measureTextBlockHeight(
  text: string,
  width: number,
  options: TextBlockMeasureOptions,
): number {
  const safeWidth = Math.max(1, Math.floor(width));
  const safeLineHeight = Math.max(1, options.lineHeight);
  const prepared = getPreparedText(text, options.font, {
    ...options.prepareOptions,
  });
  const result = layout(prepared, safeWidth, safeLineHeight);
  const intrinsicHeight = Math.max(result.lineCount, 1) * safeLineHeight;
  return clampHeight(Math.ceil(intrinsicHeight), options.minHeight, options.maxHeight);
}

export function measureTextLineCount(
  text: string,
  width: number,
  options: TextBlockMeasureOptions,
): number {
  const safeWidth = Math.max(1, Math.floor(width));
  const safeLineHeight = Math.max(1, options.lineHeight);
  const prepared = getPreparedText(text, options.font, {
    ...options.prepareOptions,
  });
  return layout(prepared, safeWidth, safeLineHeight).lineCount;
}

export function measureTextWrapStats(
  text: string,
  width: number,
  options: Pick<TextBlockMeasureOptions, 'font' | 'prepareOptions'>,
): TextWrapStats {
  const safeWidth = Math.max(1, Math.floor(width));
  const prepared = getPreparedTextWithSegments(text, options.font, {
    ...options.prepareOptions,
  });
  let maxLineWidth = 0;
  const lineCount = walkLineRanges(prepared, safeWidth, (line) => {
    if (line.width > maxLineWidth) {
      maxLineWidth = line.width;
    }
  });

  return { lineCount, maxLineWidth };
}

export function measureTextNaturalWidth(
  text: string,
  {
    font,
    prepareOptions,
  }: Pick<TextBlockMeasureOptions, 'font' | 'prepareOptions'>,
): number {
  const prepared = getPreparedTextWithSegments(text, font, {
    ...prepareOptions,
  });
  return Math.max(0, Math.ceil(measureNaturalWidth(prepared)));
}
