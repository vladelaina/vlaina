import {
  collectHtmlTagRanges,
  getHtmlCommentRanges,
  getInlineCodeRanges,
  getMarkdownHtmlBlockRanges,
  getRangeEndAtOffset,
  getRawTextHtmlRanges,
  isEscapedMarkdownPunctuation,
  isOffsetInRanges,
  type ContentRange,
} from './markdownRanges';
import { parseMarkdownImageClosingParen } from './markdownImageTitle';
import type { ImageToken } from './markdownImageTokenTypes';
import { decodeMarkdownHtmlText } from '@/lib/notes/markdown/markdownHtmlText';

export interface MarkdownImageTokenRangeScan {
  exhausted: boolean;
  tokens: ImageToken[];
}

const MARKDOWN_LINK_DESTINATION_ESCAPE_PATTERN = /\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g;
const MARKDOWN_LINK_DESTINATION_ESCAPE_AT_PATTERN = /^\\[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]$/;
const MAX_MARKDOWN_IMAGE_PROTECTION_RANGES = 4000;
export const MAX_MARKDOWN_IMAGE_PART_SCAN_CHARS = 1024 * 1024;
const MAX_FAILED_MARKDOWN_IMAGE_PART_SCAN_CHARS = 4 * MAX_MARKDOWN_IMAGE_PART_SCAN_CHARS;

function sortContentRanges(ranges: ContentRange[]): ContentRange[] {
  return ranges.sort((left, right) => left.start === right.start ? left.end - right.end : left.start - right.start);
}

function getFirstMarkdownImageTargetSegment(value: string): string {
  let index = 0;
  while (index < value.length && !/\s/.test(value[index])) {
    index += 1;
  }
  return value.slice(0, index);
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

  const firstSegment = decodeMarkdownHtmlText(unescapeMarkdownLinkDestination(getFirstMarkdownImageTargetSegment(trimmed)));
  return firstSegment || null;
}

function unescapeMarkdownLinkDestination(value: string): string {
  return value.replace(MARKDOWN_LINK_DESTINATION_ESCAPE_PATTERN, '$1');
}

function parseMarkdownImageTarget(
  content: string,
  targetStart: number,
  rangeEnd: number,
): { raw: string; targetStart: number; targetEnd: number; end: number } | null {
  let pos = targetStart;
  const length = Math.min(content.length, rangeEnd, targetStart + MAX_MARKDOWN_IMAGE_PART_SCAN_CHARS);

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
    if (closingAngle >= length) {
      return null;
    }

    const end = parseMarkdownImageClosingParen(content, closingAngle + 1, length);
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
      const end = parseMarkdownImageClosingParen(content, pos, length);
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
  const scanEnd = Math.min(rangeEnd, labelStart + MAX_MARKDOWN_IMAGE_PART_SCAN_CHARS);
  let nestedBracketDepth = 0;

  while (cursor < scanEnd) {
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

function normalizeInternalTokenLimit(value: number): number {
  if (value === Number.POSITIVE_INFINITY) {
    return Number.POSITIVE_INFINITY;
  }
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.floor(value));
}

function getMarkdownImagePartScanEnd(start: number, rangeEnd: number): number {
  return Math.min(rangeEnd, start + MAX_MARKDOWN_IMAGE_PART_SCAN_CHARS);
}

function consumeFailedPartScanBudget(remainingBudget: number, start: number, end: number): number {
  return remainingBudget - Math.max(0, end - start);
}

export function collectMarkdownImageTokensInRange(
  content: string,
  range: ContentRange,
  maxTokens = Number.POSITIVE_INFINITY,
): MarkdownImageTokenRangeScan {
  const tokenLimit = normalizeInternalTokenLimit(maxTokens);
  if (tokenLimit <= 0) {
    return { exhausted: true, tokens: [] };
  }

  const tokens: ImageToken[] = [];
  const maxProtectionRanges = Number.isFinite(tokenLimit)
    ? MAX_MARKDOWN_IMAGE_PROTECTION_RANGES
    : Number.POSITIVE_INFINITY;
  const protectionRangeScanLimit = Number.isFinite(maxProtectionRanges)
    ? maxProtectionRanges + 1
    : Number.POSITIVE_INFINITY;
  const inlineCodeRanges = getInlineCodeRanges(content, range, protectionRangeScanLimit);
  const htmlCommentRanges = getHtmlCommentRanges(content, range, protectionRangeScanLimit);
  const htmlTagScan = collectHtmlTagRanges(content, range, protectionRangeScanLimit);
  const htmlTagRanges = sortContentRanges([...htmlTagScan.ranges, ...htmlTagScan.protectedRanges]);
  const htmlBlockRanges = getMarkdownHtmlBlockRanges(content, range, protectionRangeScanLimit);
  const rawTextHtmlRanges = getRawTextHtmlRanges(content, range, protectionRangeScanLimit);
  if (
    inlineCodeRanges.length > maxProtectionRanges ||
    htmlCommentRanges.length > maxProtectionRanges ||
    htmlTagRanges.length > maxProtectionRanges ||
    htmlBlockRanges.length > maxProtectionRanges ||
    rawTextHtmlRanges.length > maxProtectionRanges
  ) {
    return { exhausted: true, tokens };
  }
  let cursor = range.start;
  let remainingFailedPartScanChars = MAX_FAILED_MARKDOWN_IMAGE_PART_SCAN_CHARS;

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

    if (remainingFailedPartScanChars <= 0) {
      return { exhausted: true, tokens };
    }

    const labelScanStart = imageStart + 2;
    const labelScanEnd = getMarkdownImagePartScanEnd(labelScanStart, range.end);
    const labelEnd = findMarkdownImageLabelEnd(content, imageStart + 2, range.end, inlineCodeRanges, range.start);
    if (labelEnd === null) {
      remainingFailedPartScanChars = consumeFailedPartScanBudget(
        remainingFailedPartScanChars,
        labelScanStart,
        labelScanEnd,
      );
      cursor = imageStart + 2;
      continue;
    }
    if (labelEnd + 1 >= range.end || content[labelEnd + 1] !== "(") {
      remainingFailedPartScanChars = consumeFailedPartScanBudget(
        remainingFailedPartScanChars,
        labelScanStart,
        labelEnd + 1,
      );
      cursor = imageStart + 2;
      continue;
    }

    const targetScanStart = labelEnd + 2;
    const parsed = parseMarkdownImageTarget(content, targetScanStart, range.end);
    if (!parsed || parsed.end > range.end) {
      remainingFailedPartScanChars = consumeFailedPartScanBudget(
        remainingFailedPartScanChars,
        targetScanStart,
        getMarkdownImagePartScanEnd(targetScanStart, range.end),
      );
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

export function parseMarkdownImageTokensInRange(
  content: string,
  range: ContentRange,
  maxTokens = Number.POSITIVE_INFINITY,
): ImageToken[] {
  return collectMarkdownImageTokensInRange(content, range, maxTokens).tokens;
}
