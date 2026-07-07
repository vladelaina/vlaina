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
import {
  MAX_MARKDOWN_IMAGE_PART_SCAN_CHARS,
  normalizeImageMarkdownTarget,
  parseMarkdownImageTarget,
} from './markdownImageTokenTarget';
import type { ImageToken } from './markdownImageTokenTypes';

export { MAX_MARKDOWN_IMAGE_PART_SCAN_CHARS } from './markdownImageTokenTarget';

export interface MarkdownImageTokenRangeScan {
  exhausted: boolean;
  tokens: ImageToken[];
}

const MAX_MARKDOWN_IMAGE_PROTECTION_RANGES = 4000;
const MAX_FAILED_MARKDOWN_IMAGE_PART_SCAN_CHARS = 4 * MAX_MARKDOWN_IMAGE_PART_SCAN_CHARS;

function sortContentRanges(ranges: ContentRange[]): ContentRange[] {
  return ranges.sort((left, right) => left.start === right.start ? left.end - right.end : left.start - right.start);
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
