import {
  findHtmlNonTagEnd,
  findHtmlTagEnd,
  getHtmlTagScanEnd,
  getOverflowHtmlTagProtectionEnd,
  isEscapedMarkdownPunctuation,
  isSelfClosingTag,
  readHtmlTagStart,
  MAX_HTML_TAG_END_SCAN_CHARS,
} from './markdownHtmlTagScanner';
export { findHtmlTagEnd, MAX_HTML_TAG_END_SCAN_CHARS } from './markdownHtmlTagScanner';

export interface ContentRange {
  start: number;
  end: number;
}

export interface HtmlTagRangeScan {
  exhaustedAt: number | null;
  protectedRanges: ContentRange[];
  ranges: ContentRange[];
}

const MAX_RAW_TEXT_CONTAINER_MARKUP_SCANS = 20_000;

const HTML_RAW_TEXT_TAGS = new Set([
  'pre',
  'script',
  'style',
  'textarea',
  'title',
  'xmp',
  'noembed',
  'noframes',
  'plaintext',
  'math',
  'noscript',
  'svg',
]);
const SANITIZER_DROPPED_RAW_HTML_TAGS = new Set([
  'math',
  'noscript',
  'svg',
]);

function normalizeRangeLimit(maxRanges: number): number {
  return Number.isFinite(maxRanges)
    ? Math.max(0, Math.floor(maxRanges))
    : maxRanges === Number.POSITIVE_INFINITY
      ? Number.POSITIVE_INFINITY
      : 0;
}

function scanRawTextContainerEnd(content: string, tagName: string, start: number, end: number): number | null {
  let cursor = start;
  let depth = 1;
  let scannedMarkupStarts = 0;

  while (cursor < end) {
    const nextTagStart = content.indexOf("<", cursor);
    if (nextTagStart === -1 || nextTagStart >= end) {
      return null;
    }
    scannedMarkupStarts += 1;
    if (scannedMarkupStarts > MAX_RAW_TEXT_CONTAINER_MARKUP_SCANS) {
      return null;
    }

    const tagStart = readHtmlTagStart(content, nextTagStart, end);
    if (!tagStart) {
      cursor = findHtmlNonTagEnd(content, nextTagStart, end) ?? nextTagStart + 1;
      continue;
    }
    if (tagStart.overlongName) {
      cursor = getOverflowHtmlTagProtectionEnd(content, nextTagStart, end);
      continue;
    }

    const tagEnd = findHtmlTagEnd(content, nextTagStart, getHtmlTagScanEnd(nextTagStart, end, tagStart.name));
    if (tagEnd === -1) {
      cursor = getOverflowHtmlTagProtectionEnd(content, nextTagStart, end);
      continue;
    }

    if (tagStart.name === tagName) {
      if (tagStart.closing) {
        depth -= 1;
        if (depth <= 0) {
          return tagEnd;
        }
      } else if (!isSelfClosingTag(content, nextTagStart, tagEnd)) {
        depth += 1;
      }
    }
    cursor = tagEnd;
  }

  return null;
}

export function getHtmlTagRanges(
  content: string,
  range: ContentRange,
  maxRanges = Number.POSITIVE_INFINITY,
): ContentRange[] {
  return collectHtmlTagRanges(content, range, maxRanges).ranges;
}

export function collectHtmlTagRanges(
  content: string,
  range: ContentRange,
  maxRanges = Number.POSITIVE_INFINITY,
): HtmlTagRangeScan {
  const rangeLimit = normalizeRangeLimit(maxRanges);
  if (rangeLimit <= 0) {
    return { exhaustedAt: range.start, protectedRanges: [], ranges: [] };
  }

  const ranges: ContentRange[] = [];
  const protectedRanges: ContentRange[] = [];
  let cursor = range.start;

  while (cursor < range.end) {
    const start = content.indexOf("<", cursor);
    if (start === -1 || start >= range.end) {
      break;
    }
    if (isEscapedMarkdownPunctuation(content, start, range.start)) {
      cursor = start + 1;
      continue;
    }

    const nonTagEnd = findHtmlNonTagEnd(content, start, range.end);
    if (nonTagEnd !== null) {
      cursor = nonTagEnd;
      continue;
    }
    const tagStart = readHtmlTagStart(content, start, range.end);
    if (!tagStart) {
      cursor = start + 1;
      continue;
    }
    if (tagStart.overlongName) {
      const protectedEnd = getOverflowHtmlTagProtectionEnd(content, start, range.end);
      protectedRanges.push({ start, end: protectedEnd });
      cursor = protectedEnd;
      if (ranges.length + protectedRanges.length >= rangeLimit) {
        return { exhaustedAt: cursor, protectedRanges, ranges };
      }
      continue;
    }

    const end = findHtmlTagEnd(content, start, getHtmlTagScanEnd(start, range.end, tagStart.name));
    if (end === -1) {
      const protectedEnd = getOverflowHtmlTagProtectionEnd(content, start, range.end);
      protectedRanges.push({ start, end: protectedEnd });
      cursor = protectedEnd;
      if (ranges.length + protectedRanges.length >= rangeLimit) {
        return { exhaustedAt: cursor, protectedRanges, ranges };
      }
      continue;
    }
    ranges.push({ start, end });
    cursor = end;
    if (ranges.length + protectedRanges.length >= rangeLimit) {
      return { exhaustedAt: cursor, protectedRanges, ranges };
    }
  }

  return { exhaustedAt: null, protectedRanges, ranges };
}

function getRawTextHtmlRangesForTags(
  content: string,
  range: ContentRange,
  tagNames: ReadonlySet<string>,
  maxRanges = Number.POSITIVE_INFINITY,
): ContentRange[] {
  const rangeLimit = normalizeRangeLimit(maxRanges);
  if (rangeLimit <= 0) {
    return [];
  }

  const ranges: ContentRange[] = [];
  let cursor = range.start;

  while (cursor < range.end) {
    const nextTagStart = content.indexOf("<", cursor);
    if (nextTagStart === -1 || nextTagStart >= range.end) {
      break;
    }
    if (isEscapedMarkdownPunctuation(content, nextTagStart, range.start)) {
      cursor = nextTagStart + 1;
      continue;
    }

    const tagStart = readHtmlTagStart(content, nextTagStart, range.end);
    if (!tagStart) {
      cursor = findHtmlNonTagEnd(content, nextTagStart, range.end) ?? nextTagStart + 1;
      continue;
    }
    if (tagStart.overlongName) {
      cursor = getOverflowHtmlTagProtectionEnd(content, nextTagStart, range.end);
      continue;
    }

    const tagEnd = findHtmlTagEnd(content, nextTagStart, getHtmlTagScanEnd(nextTagStart, range.end, tagStart.name));
    if (tagEnd === -1) {
      if (tagNames.has(tagStart.name) && !tagStart.closing) {
        ranges.push({ start: nextTagStart, end: getOverflowHtmlTagProtectionEnd(content, nextTagStart, range.end) });
      }
      if (ranges.length >= rangeLimit) {
        break;
      }
      cursor = getOverflowHtmlTagProtectionEnd(content, nextTagStart, range.end);
      continue;
    }
    if (tagStart.closing || !tagNames.has(tagStart.name)) {
      cursor = tagEnd;
      continue;
    }
    if (tagStart.name === "plaintext") {
      ranges.push({ start: nextTagStart, end: range.end });
      break;
    }

    const closeEnd = isSelfClosingTag(content, nextTagStart, tagEnd)
      ? tagEnd
      : scanRawTextContainerEnd(content, tagStart.name, tagEnd, range.end) ?? range.end;
    ranges.push({ start: nextTagStart, end: closeEnd });
    if (ranges.length >= rangeLimit) {
      break;
    }
    cursor = closeEnd;
  }

  return ranges;
}

export function getRawTextHtmlRanges(
  content: string,
  range: ContentRange,
  maxRanges = Number.POSITIVE_INFINITY,
): ContentRange[] {
  return getRawTextHtmlRangesForTags(content, range, HTML_RAW_TEXT_TAGS, maxRanges);
}

export function getSanitizerDroppedRawHtmlRanges(
  content: string,
  range: ContentRange,
  maxRanges = Number.POSITIVE_INFINITY,
): ContentRange[] {
  return getRawTextHtmlRangesForTags(content, range, SANITIZER_DROPPED_RAW_HTML_TAGS, maxRanges);
}
