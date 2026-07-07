import { IMAGE_PLACEHOLDER } from './prompts';
import {
  findHtmlTagEnd,
  getInlineCodeRanges,
  getRangeEndAtOffset,
  iterateNonFencedContentRanges,
  type ContentRange,
} from '@/lib/markdown/markdownRanges';
import { parseHtmlImageSrcTokenFromTag } from '@/lib/markdown/markdownHtmlImageSrc';
import {
  getOverflowHistoryMarkdownImageScrubEnd,
  indexOfAsciiCaseInsensitive,
  isHistoryImageSource,
  MAX_REQUEST_HISTORY_HTML_IMAGE_TAG_END_SCAN_CHARS,
  MAX_REQUEST_HISTORY_IMAGE_TARGET_CHARS,
  MAX_REQUEST_HISTORY_INLINE_CODE_PROTECTION_RANGES,
} from './requestContextImageSources';

export function scrubOverflowHistoryHtmlImages(content: string): string {
  let output = '';
  let cursor = 0;

  for (const range of iterateNonFencedContentRanges(content)) {
    output += content.slice(cursor, range.start);
    output += scrubOverflowHistoryHtmlImagesInRange(content, range);
    cursor = range.end;
  }

  output += content.slice(cursor);
  return output;
}

function scrubOverflowHistoryHtmlImagesInRange(content: string, range: ContentRange): string {
  const inlineCodeRanges = getInlineCodeRanges(
    content,
    range,
    MAX_REQUEST_HISTORY_INLINE_CODE_PROTECTION_RANGES,
  );
  let output = '';
  let cursor = range.start;

  while (cursor < range.end) {
    const start = indexOfAsciiCaseInsensitive(content, '<img', cursor);
    if (start === -1 || start >= range.end) {
      output += content.slice(cursor, range.end);
      break;
    }

    const inlineCodeEnd = getRangeEndAtOffset(start, inlineCodeRanges);
    if (inlineCodeEnd !== null) {
      output += content.slice(cursor, inlineCodeEnd);
      cursor = inlineCodeEnd;
      continue;
    }

    const tagEnd = findHtmlTagEnd(
      content,
      start,
      Math.min(range.end, start + MAX_REQUEST_HISTORY_HTML_IMAGE_TAG_END_SCAN_CHARS + 1),
    );
    const isUnboundedImageTag =
      tagEnd === -1 || tagEnd > range.end || tagEnd - start > MAX_REQUEST_HISTORY_IMAGE_TARGET_CHARS;
    if (isUnboundedImageTag) {
      const scrubEnd = tagEnd === -1
        ? getOverflowHistoryMarkdownImageScrubEnd(content, start + 4, range.end)
        : tagEnd;
      output += content.slice(cursor, start);
      output += IMAGE_PLACEHOLDER;
      cursor = scrubEnd;
      continue;
    }

    const tag = content.slice(start, tagEnd);
    const src = parseHtmlImageSrcTokenFromTag(tag)?.src;
    if (!src || !isHistoryImageSource(src)) {
      output += content.slice(cursor, tagEnd);
      cursor = tagEnd;
      continue;
    }

    output += content.slice(cursor, start);
    output += IMAGE_PLACEHOLDER;
    cursor = tagEnd;
  }

  return output;
}
