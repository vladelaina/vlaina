import {
  getHtmlCommentRanges,
  getHtmlTagRanges,
  getInlineCodeRanges,
  getMarkdownHtmlBlockRanges,
  getNonFencedContentRanges,
  getRawTextHtmlRanges,
  isEscapedMarkdownPunctuation,
  isOffsetInRanges,
  type ContentRange,
} from './markdownRanges';
import { parseHtmlImageSrcFromTag } from './markdownHtmlImageSrc';
import { parseMarkdownImageClosingParen } from './markdownImageTitle';

export interface ImageToken {
  start: number;
  end: number;
  src: string | null;
}

function normalizeImageMarkdownTarget(rawTarget: string): string | null {
  const trimmed = rawTarget.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("<") && trimmed.endsWith(">")) {
    const wrapped = unescapeMarkdownLinkDestination(trimmed.slice(1, -1).trim());
    return wrapped || null;
  }

  const firstSegment = unescapeMarkdownLinkDestination(trimmed.split(/\s+/)[0]?.trim() ?? '');
  return firstSegment || null;
}

const MARKDOWN_LINK_DESTINATION_ESCAPE_PATTERN = /\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g;
const MARKDOWN_LINK_DESTINATION_ESCAPE_AT_PATTERN = /^\\[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]$/;

function unescapeMarkdownLinkDestination(value: string): string {
  return value.replace(MARKDOWN_LINK_DESTINATION_ESCAPE_PATTERN, '$1');
}

function parseMarkdownImageTarget(content: string, targetStart: number): { raw: string; end: number } | null {
  let pos = targetStart;
  const length = content.length;

  while (pos < length && /\s/.test(content[pos])) {
    pos += 1;
  }
  if (pos >= length) {
    return null;
  }

  if (content[pos] === "<") {
    const rawStart = pos + 1;
    const closingAngle = content.indexOf(">", rawStart);
    if (closingAngle === -1) {
      return null;
    }

    const end = parseMarkdownImageClosingParen(content, closingAngle + 1);
    if (end === null) {
      return null;
    }
    return {
      raw: content.slice(rawStart, closingAngle),
      end,
    };
  }

  const rawStart = pos;
  let depth = 0;
  while (pos < length) {
    const ch = content[pos];
    if (ch === "\\" && pos + 1 < length && MARKDOWN_LINK_DESTINATION_ESCAPE_AT_PATTERN.test(content.slice(pos, pos + 2))) {
      pos += 2;
      continue;
    }
    if (/\s/.test(ch)) {
      const raw = content.slice(rawStart, pos).trimEnd();
      const end = parseMarkdownImageClosingParen(content, pos);
      return end === null ? null : { raw, end };
    }
    if (ch === "(") {
      depth += 1;
      pos += 1;
      continue;
    }
    if (ch === ")") {
      if (depth === 0) {
        const raw = content.slice(rawStart, pos).trimEnd();
        return {
          raw,
          end: pos + 1,
        };
      }
      depth -= 1;
      pos += 1;
      continue;
    }
    pos += 1;
  }

  return null;
}

function getRangeEndAtOffset(offset: number, ranges: ContentRange[]): number | null {
  const range = ranges.find((item) => offset >= item.start && offset < item.end);
  return range?.end ?? null;
}

function findMarkdownImageLabelEnd(
  content: string,
  labelStart: number,
  rangeEnd: number,
  inlineCodeRanges: ContentRange[],
  lowerBound: number,
): number | null {
  let cursor = labelStart;
  let nestedBracketDepth = 0;

  while (cursor < rangeEnd) {
    const inlineCodeEnd = getRangeEndAtOffset(cursor, inlineCodeRanges);
    if (inlineCodeEnd !== null) {
      cursor = inlineCodeEnd;
      continue;
    }

    const char = content[cursor];
    if (char === "[" && !isEscapedMarkdownPunctuation(content, cursor, lowerBound)) {
      nestedBracketDepth += 1;
      cursor += 1;
      continue;
    }
    if (char === "]" && !isEscapedMarkdownPunctuation(content, cursor, lowerBound)) {
      if (nestedBracketDepth === 0) {
        return cursor;
      }
      nestedBracketDepth -= 1;
      cursor += 1;
      continue;
    }

    cursor += 1;
  }

  return null;
}

function parseMarkdownImageTokensInRange(content: string, range: ContentRange): ImageToken[] {
  const tokens: ImageToken[] = [];
  const inlineCodeRanges = getInlineCodeRanges(content, range);
  const htmlCommentRanges = getHtmlCommentRanges(content, range);
  const htmlTagRanges = getHtmlTagRanges(content, range);
  const htmlBlockRanges = getMarkdownHtmlBlockRanges(content, range);
  let cursor = range.start;

  while (cursor < range.end) {
    const imageStart = content.indexOf("![", cursor);
    if (imageStart === -1 || imageStart >= range.end) {
      break;
    }
    if (
      isOffsetInRanges(imageStart, inlineCodeRanges) ||
      isOffsetInRanges(imageStart, htmlCommentRanges) ||
      isOffsetInRanges(imageStart, htmlTagRanges) ||
      isOffsetInRanges(imageStart, htmlBlockRanges) ||
      isEscapedMarkdownPunctuation(content, imageStart, range.start)
    ) {
      cursor = imageStart + 2;
      continue;
    }

    const labelEnd = findMarkdownImageLabelEnd(content, imageStart + 2, range.end, inlineCodeRanges, range.start);
    if (labelEnd === null || labelEnd + 1 >= range.end || content[labelEnd + 1] !== "(") {
      cursor = imageStart + 2;
      continue;
    }

    const parsed = parseMarkdownImageTarget(content, labelEnd + 2);
    if (!parsed || parsed.end > range.end) {
      cursor = labelEnd + 2;
      continue;
    }

    tokens.push({
      start: imageStart,
      end: parsed.end,
      src: normalizeImageMarkdownTarget(parsed.raw),
    });
    cursor = parsed.end;
  }

  return tokens;
}

function parseHtmlImageTokensInRange(content: string, range: ContentRange): ImageToken[] {
  const tokens: ImageToken[] = [];
  const inlineCodeRanges = getInlineCodeRanges(content, range);
  const htmlCommentRanges = getHtmlCommentRanges(content, range);
  const rawTextHtmlRanges = getRawTextHtmlRanges(content, range);
  const htmlTagRanges = getHtmlTagRanges(content, range);

  for (const tagRange of htmlTagRanges) {
    const start = tagRange.start;
    if (
      isOffsetInRanges(start, inlineCodeRanges) ||
      isOffsetInRanges(start, htmlCommentRanges) ||
      isOffsetInRanges(start, rawTextHtmlRanges) ||
      isEscapedMarkdownPunctuation(content, start, range.start)
    ) {
      continue;
    }

    const src = parseHtmlImageSrcFromTag(content.slice(start, tagRange.end));
    if (!src) {
      continue;
    }
    tokens.push({
      start,
      end: tagRange.end,
      src,
    });
  }

  return tokens;
}

export function parseMarkdownImageTokens(content: string): ImageToken[] {
  return getNonFencedContentRanges(content).flatMap((range) => parseMarkdownImageTokensInRange(content, range));
}

export function parseHtmlImageTokens(content: string): ImageToken[] {
  return getNonFencedContentRanges(content).flatMap((range) => parseHtmlImageTokensInRange(content, range));
}

export function replaceImageTokens(content: string, tokens: ImageToken[], replacement: string): string {
  if (tokens.length === 0) {
    return content;
  }

  const sortedTokens = [...tokens].sort((a, b) => a.start - b.start);
  const parts: string[] = [];
  let cursor = 0;

  for (const token of sortedTokens) {
    parts.push(content.slice(cursor, token.start), replacement);
    cursor = token.end;
  }
  parts.push(content.slice(cursor));
  return parts.join("");
}

export function stripImageTokens(content: string, tokens: ImageToken[]): string {
  return replaceImageTokens(content, tokens, "");
}

export function replaceMarkdownImageTokens(content: string, replacement: string): string {
  return replaceImageTokens(content, parseMarkdownImageTokens(content), replacement);
}

export function stripMarkdownImageTokens(content: string): string {
  return replaceMarkdownImageTokens(content, "");
}
