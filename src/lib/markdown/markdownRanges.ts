import {
  getMarkdownFenceState,
  isMarkdownFenceClose,
  type MarkdownFenceState,
} from './markdownFence';
import {
  getHtmlTagRanges,
  getRawTextHtmlRanges,
} from './markdownHtmlRanges';

export { getHtmlTagRanges, getRawTextHtmlRanges };

export interface ContentRange {
  start: number;
  end: number;
}

const MARKDOWN_ESCAPABLE_PUNCTUATION = new Set(
  Array.from('!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~')
);
const HTML_MARKDOWN_BLOCK_OPEN_PATTERN =
  /^(?: {0,3})<\/?(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h1|h2|h3|h4|h5|h6|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|search|section|source|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?:\s|\/?>|$)/i;
const HTML_COMMENT_OPEN_PATTERN = /^(?: {0,3})<!--/;
const HTML_PROCESSING_OPEN_PATTERN = /^(?: {0,3})<\?/;
const HTML_DECLARATION_OPEN_PATTERN = /^(?: {0,3})<![A-Z]/i;
const HTML_CDATA_OPEN_PATTERN = /^(?: {0,3})<!\[CDATA\[/;

export function getNonFencedContentRanges(content: string): ContentRange[] {
  const ranges: ContentRange[] = [];
  let rangeStart = 0;
  let offset = 0;
  let activeFence: MarkdownFenceState | null = null;

  while (offset < content.length) {
    const lineEnd = content.indexOf("\n", offset);
    const lineContentEnd = lineEnd === -1 ? content.length : lineEnd;
    const nextOffset = lineEnd === -1 ? content.length : lineEnd + 1;
    const rawLine = content.slice(offset, lineContentEnd);
    const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;

    if (activeFence) {
      if (isMarkdownFenceClose(line, activeFence)) {
        activeFence = null;
        rangeStart = nextOffset;
      }
      offset = nextOffset;
      continue;
    }

    const fence = getMarkdownFenceState(line);
    if (fence) {
      if (rangeStart < offset) {
        ranges.push({ start: rangeStart, end: offset });
      }
      activeFence = fence;
    }

    offset = nextOffset;
  }

  if (!activeFence && rangeStart < content.length) {
    ranges.push({ start: rangeStart, end: content.length });
  }

  return ranges;
}

function getBacktickRunLength(content: string, start: number, end: number): number {
  let cursor = start;
  while (cursor < end && content[cursor] === "`") {
    cursor += 1;
  }
  return cursor - start;
}

function findClosingCodeSpan(content: string, start: number, end: number, tickCount: number): number {
  let cursor = start;

  while (cursor < end) {
    if (content[cursor] !== "`") {
      cursor += 1;
      continue;
    }

    const runLength = getBacktickRunLength(content, cursor, end);
    if (runLength === tickCount) {
      return cursor;
    }
    cursor += runLength;
  }

  return -1;
}

export function getInlineCodeRanges(content: string, range: ContentRange): ContentRange[] {
  const ranges: ContentRange[] = [];
  let cursor = range.start;

  while (cursor < range.end) {
    if (content[cursor] !== "`") {
      cursor += 1;
      continue;
    }

    const tickCount = getBacktickRunLength(content, cursor, range.end);
    const closeStart = findClosingCodeSpan(content, cursor + tickCount, range.end, tickCount);
    if (closeStart === -1) {
      cursor += tickCount;
      continue;
    }

    ranges.push({ start: cursor, end: closeStart + tickCount });
    cursor = closeStart + tickCount;
  }

  return ranges;
}

export function getRangeEndAtOffset(offset: number, ranges: readonly ContentRange[]): number | null {
  let low = 0;
  let high = ranges.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const range = ranges[mid];
    if (offset < range.start) {
      high = mid - 1;
      continue;
    }
    if (offset >= range.end) {
      low = mid + 1;
      continue;
    }
    return range.end;
  }

  return null;
}

export function isOffsetInRanges(offset: number, ranges: readonly ContentRange[]): boolean {
  return getRangeEndAtOffset(offset, ranges) !== null;
}

export function isEscapedMarkdownPunctuation(content: string, offset: number, lowerBound: number): boolean {
  const char = content[offset];
  if (!char || !MARKDOWN_ESCAPABLE_PUNCTUATION.has(char)) {
    return false;
  }

  let backslashCount = 0;
  for (let cursor = offset - 1; cursor >= lowerBound && content[cursor] === "\\"; cursor -= 1) {
    backslashCount += 1;
  }
  return backslashCount % 2 === 1;
}

export function getHtmlCommentRanges(content: string, range: ContentRange): ContentRange[] {
  const ranges: ContentRange[] = [];
  let cursor = range.start;

  while (cursor < range.end) {
    const start = content.indexOf("<!--", cursor);
    if (start === -1 || start >= range.end) {
      break;
    }
    if (isEscapedMarkdownPunctuation(content, start, range.start)) {
      cursor = start + 4;
      continue;
    }

    const close = content.indexOf("-->", start + 4);
    const end = close === -1 ? range.end : Math.min(range.end, close + 3);
    ranges.push({ start, end });
    cursor = end;
  }

  return ranges;
}

export function getMarkdownHtmlBlockRanges(
  content: string,
  range: ContentRange,
  maxRanges = Number.POSITIVE_INFINITY,
): ContentRange[] {
  const rangeLimit = Number.isFinite(maxRanges)
    ? Math.max(0, Math.floor(maxRanges))
    : maxRanges === Number.POSITIVE_INFINITY
      ? Number.POSITIVE_INFINITY
      : 0;
  if (rangeLimit <= 0) {
    return [];
  }

  const ranges: ContentRange[] = [];
  let offset = range.start;
  let activeStart: number | null = null;
  let activeClosePattern: RegExp | null = null;

  while (offset < range.end) {
    const lineEnd = content.indexOf("\n", offset);
    const lineContentEnd = lineEnd === -1 ? range.end : Math.min(lineEnd, range.end);
    const nextOffset = lineEnd === -1 ? range.end : Math.min(range.end, lineEnd + 1);
    const line = content.slice(offset, lineContentEnd).replace(/\r$/, "");
    const firstNonBlank = line.search(/\S/);

    if (activeStart !== null) {
      const closePattern = activeClosePattern;
      if ((closePattern && closePattern.test(line)) || (!closePattern && line.trim() === "")) {
        ranges.push({ start: activeStart, end: closePattern ? nextOffset : offset });
        if (ranges.length >= rangeLimit) {
          return ranges;
        }
        activeStart = null;
        activeClosePattern = null;
      }
      offset = nextOffset;
      continue;
    }

    const closePattern =
      firstNonBlank >= 0 && !isEscapedMarkdownPunctuation(content, offset + firstNonBlank, range.start)
        ? getMarkdownHtmlBlockClosePattern(line)
        : undefined;
    if (closePattern !== undefined) {
      activeStart = offset;
      activeClosePattern = closePattern;
      if (closePattern?.test(line)) {
        ranges.push({ start: activeStart, end: nextOffset });
        if (ranges.length >= rangeLimit) {
          return ranges;
        }
        activeStart = null;
        activeClosePattern = null;
      }
    }
    offset = nextOffset;
  }

  if (activeStart !== null) {
    ranges.push({ start: activeStart, end: range.end });
  }

  return ranges;
}

function getMarkdownHtmlBlockClosePattern(line: string): RegExp | null | undefined {
  const invisibleBlockClosePattern = getMarkdownInvisibleHtmlBlockClosePattern(line);
  if (invisibleBlockClosePattern !== undefined) return invisibleBlockClosePattern;
  if (HTML_MARKDOWN_BLOCK_OPEN_PATTERN.test(line)) return null;
  return undefined;
}

function getMarkdownInvisibleHtmlBlockClosePattern(line: string): RegExp | undefined {
  if (HTML_COMMENT_OPEN_PATTERN.test(line)) return /-->/;
  if (HTML_PROCESSING_OPEN_PATTERN.test(line)) return /\?>/;
  if (HTML_DECLARATION_OPEN_PATTERN.test(line)) return />/;
  if (HTML_CDATA_OPEN_PATTERN.test(line)) return /\]\]>/;
  return undefined;
}

export function getMarkdownInvisibleHtmlBlockRanges(
  content: string,
  range: ContentRange,
  maxRanges = Number.POSITIVE_INFINITY,
): ContentRange[] {
  const rangeLimit = Number.isFinite(maxRanges)
    ? Math.max(0, Math.floor(maxRanges))
    : maxRanges === Number.POSITIVE_INFINITY
      ? Number.POSITIVE_INFINITY
      : 0;
  if (rangeLimit <= 0) {
    return [];
  }

  const ranges: ContentRange[] = [];
  let offset = range.start;
  let activeStart: number | null = null;
  let activeClosePattern: RegExp | null = null;

  while (offset < range.end) {
    const lineEnd = content.indexOf("\n", offset);
    const lineContentEnd = lineEnd === -1 ? range.end : Math.min(lineEnd, range.end);
    const nextOffset = lineEnd === -1 ? range.end : Math.min(range.end, lineEnd + 1);
    const line = content.slice(offset, lineContentEnd).replace(/\r$/, "");
    const firstNonBlank = line.search(/\S/);

    if (activeStart !== null) {
      if (activeClosePattern?.test(line)) {
        ranges.push({ start: activeStart, end: nextOffset });
        if (ranges.length >= rangeLimit) {
          return ranges;
        }
        activeStart = null;
        activeClosePattern = null;
      }
      offset = nextOffset;
      continue;
    }

    const closePattern =
      firstNonBlank >= 0 && !isEscapedMarkdownPunctuation(content, offset + firstNonBlank, range.start)
        ? getMarkdownInvisibleHtmlBlockClosePattern(line)
        : undefined;
    if (closePattern) {
      activeStart = offset;
      activeClosePattern = closePattern;
      if (closePattern.test(line)) {
        ranges.push({ start: activeStart, end: nextOffset });
        if (ranges.length >= rangeLimit) {
          return ranges;
        }
        activeStart = null;
        activeClosePattern = null;
      }
    }
    offset = nextOffset;
  }

  if (activeStart !== null) {
    ranges.push({ start: activeStart, end: range.end });
  }

  return ranges;
}
