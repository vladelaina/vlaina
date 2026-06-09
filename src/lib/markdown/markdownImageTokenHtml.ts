import {
  getHtmlCommentRanges,
  getHtmlTagRanges,
  getInlineCodeRanges,
  getRawTextHtmlRanges,
  isEscapedMarkdownPunctuation,
  isOffsetInRanges,
  type ContentRange,
} from './markdownRanges';
import { getNonExcludedContentRanges } from './contentRangeExclusion';
import { parseHtmlImageSrcTokenFromTag } from './markdownHtmlImageSrc';
import type { ImageToken } from './markdownImageTokenTypes';

const MAX_HTML_IMAGE_TAG_SCAN_RANGES = 4000;
const MAX_HTML_IMAGE_PROTECTION_RANGES = 4000;

export function parseHtmlImageTokensInRange(
  content: string,
  range: ContentRange,
  markdownImageRanges: ImageToken[],
  maxTokens = Number.POSITIVE_INFINITY,
): ImageToken[] {
  const tokens: ImageToken[] = [];
  const maxProtectionRanges = Number.isFinite(maxTokens)
    ? MAX_HTML_IMAGE_PROTECTION_RANGES
    : Number.POSITIVE_INFINITY;
  const protectionRangeScanLimit = Number.isFinite(maxProtectionRanges)
    ? maxProtectionRanges + 1
    : Number.POSITIVE_INFINITY;
  const inlineCodeRanges = getInlineCodeRanges(content, range, protectionRangeScanLimit);
  const htmlCommentRanges = getHtmlCommentRanges(content, range, protectionRangeScanLimit);
  const rawTextHtmlRanges = getRawTextHtmlRanges(content, range, protectionRangeScanLimit);
  if (
    inlineCodeRanges.length > maxProtectionRanges ||
    htmlCommentRanges.length > maxProtectionRanges ||
    rawTextHtmlRanges.length > maxProtectionRanges
  ) {
    return tokens;
  }
  const ignoredRanges = [
    ...inlineCodeRanges,
    ...htmlCommentRanges,
    ...rawTextHtmlRanges,
    ...markdownImageRanges,
  ];
  const htmlTagRanges: ContentRange[] = [];
  const maxHtmlTagRanges = Number.isFinite(maxTokens) ? MAX_HTML_IMAGE_TAG_SCAN_RANGES : Number.POSITIVE_INFINITY;

  for (const scanRange of getNonExcludedContentRanges(range, ignoredRanges)) {
    if (htmlTagRanges.length >= maxHtmlTagRanges) {
      break;
    }
    htmlTagRanges.push(...getHtmlTagRanges(content, scanRange, maxHtmlTagRanges - htmlTagRanges.length));
  }

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
