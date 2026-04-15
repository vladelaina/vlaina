import { layout, prepare, type PrepareOptions, type PreparedText } from './pretext/layout';

export interface TextLayoutMetrics {
  font: string;
  lineHeight: number;
}

export interface ElementTextLayoutMetrics extends TextLayoutMetrics {
  fontSize: number;
}

export interface TextBlockMeasureOptions extends TextLayoutMetrics {
  maxHeight?: number;
  minHeight?: number;
  prepareOptions?: PrepareOptions;
}

const preparedCache = new Map<string, PreparedText>();
const DEFAULT_FONT_FAMILY = 'Inter, -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif';
const DEFAULT_FONT_SIZE = 15;
const DEFAULT_LINE_HEIGHT_RATIO = 1.6;

function getPreparedText(
  text: string,
  font: string,
  options: PrepareOptions | undefined,
): PreparedText {
  const whiteSpace = options?.whiteSpace ?? 'normal';
  const wordBreak = options?.wordBreak ?? 'normal';
  const cacheKey = `${font}\u0000${whiteSpace}\u0000${wordBreak}\u0000${text}`;
  const cached = preparedCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const prepared = prepare(text, font, options);
  preparedCache.set(cacheKey, prepared);
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
  const fontStyle = styles.fontStyle || 'normal';
  const fontWeight = styles.fontWeight || '400';
  const fontSizeToken = `${fontSize}px`;
  const fontFamily = styles.fontFamily || DEFAULT_FONT_FAMILY;

  return {
    font: `${fontStyle} ${fontWeight} ${fontSizeToken} ${fontFamily}`,
    fontSize,
    lineHeight,
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
