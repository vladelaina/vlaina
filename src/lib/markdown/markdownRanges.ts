import {
  getMarkdownFenceState,
  isMarkdownFenceClose,
  type MarkdownFenceState,
} from './markdownFence';
import {
  collectHtmlTagRanges,
  findHtmlTagEnd,
  getHtmlTagRanges,
  getRawTextHtmlRanges,
} from './markdownHtmlRanges';
import { isEscapedMarkdownPunctuation } from './markdownEscapes';
import { normalizeRangeLimit } from './markdownRangeLimits';

export { collectHtmlTagRanges, findHtmlTagEnd, getHtmlTagRanges, getRawTextHtmlRanges };
export {
  getMarkdownHtmlBlockRanges,
  getMarkdownInvisibleHtmlBlockRanges,
} from './markdownHtmlBlockRanges';
export { isEscapedMarkdownPunctuation } from './markdownEscapes';

export interface ContentRange {
  start: number;
  end: number;
}

export function* iterateNonFencedContentRanges(content: string): Iterable<ContentRange> {
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
        yield { start: rangeStart, end: offset };
      }
      activeFence = fence;
    }

    offset = nextOffset;
  }

  if (!activeFence && rangeStart < content.length) {
    yield { start: rangeStart, end: content.length };
  }
}

export function getNonFencedContentRanges(content: string): ContentRange[] {
  const ranges: ContentRange[] = [];
  for (const range of iterateNonFencedContentRanges(content)) {
    ranges.push(range);
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

export function getInlineCodeRanges(
  content: string,
  range: ContentRange,
  maxRanges = Number.POSITIVE_INFINITY,
): ContentRange[] {
  const rangeLimit = normalizeRangeLimit(maxRanges);
  if (rangeLimit <= 0) {
    return [];
  }

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
    if (ranges.length >= rangeLimit) {
      break;
    }
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

export function getHtmlCommentRanges(
  content: string,
  range: ContentRange,
  maxRanges = Number.POSITIVE_INFINITY,
): ContentRange[] {
  const rangeLimit = normalizeRangeLimit(maxRanges);
  if (rangeLimit <= 0) {
    return [];
  }

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
    if (ranges.length >= rangeLimit) {
      break;
    }
    cursor = end;
  }

  return ranges;
}
