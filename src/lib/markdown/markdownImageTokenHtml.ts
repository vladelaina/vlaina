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

export function parseHtmlImageTokensInRange(
  content: string,
  range: ContentRange,
  markdownImageRanges: ImageToken[],
  maxTokens = Number.POSITIVE_INFINITY,
): ImageToken[] {
  const tokens: ImageToken[] = [];
  const inlineCodeRanges = getInlineCodeRanges(content, range);
  const htmlCommentRanges = getHtmlCommentRanges(content, range);
  const rawTextHtmlRanges = getRawTextHtmlRanges(content, range);
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
