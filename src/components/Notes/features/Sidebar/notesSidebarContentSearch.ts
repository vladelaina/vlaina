import { stripMarkdownInline } from '@/components/common/markdown/plainText';
import { getSanitizerDroppedRawHtmlRanges, type ContentRange } from '@/lib/markdown/markdownHtmlRanges';
import { getMarkdownInvisibleHtmlBlockRanges } from '@/lib/markdown/markdownRanges';

const CONTENT_SNIPPET_RADIUS = 36;
const MAX_CONTENT_MATCHES_PER_NOTE = 5;
const MAX_CONTENT_SEARCH_LINE_CHARS = 64 * 1024;
const MAX_CONTENT_SEARCH_SCANNED_CHARS = 1024 * 1024;
const SANITIZER_DROPPED_RAW_HTML_TAG_PATTERN = /<\/?(?:math|noscript|svg)(?:[\s/>]|$)/i;
const INVISIBLE_HTML_BLOCK_PATTERN = /^(?: {0,3})(?:<!--|<\?|<![A-Z]|<!\[CDATA\[)/im;

export interface NotesSidebarContentMatch {
  matchIndex: number;
  snippet: string;
  ordinal: number;
}

function normalizeContentForSearch(content: string): string {
  return content.replace(/\s+/g, ' ').trim();
}

function isHtmlNoiseLine(line: string): boolean {
  const lowerLine = line.toLowerCase();

  if (/<\/?[a-z][^>]*>/.test(lowerLine)) {
    return true;
  }

  return /(frameborder|allowfullscreen|default-tab=|embed-version=|theme-id=|referrerpolicy=|loading=|sandbox=|src=|href=|style=|class=|width=|height=)/.test(lowerLine);
}

function toPlainTextLine(line: string): string {
  if (isHtmlNoiseLine(line)) {
    return '';
  }

  return stripMarkdownInline(line, { preserveImageAlt: false })
    .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/^\s*>\s*/g, '')
    .replace(/^\s*#{1,6}\s+/g, '')
    .replace(/^\s*[-*+]\s+\[(?: |x|X)\]\s+/g, '')
    .replace(/^\s*(?:[-*+]|\d+\.)\s+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

interface ContentSearchLine {
  end: number;
  start: number;
  text: string;
}

function* iterateLines(content: string): Iterable<ContentSearchLine> {
  let start = 0;
  for (let index = 0; index < content.length; index += 1) {
    const charCode = content.charCodeAt(index);
    if (charCode !== 10 && charCode !== 13) {
      continue;
    }

    yield {
      end: index,
      start,
      text: content.slice(start, index),
    };

    if (charCode === 13 && content.charCodeAt(index + 1) === 10) {
      index += 1;
    }
    start = index + 1;
  }

  yield {
    end: content.length,
    start,
    text: content.slice(start),
  };
}

function getDroppedRawHtmlRangesForContentSearch(content: string): ContentRange[] {
  if (!SANITIZER_DROPPED_RAW_HTML_TAG_PATTERN.test(content)) {
    return [];
  }

  return getSanitizerDroppedRawHtmlRanges(content, {
    start: 0,
    end: Math.min(content.length, MAX_CONTENT_SEARCH_SCANNED_CHARS + MAX_CONTENT_SEARCH_LINE_CHARS),
  });
}

function getInvisibleHtmlBlockRangesForContentSearch(content: string): ContentRange[] {
  if (!INVISIBLE_HTML_BLOCK_PATTERN.test(content)) {
    return [];
  }

  return getMarkdownInvisibleHtmlBlockRanges(content, {
    start: 0,
    end: Math.min(content.length, MAX_CONTENT_SEARCH_SCANNED_CHARS + MAX_CONTENT_SEARCH_LINE_CHARS),
  });
}

function getSkippedHtmlRangesForContentSearch(content: string): ContentRange[] {
  const droppedRanges = getDroppedRawHtmlRangesForContentSearch(content);
  const invisibleRanges = getInvisibleHtmlBlockRangesForContentSearch(content);
  if (droppedRanges.length === 0) {
    return invisibleRanges;
  }
  if (invisibleRanges.length === 0) {
    return droppedRanges;
  }
  return [...droppedRanges, ...invisibleRanges]
    .sort((left, right) => left.start - right.start || left.end - right.end);
}

function advanceRangeIndex(ranges: readonly ContentRange[], lineStart: number, rangeIndex: number): number {
  let nextIndex = rangeIndex;
  while (nextIndex < ranges.length && ranges[nextIndex].end <= lineStart) {
    nextIndex += 1;
  }
  return nextIndex;
}

function isLineInRange(line: ContentSearchLine, range: ContentRange | undefined): boolean {
  if (!range) {
    return false;
  }

  const lineEnd = Math.max(line.end, line.start + 1);
  return range.start < lineEnd && range.end > line.start;
}

export function getNotesSidebarContentMatches(
  content: string | undefined,
  lowerQuery: string,
): NotesSidebarContentMatch[] {
  if (!content) {
    return [];
  }

  const matches: NotesSidebarContentMatch[] = [];
  const skippedHtmlRanges = getSkippedHtmlRangesForContentSearch(content);
  let skippedHtmlRangeIndex = 0;
  let ordinal = 0;
  let scannedChars = 0;
  for (const line of iterateLines(content)) {
    if (scannedChars >= MAX_CONTENT_SEARCH_SCANNED_CHARS) {
      break;
    }

    const rawLine = line.text;
    scannedChars += rawLine.length;
    if (rawLine.length > MAX_CONTENT_SEARCH_LINE_CHARS) {
      continue;
    }
    skippedHtmlRangeIndex = advanceRangeIndex(
      skippedHtmlRanges,
      line.start,
      skippedHtmlRangeIndex,
    );
    if (isLineInRange(line, skippedHtmlRanges[skippedHtmlRangeIndex])) {
      continue;
    }

    const plainLine = toPlainTextLine(rawLine);
    if (!plainLine) {
      continue;
    }

    const normalizedContent = normalizeContentForSearch(plainLine);
    if (!normalizedContent) {
      continue;
    }

    const lowerContent = normalizedContent.toLowerCase();
    let searchFrom = 0;

    while (searchFrom <= lowerContent.length - lowerQuery.length) {
      const matchIndex = lowerContent.indexOf(lowerQuery, searchFrom);
      if (matchIndex === -1) {
        break;
      }

      const start = Math.max(0, matchIndex - CONTENT_SNIPPET_RADIUS);
      const end = Math.min(
        normalizedContent.length,
        matchIndex + lowerQuery.length + CONTENT_SNIPPET_RADIUS,
      );
      const snippet = normalizedContent.slice(start, end).trim();

      matches.push({
        matchIndex,
        snippet: `${start > 0 ? '…' : ''}${snippet}${end < normalizedContent.length ? '…' : ''}`,
        ordinal,
      });

      ordinal += 1;
      if (matches.length >= MAX_CONTENT_MATCHES_PER_NOTE) {
        return matches;
      }
      searchFrom = matchIndex + Math.max(lowerQuery.length, 1);
    }
  }

  return matches;
}
