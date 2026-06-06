import {
  isEscapedMarkdownPunctuation,
  isOffsetInRanges,
  type ContentRange,
} from './noteExportMarkdownRanges';
import { decodeMarkdownHtmlText } from '@/lib/notes/markdown/markdownHtmlText';
import type { ExportMarkdownAssetSourceToken } from './noteExportMarkdownAssetTypes';

const TAG_ASSET_ATTRIBUTES: Record<string, Set<string>> = {
  img: new Set(['src']),
  source: new Set(['srcset']),
  video: new Set(['poster']),
};

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

function isHtmlTagStart(content: string, start: number): boolean {
  let cursor = start + 1;
  if (content[cursor] === '/') {
    cursor += 1;
  }
  if (!isAsciiAlpha(content[cursor])) {
    return false;
  }
  cursor += 1;
  while (isHtmlNameChar(content[cursor])) {
    cursor += 1;
  }
  const next = content[cursor];
  return next === undefined || /\s/.test(next) || next === '/' || next === '>';
}

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
    if (!isHtmlTagStart(content, start)) {
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

function parseSrcsetAssetTokens(
  value: string,
  valueStart: number,
  maxTokens = Number.POSITIVE_INFINITY,
): ExportMarkdownAssetSourceToken[] {
  const tokens: ExportMarkdownAssetSourceToken[] = [];
  let candidateStart = 0;
  let skippedDataUrlComma = false;

  const pushCandidate = (start: number, end: number) => {
    if (tokens.length >= maxTokens) {
      return;
    }
    let cursor = start;
    while (cursor < end && /\s/.test(value[cursor])) {
      cursor += 1;
    }

    const sourceStart = cursor;
    while (cursor < end && !/\s/.test(value[cursor])) {
      cursor += 1;
    }
    const sourceEnd = cursor;
    const src = value.slice(sourceStart, sourceEnd);
    if (src) {
      tokens.push({
        start: valueStart + sourceStart,
        end: valueStart + sourceEnd,
        src,
        lookupSrc: decodeMarkdownHtmlText(src),
      });
    }
  };

  for (let cursor = 0; cursor < value.length && tokens.length < maxTokens; cursor += 1) {
    if (value[cursor] !== ',') {
      continue;
    }

    const candidatePrefix = value.slice(candidateStart, cursor).trimStart();
    if (!skippedDataUrlComma && /^data:/i.test(candidatePrefix)) {
      skippedDataUrlComma = true;
      continue;
    }

    if (value.slice(candidateStart, cursor).trim()) {
      pushCandidate(candidateStart, cursor);
    }
    candidateStart = cursor + 1;
    skippedDataUrlComma = false;
  }

  if (tokens.length < maxTokens && value.slice(candidateStart).trim()) {
    pushCandidate(candidateStart, value.length);
  }

  return tokens;
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
  if (!tagName || !TAG_ASSET_ATTRIBUTES[tagName]) {
    return [];
  }
  const tagPrefix = tagMatch[0];

  const tokens: ExportMarkdownAssetSourceToken[] = [];
  const allowedAttributes = TAG_ASSET_ATTRIBUTES[tagName];
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

    if (allowedAttributes.has(attrName)) {
      const rawSrc = content.slice(valueStart, valueEnd);
      const lookupSrc = decodeMarkdownHtmlText(rawSrc.trim());
      if (!lookupSrc) {
        continue;
      }
      if (attrName === 'srcset') {
        tokens.push(...parseSrcsetAssetTokens(
          content.slice(valueStart, valueEnd),
          valueStart,
          maxTokens - tokens.length,
        ));
      } else {
        tokens.push({
          start: valueStart,
          end: valueEnd,
          src: rawSrc,
          lookupSrc,
        });
      }
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
