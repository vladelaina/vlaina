import {
  getIgnoredInlineRanges,
  isEscapedMarkdownPunctuation,
  isOffsetInRanges,
  type ContentRange,
} from './noteExportMarkdownRanges';
import {
  findHtmlImageSourceTokens,
  getHtmlTagRanges,
} from './noteExportMarkdownHtmlTokens';
import type { ExportMarkdownAssetSourceToken } from './noteExportMarkdownAssetTypes';

const MARKDOWN_LINK_DESTINATION_ESCAPE_PATTERN = /\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g;

function unescapeMarkdownLinkDestination(value: string): string {
  return value.replace(MARKDOWN_LINK_DESTINATION_ESCAPE_PATTERN, '$1');
}

function getRangeEndAtOffset(offset: number, ranges: readonly ContentRange[]): number | null {
  const range = ranges.find((item) => offset >= item.start && offset < item.end);
  return range?.end ?? null;
}

function findMarkdownLabelEnd(
  content: string,
  start: number,
  ignoredRanges: readonly ContentRange[],
): number | null {
  let cursor = start;
  let bracketDepth = 0;

  while (cursor < content.length) {
    const ignoredEnd = getRangeEndAtOffset(cursor, ignoredRanges);
    if (ignoredEnd !== null) {
      cursor = ignoredEnd;
      continue;
    }

    const char = content[cursor];
    if (char === '[' && !isEscapedMarkdownPunctuation(content, cursor)) {
      bracketDepth += 1;
      cursor += 1;
      continue;
    }
    if (char === ']' && !isEscapedMarkdownPunctuation(content, cursor)) {
      if (bracketDepth === 0) {
        return cursor;
      }
      bracketDepth -= 1;
      cursor += 1;
      continue;
    }

    cursor += 1;
  }

  return null;
}

function findMarkdownTargetClose(content: string, start: number): number | null {
  let cursor = start;
  let quote: string | null = null;
  let parenDepth = 0;

  while (cursor < content.length) {
    const char = content[cursor];
    if (quote) {
      if (char === quote && !isEscapedMarkdownPunctuation(content, cursor)) {
        quote = null;
      }
      cursor += 1;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      cursor += 1;
      continue;
    }
    if (char === '\\') {
      cursor += 2;
      continue;
    }
    if (char === '(') {
      parenDepth += 1;
      cursor += 1;
      continue;
    }
    if (char === ')') {
      if (parenDepth === 0) {
        return cursor + 1;
      }
      parenDepth -= 1;
    }
    cursor += 1;
  }

  return null;
}

function parseMarkdownImageTarget(
  content: string,
  start: number,
): ExportMarkdownAssetSourceToken | null {
  let cursor = start;
  while (cursor < content.length && /\s/.test(content[cursor])) {
    cursor += 1;
  }
  if (cursor >= content.length) {
    return null;
  }

  if (content[cursor] === '<') {
    const srcStart = cursor + 1;
    let srcEnd = srcStart;
    while (srcEnd < content.length && content[srcEnd] !== '>' && content[srcEnd] !== '\n') {
      srcEnd += 1;
    }
    if (srcEnd >= content.length || content[srcEnd] !== '>') {
      return null;
    }
    const tokenEnd = findMarkdownTargetClose(content, srcEnd + 1);
    const src = content.slice(srcStart, srcEnd).trim();
    const lookupSrc = unescapeMarkdownLinkDestination(src);
    return tokenEnd && src ? { start: srcStart, end: srcEnd, src, lookupSrc } : null;
  }

  const srcStart = cursor;
  let parenDepth = 0;
  while (cursor < content.length) {
    const char = content[cursor];
    if (/\s/.test(char)) {
      const tokenEnd = findMarkdownTargetClose(content, cursor);
      const src = content.slice(srcStart, cursor).trim();
      const lookupSrc = unescapeMarkdownLinkDestination(src);
      return tokenEnd && src ? { start: srcStart, end: cursor, src, lookupSrc } : null;
    }
    if (char === '\\') {
      cursor += 2;
      continue;
    }
    if (char === '(') {
      parenDepth += 1;
      cursor += 1;
      continue;
    }
    if (char === ')') {
      if (parenDepth === 0) {
        const src = content.slice(srcStart, cursor).trim();
        const lookupSrc = unescapeMarkdownLinkDestination(src);
        return src ? { start: srcStart, end: cursor, src, lookupSrc } : null;
      }
      parenDepth -= 1;
    }
    cursor += 1;
  }

  return null;
}

function findMarkdownImageSourceTokens(
  content: string,
  ignoredRanges: readonly ContentRange[],
  htmlTagRanges: readonly ContentRange[],
): ExportMarkdownAssetSourceToken[] {
  const tokens: ExportMarkdownAssetSourceToken[] = [];
  let cursor = 0;

  while (cursor < content.length) {
    const imageStart = content.indexOf('![', cursor);
    if (imageStart === -1) {
      break;
    }
    if (
      isOffsetInRanges(imageStart, ignoredRanges) ||
      isOffsetInRanges(imageStart, htmlTagRanges) ||
      isEscapedMarkdownPunctuation(content, imageStart)
    ) {
      cursor = imageStart + 2;
      continue;
    }

    const labelEnd = findMarkdownLabelEnd(content, imageStart + 2, ignoredRanges);
    if (labelEnd === null || content[labelEnd + 1] !== '(') {
      cursor = imageStart + 2;
      continue;
    }

    const token = parseMarkdownImageTarget(content, labelEnd + 2);
    if (!token) {
      cursor = labelEnd + 2;
      continue;
    }
    tokens.push(token);
    cursor = token.end;
  }

  return tokens;
}

export function findExportMarkdownAssetSourceTokens(content: string): ExportMarkdownAssetSourceToken[] {
  const ignoredRanges = getIgnoredInlineRanges(content);
  const htmlTagRanges = getHtmlTagRanges(content);
  return [
    ...findMarkdownImageSourceTokens(content, ignoredRanges, htmlTagRanges),
    ...findHtmlImageSourceTokens(content, ignoredRanges, htmlTagRanges),
  ].sort((left, right) => left.start - right.start);
}
