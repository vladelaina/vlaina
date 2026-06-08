import { getRawTextHtmlRanges } from '@/lib/markdown/markdownHtmlRanges';
import {
  getMarkdownBlockContent,
  getMarkdownBlockContentStartOffset,
  getMarkdownHtmlBlockClosePattern,
} from '@/lib/markdown/markdownHtmlBlockClassification';

export interface ContentRange {
  start: number;
  end: number;
}

export interface ContentRangeScan {
  exhaustedAt: number | null;
  ranges: ContentRange[];
}

const MARKDOWN_ESCAPABLE_PUNCTUATION = new Set(
  Array.from('!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~')
);

function getBacktickRunLength(content: string, start: number): number {
  let cursor = start;
  while (cursor < content.length && content[cursor] === '`') {
    cursor += 1;
  }
  return cursor - start;
}

function collectInlineCodeRanges(content: string, maxRanges = Number.POSITIVE_INFINITY): ContentRangeScan {
  const rangeLimit = Number.isFinite(maxRanges)
    ? Math.max(0, Math.floor(maxRanges))
    : maxRanges === Number.POSITIVE_INFINITY
      ? Number.POSITIVE_INFINITY
      : 0;
  if (rangeLimit <= 0) {
    return { exhaustedAt: 0, ranges: [] };
  }

  const ranges: ContentRange[] = [];
  let cursor = 0;

  while (cursor < content.length) {
    if (content[cursor] !== '`') {
      cursor += 1;
      continue;
    }

    const tickCount = getBacktickRunLength(content, cursor);
    let close = cursor + tickCount;
    while (close < content.length) {
      if (content[close] !== '`') {
        close += 1;
        continue;
      }
      const closeTickCount = getBacktickRunLength(content, close);
      if (closeTickCount === tickCount) {
        if (ranges.length >= rangeLimit) {
          return { exhaustedAt: cursor, ranges };
        }
        ranges.push({ start: cursor, end: close + tickCount });
        cursor = close + tickCount;
        break;
      }
      close += closeTickCount;
    }
    if (close >= content.length) {
      cursor += tickCount;
    }
  }

  return { exhaustedAt: null, ranges };
}

export function normalizeContentRanges(ranges: ContentRange[]): ContentRange[] {
  const sortedRanges = ranges.sort((left, right) =>
    left.start === right.start ? left.end - right.end : left.start - right.start
  );
  const normalizedRanges: ContentRange[] = [];

  for (const range of sortedRanges) {
    const lastRange = normalizedRanges[normalizedRanges.length - 1];
    if (lastRange && range.start <= lastRange.end) {
      lastRange.end = Math.max(lastRange.end, range.end);
      continue;
    }
    normalizedRanges.push({ ...range });
  }

  return normalizedRanges;
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

export function isEscapedMarkdownPunctuation(content: string, offset: number): boolean {
  const char = content[offset];
  if (!char || !MARKDOWN_ESCAPABLE_PUNCTUATION.has(char)) {
    return false;
  }

  let backslashCount = 0;
  for (let cursor = offset - 1; cursor >= 0 && content[cursor] === '\\'; cursor -= 1) {
    backslashCount += 1;
  }
  return backslashCount % 2 === 1;
}

function collectHtmlCommentRanges(content: string, maxRanges = Number.POSITIVE_INFINITY): ContentRangeScan {
  const rangeLimit = Number.isFinite(maxRanges)
    ? Math.max(0, Math.floor(maxRanges))
    : maxRanges === Number.POSITIVE_INFINITY
      ? Number.POSITIVE_INFINITY
      : 0;
  if (rangeLimit <= 0) {
    return { exhaustedAt: 0, ranges: [] };
  }

  const ranges: ContentRange[] = [];
  let cursor = 0;

  while (cursor < content.length) {
    const start = content.indexOf('<!--', cursor);
    if (start === -1) {
      break;
    }
    if (isEscapedMarkdownPunctuation(content, start)) {
      cursor = start + 4;
      continue;
    }

    const close = content.indexOf('-->', start + 4);
    const end = close === -1 ? content.length : close + 3;
    if (ranges.length >= rangeLimit) {
      return { exhaustedAt: start, ranges };
    }
    ranges.push({ start, end });
    cursor = end;
  }

  return { exhaustedAt: null, ranges };
}

export function collectMarkdownHtmlBlockRanges(content: string, maxRanges = Number.POSITIVE_INFINITY): ContentRangeScan {
  const rangeLimit = Number.isFinite(maxRanges)
    ? Math.max(0, Math.floor(maxRanges))
    : maxRanges === Number.POSITIVE_INFINITY
      ? Number.POSITIVE_INFINITY
      : 0;
  if (rangeLimit <= 0) {
    return { exhaustedAt: 0, ranges: [] };
  }

  const ranges: ContentRange[] = [];
  let offset = 0;
  let activeStart: number | null = null;
  let activeClosePattern: RegExp | null = null;

  while (offset < content.length) {
    const lineEnd = content.indexOf('\n', offset);
    const lineContentEnd = lineEnd === -1 ? content.length : lineEnd;
    const nextOffset = lineEnd === -1 ? content.length : lineEnd + 1;
    const line = content.slice(offset, lineContentEnd).replace(/\r$/, '');
    const blockContent = getMarkdownBlockContent(line);
    const blockContentStartOffset = getMarkdownBlockContentStartOffset(line);
    const firstNonBlank = blockContent.search(/\S/);

    if (activeStart !== null) {
      const closePattern = activeClosePattern;
      if (
        (closePattern && closePattern.test(blockContent))
        || (!closePattern && blockContent.trim() === '')
      ) {
        if (ranges.length >= rangeLimit) {
          return { exhaustedAt: activeStart, ranges };
        }
        ranges.push({ start: activeStart, end: closePattern ? nextOffset : offset });
        activeStart = null;
        activeClosePattern = null;
      }
      offset = nextOffset;
      continue;
    }

    const closePattern =
      firstNonBlank >= 0
      && !isEscapedMarkdownPunctuation(content, offset + blockContentStartOffset + firstNonBlank)
        ? getMarkdownHtmlBlockClosePattern(blockContent)
        : undefined;
    if (closePattern !== undefined) {
      activeStart = offset;
      activeClosePattern = closePattern;
      if (closePattern?.test(line)) {
        if (ranges.length >= rangeLimit) {
          return { exhaustedAt: activeStart, ranges };
        }
        ranges.push({ start: activeStart, end: nextOffset });
        activeStart = null;
        activeClosePattern = null;
      }
    }
    offset = nextOffset;
  }

  if (activeStart !== null && ranges.length < rangeLimit) {
    ranges.push({ start: activeStart, end: content.length });
  } else if (activeStart !== null) {
    return { exhaustedAt: activeStart, ranges };
  }

  return { exhaustedAt: null, ranges };
}

export function getMarkdownHtmlBlockRanges(content: string): ContentRange[] {
  return collectMarkdownHtmlBlockRanges(content).ranges;
}

export function collectIgnoredInlineRanges(markdown: string, maxRanges = Number.POSITIVE_INFINITY): ContentRangeScan {
  const rangeLimit = Number.isFinite(maxRanges)
    ? Math.max(0, Math.floor(maxRanges))
    : maxRanges === Number.POSITIVE_INFINITY
      ? Number.POSITIVE_INFINITY
      : 0;
  if (rangeLimit <= 0) {
    return { exhaustedAt: 0, ranges: [] };
  }

  const inlineCodeScan = collectInlineCodeRanges(markdown, rangeLimit);
  let ranges = inlineCodeScan.ranges;
  let exhaustedAt = inlineCodeScan.exhaustedAt;

  if (exhaustedAt === null && ranges.length < rangeLimit) {
    const commentScan = collectHtmlCommentRanges(markdown, rangeLimit - ranges.length);
    ranges = [...ranges, ...commentScan.ranges];
    exhaustedAt = commentScan.exhaustedAt;
  }

  if (exhaustedAt === null && ranges.length < rangeLimit) {
    const rawTextLimit = rangeLimit - ranges.length;
    const rawTextRanges = getRawTextHtmlRanges(
      markdown,
      { start: 0, end: markdown.length },
      rawTextLimit + 1,
    );
    if (rawTextRanges.length > rawTextLimit) {
      ranges = [...ranges, ...rawTextRanges.slice(0, rawTextLimit)];
      exhaustedAt = rawTextRanges[rawTextLimit]?.start ?? 0;
    } else {
      ranges = [...ranges, ...rawTextRanges];
    }
  }

  return {
    exhaustedAt,
    ranges: normalizeContentRanges(ranges),
  };
}

export function getIgnoredInlineRanges(markdown: string): ContentRange[] {
  return collectIgnoredInlineRanges(markdown).ranges;
}
