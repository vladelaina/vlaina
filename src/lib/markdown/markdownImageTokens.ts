import {
  getHtmlCommentRanges,
  getHtmlTagRanges,
  getInlineCodeRanges,
  getMarkdownHtmlBlockRanges,
  getNonFencedContentRanges,
  getRangeEndAtOffset,
  getRawTextHtmlRanges,
  isEscapedMarkdownPunctuation,
  isOffsetInRanges,
  type ContentRange,
} from './markdownRanges';
import { parseHtmlImageSrcTokenFromTag } from './markdownHtmlImageSrc';
import { parseMarkdownImageClosingParen } from './markdownImageTitle';
import { decodeMarkdownHtmlText } from '@/lib/notes/markdown/markdownHtmlText';

export interface ImageToken {
  start: number;
  end: number;
  src: string | null;
  targetStart?: number;
  targetEnd?: number;
}

export interface ImageTokenParseOptions {
  maxTokens?: number;
}

const MAX_DEFAULT_IMAGE_TOKENS = 2000;

function getMaxTokens(options?: ImageTokenParseOptions): number {
  const value = options?.maxTokens;
  if (value === undefined) return Number.POSITIVE_INFINITY;
  if (!Number.isFinite(value)) return value === Number.POSITIVE_INFINITY ? value : 0;
  return Math.max(0, Math.floor(value));
}

function normalizeImageMarkdownTarget(rawTarget: string): string | null {
  const trimmed = rawTarget.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("<") && trimmed.endsWith(">")) {
    const wrapped = decodeMarkdownHtmlText(unescapeMarkdownLinkDestination(trimmed.slice(1, -1).trim()));
    return wrapped || null;
  }

  const firstSegment = decodeMarkdownHtmlText(unescapeMarkdownLinkDestination(trimmed.split(/\s+/)[0]?.trim() ?? ''));
  return firstSegment || null;
}

const MARKDOWN_LINK_DESTINATION_ESCAPE_PATTERN = /\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g;
const MARKDOWN_LINK_DESTINATION_ESCAPE_AT_PATTERN = /^\\[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]$/;
const MAX_HTML_IMAGE_TAG_SCAN_RANGES = 4000;
const MAX_HTML_IMAGE_MARKDOWN_PROTECTION_RANGES = 2000;

function unescapeMarkdownLinkDestination(value: string): string {
  return value.replace(MARKDOWN_LINK_DESTINATION_ESCAPE_PATTERN, '$1');
}

function parseMarkdownImageTarget(
  content: string,
  targetStart: number,
): { raw: string; targetStart: number; targetEnd: number; end: number } | null {
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
    let closingAngle = rawStart;
    while (closingAngle < length) {
      if (content[closingAngle] === ">" && !isEscapedMarkdownPunctuation(content, closingAngle, rawStart)) {
        break;
      }
      closingAngle += 1;
    }
    if (closingAngle === -1) {
      return null;
    }
    if (closingAngle >= length) {
      return null;
    }

    const end = parseMarkdownImageClosingParen(content, closingAngle + 1);
    if (end === null) {
      return null;
    }
    return {
      raw: content.slice(pos, closingAngle + 1),
      targetStart: rawStart,
      targetEnd: closingAngle,
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
      return end === null ? null : { raw, targetStart: rawStart, targetEnd: rawStart + raw.length, end };
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
          targetStart: rawStart,
          targetEnd: rawStart + raw.length,
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

interface MarkdownImageTokenRangeScan {
  exhausted: boolean;
  tokens: ImageToken[];
}

function normalizeInternalTokenLimit(value: number): number {
  if (value === Number.POSITIVE_INFINITY) {
    return Number.POSITIVE_INFINITY;
  }
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.floor(value));
}

function collectMarkdownImageTokensInRange(
  content: string,
  range: ContentRange,
  maxTokens = Number.POSITIVE_INFINITY,
): MarkdownImageTokenRangeScan {
  const tokenLimit = normalizeInternalTokenLimit(maxTokens);
  if (tokenLimit <= 0) {
    return { exhausted: true, tokens: [] };
  }

  const tokens: ImageToken[] = [];
  const inlineCodeRanges = getInlineCodeRanges(content, range);
  const htmlCommentRanges = getHtmlCommentRanges(content, range);
  const htmlTagRanges = getHtmlTagRanges(content, range);
  const htmlBlockRanges = getMarkdownHtmlBlockRanges(content, range);
  const rawTextHtmlRanges = getRawTextHtmlRanges(content, range);
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
      isOffsetInRanges(imageStart, rawTextHtmlRanges) ||
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
      targetStart: parsed.targetStart,
      targetEnd: parsed.targetEnd,
    });
    if (tokens.length >= tokenLimit) {
      return { exhausted: true, tokens };
    }
    cursor = parsed.end;
  }

  return { exhausted: false, tokens };
}

function parseMarkdownImageTokensInRange(
  content: string,
  range: ContentRange,
  maxTokens = Number.POSITIVE_INFINITY,
): ImageToken[] {
  return collectMarkdownImageTokensInRange(content, range, maxTokens).tokens;
}

function parseHtmlImageTokensInRange(
  content: string,
  range: ContentRange,
  markdownImageRanges = parseMarkdownImageTokensInRange(content, range),
  maxTokens = Number.POSITIVE_INFINITY,
): ImageToken[] {
  const tokens: ImageToken[] = [];
  const inlineCodeRanges = getInlineCodeRanges(content, range);
  const htmlCommentRanges = getHtmlCommentRanges(content, range);
  const rawTextHtmlRanges = getRawTextHtmlRanges(content, range);
  const htmlTagRanges = getHtmlTagRanges(
    content,
    range,
    Number.isFinite(maxTokens) ? MAX_HTML_IMAGE_TAG_SCAN_RANGES : Number.POSITIVE_INFINITY,
  );

  for (const tagRange of htmlTagRanges) {
    const start = tagRange.start;
    if (
      isOffsetInRanges(start, inlineCodeRanges) ||
      isOffsetInRanges(start, htmlCommentRanges) ||
      isOffsetInRanges(start, rawTextHtmlRanges) ||
      isOffsetInRanges(start, markdownImageRanges) ||
      isEscapedMarkdownPunctuation(content, start, range.start)
    ) {
      continue;
    }

    const srcToken = parseHtmlImageSrcTokenFromTag(content.slice(start, tagRange.end));
    if (!srcToken) {
      continue;
    }
    tokens.push({
      start,
      end: tagRange.end,
      src: srcToken.src,
      targetStart: start + srcToken.valueStart,
      targetEnd: start + srcToken.valueEnd,
    });
    if (tokens.length >= maxTokens) {
      break;
    }
  }

  return tokens;
}

export function parseMarkdownImageTokens(content: string, options?: ImageTokenParseOptions): ImageToken[] {
  const maxTokens = getMaxTokens(options);
  if (maxTokens <= 0 || !content.includes("![")) {
    return [];
  }

  const tokens: ImageToken[] = [];
  for (const range of getNonFencedContentRanges(content)) {
    if (tokens.length >= maxTokens) break;
    tokens.push(...parseMarkdownImageTokensInRange(content, range, maxTokens - tokens.length));
  }
  return tokens;
}

export function parseHtmlImageTokens(content: string, options?: ImageTokenParseOptions): ImageToken[] {
  const maxTokens = getMaxTokens(options);
  if (maxTokens <= 0 || !content.includes("<")) {
    return [];
  }

  const tokens: ImageToken[] = [];
  const mayContainMarkdownImages = content.includes("![");
  for (const range of getNonFencedContentRanges(content)) {
    if (tokens.length >= maxTokens) break;
    const markdownImageScan = mayContainMarkdownImages
      ? collectMarkdownImageTokensInRange(
          content,
          range,
          Number.isFinite(maxTokens)
            ? MAX_HTML_IMAGE_MARKDOWN_PROTECTION_RANGES + 1
            : Number.POSITIVE_INFINITY,
        )
      : { exhausted: false, tokens: [] };
    if (markdownImageScan.tokens.length > MAX_HTML_IMAGE_MARKDOWN_PROTECTION_RANGES || markdownImageScan.exhausted) {
      continue;
    }
    const markdownImageRanges = markdownImageScan.tokens;
    tokens.push(...parseHtmlImageTokensInRange(content, range, markdownImageRanges, maxTokens - tokens.length));
  }
  return tokens;
}

export function parseMarkdownAndHtmlImageTokens(content: string, options?: ImageTokenParseOptions): ImageToken[] {
  const maxTokens = getMaxTokens(options);
  if (maxTokens <= 0 || (!content.includes("![") && !content.includes("<"))) {
    return [];
  }

  const tokens: ImageToken[] = [];
  const mayContainMarkdownImages = content.includes("![");
  for (const range of getNonFencedContentRanges(content)) {
    if (tokens.length >= maxTokens) break;
    const remainingTokens = maxTokens - tokens.length;
    const markdownProtectionLimit = Number.isFinite(maxTokens)
      ? Math.max(remainingTokens, MAX_HTML_IMAGE_MARKDOWN_PROTECTION_RANGES + 1)
      : Number.POSITIVE_INFINITY;
    const markdownImageScan = mayContainMarkdownImages
      ? collectMarkdownImageTokensInRange(content, range, markdownProtectionLimit)
      : { exhausted: false, tokens: [] };
    const markdownImageTokens = markdownImageScan.tokens;
    const htmlImageTokens = parseHtmlImageTokensInRange(content, range, markdownImageTokens, remainingTokens);
    tokens.push(
      ...[...markdownImageTokens, ...htmlImageTokens]
        .sort((a, b) => a.start - b.start)
        .slice(0, remainingTokens)
    );
  }
  return tokens;
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
  return replaceImageTokens(content, parseMarkdownImageTokens(content, { maxTokens: MAX_DEFAULT_IMAGE_TOKENS }), replacement);
}

export function stripMarkdownImageTokens(content: string): string {
  return replaceMarkdownImageTokens(content, "");
}
