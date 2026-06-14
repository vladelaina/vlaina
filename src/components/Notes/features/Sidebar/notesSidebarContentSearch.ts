import { stripMarkdownInline } from '@/components/common/markdown/plainText';
import {
  collectHtmlTagRanges,
  getSanitizerDroppedRawHtmlRanges,
  type ContentRange,
} from '@/lib/markdown/markdownHtmlRanges';
import { getHtmlCommentRanges, getMarkdownInvisibleHtmlBlockRanges } from '@/lib/markdown/markdownRanges';
import { decodeMarkdownHtmlText } from '@/lib/notes/markdown/markdownHtmlText';

const CONTENT_SNIPPET_RADIUS = 36;
const MAX_CONTENT_MATCHES_PER_NOTE = 5;
const MAX_CONTENT_SEARCH_LINE_CHARS = 64 * 1024;
export const MAX_CONTENT_SEARCH_SCANNED_CHARS = 1024 * 1024;
const MAX_CONTENT_SEARCH_FRONTMATTER_CHARS = 256 * 1024;
const MAX_CONTENT_SEARCH_FRONTMATTER_LINES = 2048;
export const MAX_CONTENT_SEARCH_HTML_RANGES = 2000;
const UTF8_BOM = '\uFEFF';
const FRONTMATTER_DELIMITER_PATTERN = /^---[ \t]*$/;
const SANITIZER_DROPPED_RAW_HTML_TAG_PATTERN = /<\/?(?:math|noscript|svg)(?:[\s/>]|$)/i;
const INVISIBLE_HTML_BLOCK_PATTERN = /^(?: {0,3}>[ \t]?)*(?: {0,3})(?:<!--|<\?|<![A-Z]|<!\[CDATA\[)/im;

export interface NotesSidebarContentMatch {
  matchIndex: number;
  snippet: string;
  ordinal: number;
}

function normalizeContentForSearch(content: string): string {
  return content.replace(/\s+/g, ' ').trim();
}

function normalizeSearchTextWithOffsets(value: string): {
  text: string;
  startOffsets: number[];
  endOffsets: number[];
} {
  let text = '';
  const startOffsets: number[] = [];
  const endOffsets: number[] = [0];

  for (let index = 0; index < value.length;) {
    const codePoint = value.codePointAt(index);
    const source = codePoint === undefined ? value[index] : String.fromCodePoint(codePoint);
    const sourceLength = source.length;
    const sourceEnd = index + sourceLength;
    const normalized = source.toLocaleLowerCase();
    const normalizedStart = text.length;

    for (let offset = 0; offset < normalized.length; offset += 1) {
      startOffsets[normalizedStart + offset] = index;
      endOffsets[normalizedStart + offset + 1] = sourceEnd;
    }

    text += normalized;
    index = sourceEnd;
  }

  startOffsets[text.length] = value.length;
  endOffsets[text.length] = value.length;

  return { text, startOffsets, endOffsets };
}

function stripInlineHtmlTags(line: string): string {
  if (!line.includes('<')) {
    return line;
  }

  const htmlTagScan = collectHtmlTagRanges(line, { start: 0, end: line.length });
  const ranges = [
    ...getHtmlCommentRanges(line, { start: 0, end: line.length }),
    ...htmlTagScan.ranges,
    ...htmlTagScan.protectedRanges,
  ].sort((left, right) => left.start - right.start || left.end - right.end);
  if (ranges.length === 0) {
    return line;
  }

  const parts: string[] = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start < cursor) {
      cursor = Math.max(cursor, range.end);
      continue;
    }
    parts.push(line.slice(cursor, range.start));
    cursor = range.end;
  }
  parts.push(line.slice(cursor));
  return parts.join('');
}

function toPlainTextLine(line: string): string {
  return decodeMarkdownHtmlText(stripMarkdownInline(stripInlineHtmlTags(line), { preserveImageAlt: false }))
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
  nextStart: number;
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
      nextStart: charCode === 13 && content.charCodeAt(index + 1) === 10 ? index + 2 : index + 1,
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
    nextStart: content.length,
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
  }, MAX_CONTENT_SEARCH_HTML_RANGES);
}

function getInvisibleHtmlBlockRangesForContentSearch(content: string): ContentRange[] {
  if (!INVISIBLE_HTML_BLOCK_PATTERN.test(content)) {
    return [];
  }

  return getMarkdownInvisibleHtmlBlockRanges(content, {
    start: 0,
    end: Math.min(content.length, MAX_CONTENT_SEARCH_SCANNED_CHARS + MAX_CONTENT_SEARCH_LINE_CHARS),
  }, MAX_CONTENT_SEARCH_HTML_RANGES);
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

function getLeadingFrontmatterRangeForContentSearch(content: string): ContentRange | null {
  const firstLineEnd = content.search(/\r?\n/);
  const firstLine = firstLineEnd === -1 ? content : content.slice(0, firstLineEnd);
  const firstLineWithoutBom = firstLine.startsWith(UTF8_BOM) ? firstLine.slice(1) : firstLine;
  if (!FRONTMATTER_DELIMITER_PATTERN.test(firstLineWithoutBom)) {
    return null;
  }

  let cursor = firstLineEnd === -1 ? content.length : firstLineEnd + (content[firstLineEnd] === '\r' && content[firstLineEnd + 1] === '\n' ? 2 : 1);
  let lines = 0;
  const budgetEnd = cursor + MAX_CONTENT_SEARCH_FRONTMATTER_CHARS;

  while (cursor < content.length && cursor <= budgetEnd && lines < MAX_CONTENT_SEARCH_FRONTMATTER_LINES) {
    const nextLineBreak = content.indexOf('\n', cursor);
    const lineEnd = nextLineBreak === -1 ? content.length : nextLineBreak;
    const rawLine = content.slice(cursor, lineEnd);
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
    if (lineEnd > budgetEnd) {
      return null;
    }
    const nextStart = nextLineBreak === -1 ? content.length : nextLineBreak + 1;

    if (FRONTMATTER_DELIMITER_PATTERN.test(line)) {
      return { start: 0, end: nextStart };
    }

    cursor = nextStart;
    lines += 1;
  }

  return null;
}

function getSkippedRangesForContentSearch(content: string): ContentRange[] {
  const ranges = getSkippedHtmlRangesForContentSearch(content);
  const frontmatterRange = getLeadingFrontmatterRangeForContentSearch(content);
  if (!frontmatterRange) {
    return ranges;
  }
  return [frontmatterRange, ...ranges]
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
  if (!content || !lowerQuery) {
    return [];
  }

  const matches: NotesSidebarContentMatch[] = [];
  const skippedRanges = getSkippedRangesForContentSearch(content);
  let skippedRangeIndex = 0;
  let ordinal = 0;
  let scannedChars = 0;
  for (const line of iterateLines(content)) {
    if (scannedChars >= MAX_CONTENT_SEARCH_SCANNED_CHARS) {
      break;
    }

    const rawLine = line.text;
    scannedChars += Math.max(1, line.nextStart - line.start);
    if (rawLine.length > MAX_CONTENT_SEARCH_LINE_CHARS) {
      continue;
    }
    skippedRangeIndex = advanceRangeIndex(
      skippedRanges,
      line.start,
      skippedRangeIndex,
    );
    if (isLineInRange(line, skippedRanges[skippedRangeIndex])) {
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

    const normalizedSearchContent = normalizeSearchTextWithOffsets(normalizedContent);
    const lowerContent = normalizedSearchContent.text;
    let searchFrom = 0;

    while (searchFrom <= lowerContent.length - lowerQuery.length) {
      const matchIndex = lowerContent.indexOf(lowerQuery, searchFrom);
      if (matchIndex === -1) {
        break;
      }

      const sourceMatchIndex = normalizedSearchContent.startOffsets[matchIndex] ?? matchIndex;
      const sourceMatchEnd = normalizedSearchContent.endOffsets[matchIndex + lowerQuery.length] ?? normalizedContent.length;
      const start = Math.max(0, sourceMatchIndex - CONTENT_SNIPPET_RADIUS);
      const end = Math.min(
        normalizedContent.length,
        sourceMatchEnd + CONTENT_SNIPPET_RADIUS,
      );
      const snippet = normalizedContent.slice(start, end).trim();

      matches.push({
        matchIndex: sourceMatchIndex,
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
