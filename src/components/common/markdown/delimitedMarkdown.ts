export interface MarkdownSourcePosition {
  start?: { offset?: number };
  end?: { offset?: number };
}

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

const ESCAPABLE_ASCII_PUNCTUATION = new Set(
  Array.from('!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~')
);

const NAMED_CHARACTER_REFERENCES: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  nbsp: '\u00A0',
  quot: '"',
};

export const MAX_DELIMITED_MARKDOWN_TEXT_CHARS = 100_000;
export const MAX_DELIMITED_MARKDOWN_MATCHES = 2000;

function getPositionOffsets(position: MarkdownSourcePosition | undefined, markdownLength: number) {
  const start = position?.start?.offset;
  const end = position?.end?.offset;
  if (
    typeof start !== 'number' ||
    typeof end !== 'number' ||
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end < start ||
    end > markdownLength
  ) {
    return null;
  }
  return { start, end };
}

function decodeCharacterReference(value: string): string | null {
  const match = value.match(/^&(#x[0-9a-f]+|#\d+|[A-Za-z][A-Za-z0-9]+);$/i);
  if (!match) return null;

  const body = match[1];
  if (body.startsWith('#x') || body.startsWith('#X')) {
    const codePoint = Number.parseInt(body.slice(2), 16);
    return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10FFFF
      ? String.fromCodePoint(codePoint)
      : null;
  }
  if (body.startsWith('#')) {
    const codePoint = Number.parseInt(body.slice(1), 10);
    return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10FFFF
      ? String.fromCodePoint(codePoint)
      : null;
  }

  return NAMED_CHARACTER_REFERENCES[body] ?? null;
}

function createTextSourceOffsetMap(
  value: string,
  markdown: string,
  position: MarkdownSourcePosition | undefined
): number[] | null {
  if (value.length > MAX_DELIMITED_MARKDOWN_TEXT_CHARS) return null;
  const offsets = getPositionOffsets(position, markdown.length);
  if (!offsets) return null;
  if (offsets.end - offsets.start > MAX_DELIMITED_MARKDOWN_TEXT_CHARS) return null;

  const map: number[] = [];
  let sourceIndex = offsets.start;
  let valueIndex = 0;

  while (sourceIndex < offsets.end && valueIndex < value.length) {
    const sourceChar = markdown[sourceIndex];
    const valueChar = value[valueIndex];

    if (
      sourceChar === '\\' &&
      sourceIndex + 1 < offsets.end &&
      markdown[sourceIndex + 1] === valueChar &&
      ESCAPABLE_ASCII_PUNCTUATION.has(markdown[sourceIndex + 1])
    ) {
      map[valueIndex] = sourceIndex + 1;
      sourceIndex += 2;
      valueIndex += 1;
      continue;
    }

    if (sourceChar === '&') {
      const semicolonIndex = markdown.indexOf(';', sourceIndex + 1);
      if (semicolonIndex > sourceIndex && semicolonIndex < offsets.end) {
        const decoded = decodeCharacterReference(markdown.slice(sourceIndex, semicolonIndex + 1));
        if (decoded && value.startsWith(decoded, valueIndex)) {
          for (let index = 0; index < decoded.length; index += 1) {
            map[valueIndex + index] = sourceIndex;
          }
          sourceIndex = semicolonIndex + 1;
          valueIndex += decoded.length;
          continue;
        }
      }
    }

    if (sourceChar === '\r' && markdown[sourceIndex + 1] === '\n' && valueChar === '\n') {
      map[valueIndex] = sourceIndex;
      sourceIndex += 2;
      valueIndex += 1;
      continue;
    }

    if (sourceChar !== valueChar) return null;

    map[valueIndex] = sourceIndex;
    sourceIndex += 1;
    valueIndex += 1;
  }

  return valueIndex === value.length ? map : null;
}

function isEscapedSourceOffset(markdown: string, offset: number, lowerBound: number): boolean {
  let backslashCount = 0;
  for (let index = offset - 1; index >= lowerBound && markdown[index] === '\\'; index -= 1) {
    backslashCount += 1;
  }
  return backslashCount % 2 === 1;
}

function getEscapeScanLowerBound(markdown: string, startOffset: number): number {
  return startOffset > 0 && markdown[startOffset - 1] === '\\'
    ? startOffset - 1
    : startOffset;
}

function isLiteralUnescapedDelimiterRange(
  value: string,
  markdown: string,
  sourceOffsetMap: number[],
  start: number,
  length: number,
  lowerBound: number
): boolean {
  for (let index = 0; index < length; index += 1) {
    const valueIndex = start + index;
    const sourceOffset = sourceOffsetMap[valueIndex];
    if (
      typeof sourceOffset !== 'number' ||
      markdown[sourceOffset] !== value[valueIndex] ||
      isEscapedSourceOffset(markdown, sourceOffset, lowerBound)
    ) {
      return false;
    }
  }
  return true;
}

export function findDelimitedTextMatches(
  value: string,
  regex: RegExp,
  options: FindDelimitedTextMatchesOptions
): DelimitedTextMatch[] {
  if (value.length > MAX_DELIMITED_MARKDOWN_TEXT_CHARS) {
    return [];
  }

  const hasSourcePosition = !!options.markdown && !!getPositionOffsets(options.position, options.markdown.length);
  const sourceOffsetMap = hasSourcePosition
    ? createTextSourceOffsetMap(value, options.markdown || '', options.position)
    : null;
  const offsets = getPositionOffsets(options.position, options.markdown?.length ?? 0);
  const lowerBound = offsets && options.markdown
    ? getEscapeScanLowerBound(options.markdown, offsets.start)
    : 0;
  const closeDelimiterLength = options.closeDelimiterLength ?? options.openDelimiterLength;
  const matches: DelimitedTextMatch[] = [];
  let match: RegExpExecArray | null;
  regex.lastIndex = 0;

  while (matches.length < MAX_DELIMITED_MARKDOWN_MATCHES && (match = regex.exec(value)) !== null) {
    const start = match.index;
    const end = match.index + match[0].length;
    const closeStart = end - closeDelimiterLength;

    if (hasSourcePosition && !sourceOffsetMap) {
      continue;
    }

    if (
      sourceOffsetMap &&
      (
        !isLiteralUnescapedDelimiterRange(
          value,
          options.markdown || '',
          sourceOffsetMap,
          start,
          options.openDelimiterLength,
          lowerBound
        ) ||
        !isLiteralUnescapedDelimiterRange(
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

  const sourceOffsets = options.markdown
    ? getPositionOffsets(options.position, options.markdown.length)
    : null;
  if (!options.markdown || !sourceOffsets) {
    return true;
  }

  const sourceOffsetMap = createTextSourceOffsetMap(value, options.markdown, options.position);
  if (!sourceOffsetMap) {
    return false;
  }

  return isLiteralUnescapedDelimiterRange(
    value,
    options.markdown,
    sourceOffsetMap,
    start,
    length,
    getEscapeScanLowerBound(options.markdown, sourceOffsets.start)
  );
}
