export interface MarkdownSourcePosition {
  start?: { offset?: number };
  end?: { offset?: number };
}

export const MAX_MARKDOWN_SOURCE_TEXT_CHARS = 100_000;

export interface MarkdownPositionOffsets {
  start: number;
  end: number;
}

export interface MarkdownTextSourceMap {
  value: string;
  markdown: string;
  offsets: MarkdownPositionOffsets;
  sourceOffsetMap: number[];
}

export interface MarkdownTextNodeLike {
  type: string;
  value?: string;
  position?: MarkdownSourcePosition;
}

export interface MarkdownTextSliceNode {
  type: 'text';
  value: string;
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

export function getMarkdownPositionOffsets(
  position: MarkdownSourcePosition | undefined,
  markdownLength: number
): MarkdownPositionOffsets | null {
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

export function createMarkdownTextSourceMap(
  value: string,
  markdown: string,
  position: MarkdownSourcePosition | undefined
): MarkdownTextSourceMap | null {
  if (value.length > MAX_MARKDOWN_SOURCE_TEXT_CHARS) return null;
  const offsets = getMarkdownPositionOffsets(position, markdown.length);
  if (!offsets) return null;
  if (offsets.end - offsets.start > MAX_MARKDOWN_SOURCE_TEXT_CHARS) return null;

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

  return valueIndex === value.length
    ? { value, markdown, offsets, sourceOffsetMap: map }
    : null;
}

export function createMarkdownTextSourceOffsetMap(
  value: string,
  markdown: string,
  position: MarkdownSourcePosition | undefined
): number[] | null {
  return createMarkdownTextSourceMap(value, markdown, position)?.sourceOffsetMap ?? null;
}

export function isEscapedSourceOffset(markdown: string, offset: number, lowerBound: number): boolean {
  let backslashCount = 0;
  for (let index = offset - 1; index >= lowerBound && markdown[index] === '\\'; index -= 1) {
    backslashCount += 1;
  }
  return backslashCount % 2 === 1;
}

export function getEscapeScanLowerBound(markdown: string, startOffset: number): number {
  return startOffset > 0 && markdown[startOffset - 1] === '\\'
    ? startOffset - 1
    : startOffset;
}

export function isLiteralUnescapedMarkdownTextRange(
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

function getMappedSourceCharEnd(
  value: string,
  markdown: string,
  sourceEndLimit: number,
  valueIndex: number,
  sourceOffset: number
): number | null {
  if (!Number.isInteger(sourceOffset) || sourceOffset < 0 || sourceOffset >= sourceEndLimit) {
    return null;
  }

  if (markdown[sourceOffset] === '&') {
    const semicolonIndex = markdown.indexOf(';', sourceOffset + 1);
    if (semicolonIndex > sourceOffset && semicolonIndex < sourceEndLimit) {
      const decoded = decodeCharacterReference(markdown.slice(sourceOffset, semicolonIndex + 1));
      if (decoded && value.startsWith(decoded, valueIndex)) {
        return semicolonIndex + 1;
      }
    }
  }

  if (markdown[sourceOffset] === '\r' && markdown[sourceOffset + 1] === '\n' && value[valueIndex] === '\n') {
    return sourceOffset + 2;
  }

  return sourceOffset + 1;
}

export function createMarkdownTextSliceSourcePosition(
  sourceMap: MarkdownTextSourceMap,
  start: number,
  end: number
): MarkdownSourcePosition | undefined {
  const { value, markdown, offsets, sourceOffsetMap } = sourceMap;
  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end < start ||
    end > value.length
  ) {
    return undefined;
  }

  if (start > 0 && start < value.length && sourceOffsetMap[start] === sourceOffsetMap[start - 1]) {
    return undefined;
  }
  if (end > 0 && end < value.length && sourceOffsetMap[end] === sourceOffsetMap[end - 1]) {
    return undefined;
  }

  const sourceStart = start < value.length ? sourceOffsetMap[start] : offsets.end;
  const sourceEnd = end > start
    ? getMappedSourceCharEnd(value, markdown, offsets.end, end - 1, sourceOffsetMap[end - 1])
    : sourceStart;
  if (
    typeof sourceStart !== 'number' ||
    typeof sourceEnd !== 'number' ||
    sourceStart < offsets.start ||
    sourceEnd < sourceStart ||
    sourceEnd > offsets.end
  ) {
    return undefined;
  }

  return {
    start: { offset: sourceStart },
    end: { offset: sourceEnd },
  };
}

export function createMarkdownTextSliceNode(
  node: MarkdownTextNodeLike,
  sourceMap: MarkdownTextSourceMap | null,
  start: number,
  end: number
): MarkdownTextSliceNode {
  const value = (node.value || '').slice(start, end);
  const position = sourceMap
    ? createMarkdownTextSliceSourcePosition(sourceMap, start, end)
    : undefined;
  return position ? { type: 'text', value, position } : { type: 'text', value };
}

export function replaceMarkdownTextNodeWithSlice(
  node: MarkdownTextNodeLike,
  sourceMap: MarkdownTextSourceMap | null,
  start: number,
  end: number
): void {
  const nextNode = createMarkdownTextSliceNode(node, sourceMap, start, end);
  node.value = nextNode.value;
  if (nextNode.position) {
    node.position = nextNode.position;
  } else {
    delete node.position;
  }
}
