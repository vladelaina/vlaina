import {
  isEscapedMarkdownPunctuation,
  isOffsetInRanges,
  type ContentRange,
} from './noteExportMarkdownRanges';
import { decodeMarkdownHtmlText } from '@/lib/notes/markdown/markdownHtmlText';
import type { ExportMarkdownAssetSourceToken } from './noteExportMarkdownAssetTypes';

function findHtmlTagEnd(content: string, start: number): number {
  let quote: string | null = null;

  for (let cursor = start + 1; cursor < content.length; cursor += 1) {
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

export function getHtmlTagRanges(content: string): ContentRange[] {
  const ranges: ContentRange[] = [];
  let cursor = 0;

  while (cursor < content.length) {
    const start = content.indexOf('<', cursor);
    if (start === -1) {
      break;
    }
    if (isEscapedMarkdownPunctuation(content, start)) {
      cursor = start + 1;
      continue;
    }

    const end = findHtmlTagEnd(content, start);
    if (end === -1) {
      break;
    }
    ranges.push({ start, end });
    cursor = end;
  }

  return ranges;
}

function parseHtmlImageSrcRange(
  content: string,
  tagStart: number,
  tagEnd: number,
): ExportMarkdownAssetSourceToken | null {
  if (!/^<img\b/i.test(content.slice(tagStart, tagEnd))) {
    return null;
  }

  let cursor = tagStart + 4;
  while (cursor < tagEnd) {
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

    if (attrName === 'src') {
      const src = content.slice(valueStart, valueEnd).trim();
      return src ? { start: valueStart, end: valueEnd, src, lookupSrc: decodeMarkdownHtmlText(src) } : null;
    }
  }

  return null;
}

export function findHtmlImageSourceTokens(
  content: string,
  ignoredRanges: readonly ContentRange[],
  htmlTagRanges: readonly ContentRange[],
): ExportMarkdownAssetSourceToken[] {
  return htmlTagRanges.flatMap((range) => {
    if (
      isOffsetInRanges(range.start, ignoredRanges) ||
      isEscapedMarkdownPunctuation(content, range.start)
    ) {
      return [];
    }
    const token = parseHtmlImageSrcRange(content, range.start, range.end);
    return token ? [token] : [];
  });
}
