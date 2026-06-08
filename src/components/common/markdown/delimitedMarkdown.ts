import {
  MAX_MARKDOWN_SOURCE_TEXT_CHARS,
  createMarkdownTextSourceOffsetMap,
  getEscapeScanLowerBound,
  getMarkdownPositionOffsets,
  isLiteralUnescapedMarkdownTextRange,
  type MarkdownSourcePosition,
} from './markdownSourcePosition';

export type { MarkdownSourcePosition } from './markdownSourcePosition';

export interface DelimitedTextMatch {
  start: number;
  end: number;
  content: string;
}

interface FindDelimitedTextMatchesOptions {
  markdown?: string;
  position?: MarkdownSourcePosition;
  openDelimiterLength: number;
  closeDelimiterLength?: number;
}

interface MarkdownSourceRangeOptions {
  markdown?: string;
  position?: MarkdownSourcePosition;
}

export const MAX_DELIMITED_MARKDOWN_TEXT_CHARS = MAX_MARKDOWN_SOURCE_TEXT_CHARS;
export const MAX_DELIMITED_MARKDOWN_MATCHES = 2000;

export function findDelimitedTextMatches(
  value: string,
  regex: RegExp,
  options: FindDelimitedTextMatchesOptions
): DelimitedTextMatch[] {
  if (value.length > MAX_DELIMITED_MARKDOWN_TEXT_CHARS) {
    return [];
  }

  const hasMarkdownSource = !!options.markdown;
  const sourceOffsets = hasMarkdownSource
    ? getMarkdownPositionOffsets(options.position, options.markdown!.length)
    : null;
  if (hasMarkdownSource && !sourceOffsets) {
    return [];
  }

  const sourceOffsetMap = sourceOffsets
    ? createMarkdownTextSourceOffsetMap(value, options.markdown || '', options.position)
    : null;
  const lowerBound = sourceOffsets && options.markdown
    ? getEscapeScanLowerBound(options.markdown, sourceOffsets.start)
    : 0;
  const closeDelimiterLength = options.closeDelimiterLength ?? options.openDelimiterLength;
  const matches: DelimitedTextMatch[] = [];
  let match: RegExpExecArray | null;
  regex.lastIndex = 0;

  while (matches.length < MAX_DELIMITED_MARKDOWN_MATCHES && (match = regex.exec(value)) !== null) {
    const start = match.index;
    const end = match.index + match[0].length;
    const closeStart = end - closeDelimiterLength;

    if (sourceOffsets && !sourceOffsetMap) {
      continue;
    }

    if (
      sourceOffsetMap &&
      (
        !isLiteralUnescapedMarkdownTextRange(
          value,
          options.markdown || '',
          sourceOffsetMap,
          start,
          options.openDelimiterLength,
          lowerBound
        ) ||
        !isLiteralUnescapedMarkdownTextRange(
          value,
          options.markdown || '',
          sourceOffsetMap,
          closeStart,
          closeDelimiterLength,
          lowerBound
        )
      )
    ) {
      continue;
    }

    matches.push({
      start,
      end,
      content: match[1],
    });
  }

  return matches;
}

export function isUnescapedMarkdownTextRange(
  value: string,
  start: number,
  length: number,
  options: MarkdownSourceRangeOptions = {}
): boolean {
  if (value.length > MAX_DELIMITED_MARKDOWN_TEXT_CHARS) {
    return false;
  }

  if (
    !Number.isInteger(start) ||
    !Number.isInteger(length) ||
    start < 0 ||
    length < 0 ||
    start + length > value.length
  ) {
    return false;
  }

  const hasMarkdownSource = !!options.markdown;
  const sourceOffsets = hasMarkdownSource
    ? getMarkdownPositionOffsets(options.position, options.markdown.length)
    : null;
  if (!hasMarkdownSource) {
    return true;
  }
  if (!sourceOffsets) {
    return false;
  }

  const sourceOffsetMap = createMarkdownTextSourceOffsetMap(value, options.markdown, options.position);
  if (!sourceOffsetMap) {
    return false;
  }

  return isLiteralUnescapedMarkdownTextRange(
    value,
    options.markdown,
    sourceOffsetMap,
    start,
    length,
    getEscapeScanLowerBound(options.markdown, sourceOffsets.start)
  );
}
