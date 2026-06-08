import {
  isEscapedMarkdownPunctuation,
  isOffsetInRanges,
  type ContentRange,
} from './noteExportMarkdownRanges';
import { decodeMarkdownHtmlText } from '@/lib/notes/markdown/markdownHtmlText';
import type { ExportMarkdownAssetSourceToken } from './noteExportMarkdownAssetTypes';

export interface HtmlTagRangeScan {
  ranges: ContentRange[];
  exhaustedAt: number | null;
}

const MAX_HTML_IMAGE_ATTR_CHARS = 16 * 1024;

function isAsciiAlpha(char: string | undefined): boolean {
  if (char === undefined) {
    return false;
  }
  return (char >= 'A' && char <= 'Z') || (char >= 'a' && char <= 'z');
}

function isHtmlNameChar(char: string | undefined): boolean {
  if (char === undefined) {
    return false;
  }
  return isAsciiAlpha(char) || (char >= '0' && char <= '9') || char === ':' || char === '-';
}

function isHtmlTagStart(content: string, start: number, end = content.length): boolean {
  let cursor = start + 1;
  if (content[cursor] === '/') {
    cursor += 1;
  }
  if (cursor >= end || !isAsciiAlpha(content[cursor])) {
    return false;
  }
  cursor += 1;
  while (cursor < end && isHtmlNameChar(content[cursor])) {
    cursor += 1;
  }
  const next = content[cursor];
  return next === undefined || /\s/.test(next) || next === '/' || next === '>';
}

function findHtmlTagEnd(content: string, start: number, end = content.length): number {
  let quote: string | null = null;

  for (let cursor = start + 1; cursor < end; cursor += 1) {
    const char = content[cursor];
    if (quote) {
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '>') {
      return cursor + 1;
    }
  }

  return -1;
}

function findHtmlCommentEnd(content: string, start: number, end = content.length): number {
  const close = content.indexOf('-->', start + 4);
  return close === -1 || close + 3 > end ? end : close + 3;
}

function findHtmlCdataEnd(content: string, start: number, end = content.length): number {
  const close = content.indexOf(']]>', start + 9);
  return close === -1 || close + 3 > end ? end : close + 3;
}

function findHtmlProcessingInstructionEnd(content: string, start: number, end = content.length): number {
  const close = content.indexOf('?>', start + 2);
  return close === -1 || close + 2 > end ? end : close + 2;
}

function findHtmlDeclarationEnd(content: string, start: number, end = content.length): number {
  const close = content.indexOf('>', start + 2);
  return close === -1 || close + 1 > end ? end : close + 1;
}

function findHtmlNonTagEnd(content: string, start: number, end = content.length): number | null {
  if (content.startsWith('<!--', start)) return findHtmlCommentEnd(content, start, end);
  if (content.startsWith('<![CDATA[', start)) return findHtmlCdataEnd(content, start, end);
  if (content.startsWith('<?', start)) return findHtmlProcessingInstructionEnd(content, start, end);
  if (content.startsWith('<!', start)) return findHtmlDeclarationEnd(content, start, end);
  return null;
}

export function collectHtmlTagRanges(
  content: string,
  maxRanges = Number.POSITIVE_INFINITY,
  range: ContentRange = { start: 0, end: content.length },
): HtmlTagRangeScan {
  const rangeLimit = Number.isFinite(maxRanges)
    ? Math.max(0, Math.floor(maxRanges))
    : maxRanges === Number.POSITIVE_INFINITY ? Number.POSITIVE_INFINITY : 0;
  if (rangeLimit <= 0) return { ranges: [], exhaustedAt: 0 };

  const ranges: ContentRange[] = [];
  const rangeStart = Math.max(0, Math.min(content.length, range.start));
  const rangeEnd = Math.max(rangeStart, Math.min(content.length, range.end));
  let cursor = rangeStart;

  while (cursor < rangeEnd) {
    const start = content.indexOf('<', cursor);
    if (start === -1 || start >= rangeEnd) {
      break;
    }
    if (isEscapedMarkdownPunctuation(content, start)) {
      cursor = start + 1;
      continue;
    }
    const nonTagEnd = findHtmlNonTagEnd(content, start, rangeEnd);
    if (nonTagEnd !== null) {
      cursor = nonTagEnd;
      continue;
    }
    if (!isHtmlTagStart(content, start, rangeEnd)) {
      cursor = start + 1;
      continue;
    }

    const end = findHtmlTagEnd(content, start, rangeEnd);
    if (end === -1) {
      break;
    }
    ranges.push({ start, end });
    cursor = end;
    if (ranges.length >= rangeLimit) {
      return { ranges, exhaustedAt: cursor };
    }
  }

  return { ranges, exhaustedAt: null };
}

export function getHtmlTagRanges(content: string): ContentRange[] {
  return collectHtmlTagRanges(content).ranges;
}

function parseHtmlImageAssetRanges(
  content: string,
  tagStart: number,
  tagEnd: number,
  maxTokens = Number.POSITIVE_INFINITY,
): ExportMarkdownAssetSourceToken[] {
  const tagMatch = /^<([A-Za-z][A-Za-z0-9:-]*)\b/.exec(content.slice(tagStart, tagEnd));
  if (!tagMatch) {
    return [];
  }
  const tagName = tagMatch[1]?.toLowerCase();
  if (tagName !== 'img') {
    return [];
  }
  const tagPrefix = tagMatch[0];

  const tokens: ExportMarkdownAssetSourceToken[] = [];
  let cursor = tagStart + tagPrefix.length;
  while (cursor < tagEnd && tokens.length < maxTokens) {
    while (cursor < tagEnd && /\s/.test(content[cursor])) {
      cursor += 1;
    }
    if (cursor >= tagEnd || content[cursor] === '>' || content[cursor] === '/') {
      cursor += 1;
      continue;
    }

    const nameStart = cursor;
    while (cursor < tagEnd && !/[\s"'<>/=]/.test(content[cursor])) {
      cursor += 1;
    }
    if (cursor === nameStart) {
      cursor += 1;
      continue;
    }

    const attrName = content.slice(nameStart, cursor).toLowerCase();
    while (cursor < tagEnd && /\s/.test(content[cursor])) {
      cursor += 1;
    }
    if (content[cursor] !== '=') {
      continue;
    }

    cursor += 1;
    while (cursor < tagEnd && /\s/.test(content[cursor])) {
      cursor += 1;
    }

    let valueStart = cursor;
    let valueEnd = cursor;
    const quote = content[cursor];
    if (quote === '"' || quote === "'") {
      valueStart = cursor + 1;
      valueEnd = content.indexOf(quote, valueStart);
      if (valueEnd === -1 || valueEnd > tagEnd) {
        valueEnd = tagEnd;
      }
      cursor = valueEnd + 1;
    } else {
      while (cursor < tagEnd && !/[\s"'<>]/.test(content[cursor])) {
        cursor += 1;
      }
      valueEnd = cursor;
    }

    const rawValueLength = valueEnd - valueStart;
    if (rawValueLength > MAX_HTML_IMAGE_ATTR_CHARS) {
      return tokens;
    }

    if (attrName === 'src') {
      const rawSrc = content.slice(valueStart, valueEnd);
      const lookupSrc = decodeMarkdownHtmlText(rawSrc.trim());
      if (!lookupSrc) {
        continue;
      }
      tokens.push({
        start: valueStart,
        end: valueEnd,
        src: rawSrc,
        lookupSrc,
      });
    }
  }

  return tokens;
}

export function findHtmlImageSourceTokens(
  content: string,
  ignoredRanges: readonly ContentRange[],
  htmlTagRanges: readonly ContentRange[],
  maxTokens = Number.POSITIVE_INFINITY,
): ExportMarkdownAssetSourceToken[] {
  const tokens: ExportMarkdownAssetSourceToken[] = [];
  for (const range of htmlTagRanges) {
    if (
      isOffsetInRanges(range.start, ignoredRanges) ||
      isEscapedMarkdownPunctuation(content, range.start)
    ) {
      continue;
    }
    tokens.push(...parseHtmlImageAssetRanges(
      content,
      range.start,
      range.end,
      maxTokens - tokens.length,
    ));
    if (tokens.length >= maxTokens) {
      break;
    }
  }
  return tokens;
}
