import {
  getSanitizerDroppedRawHtmlRanges,
  type ContentRange,
} from '@/lib/markdown/markdownHtmlRanges';
import { getMarkdownInvisibleHtmlBlockRanges } from '@/lib/markdown/markdownRanges';
import {
  MAX_CONTENT_SEARCH_HTML_RANGES,
  MAX_CONTENT_SEARCH_SCANNED_CHARS,
} from './notesSidebarContentSearchLimits';

const MAX_CONTENT_SEARCH_LINE_CHARS = 64 * 1024;
const MAX_CONTENT_SEARCH_FRONTMATTER_CHARS = 256 * 1024;
const MAX_CONTENT_SEARCH_FRONTMATTER_LINES = 2048;
const UTF8_BOM = '\uFEFF';
const FRONTMATTER_DELIMITER_PATTERN = /^---[ \t]*$/;
const SANITIZER_DROPPED_RAW_HTML_TAG_PATTERN = /<\/?(?:math|noscript|svg)(?:[\s/>]|$)/i;
const INVISIBLE_HTML_BLOCK_PATTERN = /^(?: {0,3}>[ \t]?)*(?: {0,3})(?:<!--|<\?|<![A-Z]|<!\[CDATA\[)/im;

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

export function getSkippedRangesForContentSearch(content: string): ContentRange[] {
  const ranges = getSkippedHtmlRangesForContentSearch(content);
  const frontmatterRange = getLeadingFrontmatterRangeForContentSearch(content);
  if (!frontmatterRange) {
    return ranges;
  }
  return [frontmatterRange, ...ranges]
    .sort((left, right) => left.start - right.start || left.end - right.end);
}
