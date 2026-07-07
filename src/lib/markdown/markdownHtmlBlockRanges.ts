import type { ContentRange } from './markdownRanges';
import {
  getMarkdownBlockContent,
  getMarkdownBlockContentStartOffset,
  getMarkdownHtmlBlockClosePattern,
  getMarkdownInvisibleHtmlBlockClosePattern,
} from './markdownHtmlBlockClassification';
import { isEscapedMarkdownPunctuation } from './markdownEscapes';
import { normalizeRangeLimit } from './markdownRangeLimits';

export function getMarkdownHtmlBlockRanges(
  content: string,
  range: ContentRange,
  maxRanges = Number.POSITIVE_INFINITY,
): ContentRange[] {
  const rangeLimit = normalizeRangeLimit(maxRanges);
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
    const blockContent = getMarkdownBlockContent(line);
    const blockContentStartOffset = getMarkdownBlockContentStartOffset(line);
    const firstNonBlank = blockContent.search(/\S/);

    if (activeStart !== null) {
      const closePattern = activeClosePattern;
      if (
        (closePattern && closePattern.test(blockContent))
        || (!closePattern && blockContent.trim() === "")
      ) {
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
      firstNonBlank >= 0
      && !isEscapedMarkdownPunctuation(content, offset + blockContentStartOffset + firstNonBlank, range.start)
        ? getMarkdownHtmlBlockClosePattern(blockContent)
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

export function getMarkdownInvisibleHtmlBlockRanges(
  content: string,
  range: ContentRange,
  maxRanges = Number.POSITIVE_INFINITY,
): ContentRange[] {
  const rangeLimit = normalizeRangeLimit(maxRanges);
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
    const blockContent = getMarkdownBlockContent(line);
    const blockContentStartOffset = getMarkdownBlockContentStartOffset(line);
    const firstNonBlank = blockContent.search(/\S/);

    if (activeStart !== null) {
      if (activeClosePattern?.test(blockContent)) {
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
      firstNonBlank >= 0
      && !isEscapedMarkdownPunctuation(content, offset + blockContentStartOffset + firstNonBlank, range.start)
        ? getMarkdownInvisibleHtmlBlockClosePattern(blockContent)
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
