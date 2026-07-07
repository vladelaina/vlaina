import { htmlImageTagHasDataImageSrc } from '@/lib/markdown/markdownHtmlImageSrc';
import { scrubOverflowMarkdownDataImages } from '@/lib/markdown/overflowDataImageScrubber';
import {
  findHtmlTagEnd,
  getInlineCodeRanges,
  getRangeEndAtOffset,
  iterateNonFencedContentRanges,
} from '@/lib/markdown/markdownRanges';

const MAX_COPY_OVERFLOW_MARKDOWN_IMAGE_TARGET_CHARS = 512 * 1024;
const MAX_COPY_HTML_IMAGE_TAG_CHARS = 20_000;
const MAX_COPY_HTML_IMAGE_TAG_END_SCAN_CHARS = 64 * 1024;
const MAX_COPY_INLINE_CODE_PROTECTION_RANGES = 4000;
export const INLINE_DATA_IMAGE_TARGET_HINT_PATTERN = /\bdata(?:\\*:|&|&#)/i;

function scrubOverflowCopyHtmlDataImages(content: string): string {
  let output = "";
  let cursor = 0;

  for (const range of iterateNonFencedContentRanges(content)) {
    output += content.slice(cursor, range.start);
    output += scrubOverflowCopyHtmlDataImagesInRange(content, range);
    cursor = range.end;
  }

  output += content.slice(cursor);
  return output;
}

function scrubOverflowCopyHtmlDataImagesInRange(
  content: string,
  range: { start: number; end: number },
): string {
  const inlineCodeRanges = getInlineCodeRanges(
    content,
    range,
    MAX_COPY_INLINE_CODE_PROTECTION_RANGES,
  );
  let output = "";
  let cursor = range.start;

  while (cursor < range.end) {
    const start = indexOfAsciiCaseInsensitive(content, "<img", cursor);
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
      Math.min(range.end, start + MAX_COPY_HTML_IMAGE_TAG_END_SCAN_CHARS + 1),
    );
    const tagIsOverflow =
      tagEnd === -1 || tagEnd > range.end || tagEnd - start > MAX_COPY_HTML_IMAGE_TAG_CHARS;
    if (tagIsOverflow) {
      output += content.slice(cursor, start);
      output += "[image]";
      cursor = tagEnd !== -1 && tagEnd <= range.end
        ? tagEnd
        : getOverflowHtmlImageScrubEnd(content, start, range.end);
      continue;
    }

    const tag = content.slice(start, tagEnd);
    if (!htmlImageTagHasDataImageSrc(tag)) {
      output += content.slice(cursor, tagEnd);
      cursor = tagEnd;
      continue;
    }

    output += content.slice(cursor, start);
    output += "[image]";
    cursor = tagEnd;
  }

  return output;
}

function scrubOverflowCopyMarkdownDataImages(content: string): string {
  return scrubOverflowMarkdownDataImages(content, {
    replacement: "[image]",
    maxTargetChars: MAX_COPY_OVERFLOW_MARKDOWN_IMAGE_TARGET_CHARS,
  });
}

export function scrubOverflowCopyInlineDataImages(content: string): string {
  return scrubOverflowCopyMarkdownDataImages(scrubOverflowCopyHtmlDataImages(content));
}

function indexOfAsciiCaseInsensitive(value: string, needle: string, fromIndex: number): number {
  const lowerNeedle = needle.toLowerCase();
  const maxStart = value.length - needle.length;
  for (let index = Math.max(0, fromIndex); index <= maxStart; index += 1) {
    let matched = true;
    for (let offset = 0; offset < needle.length; offset += 1) {
      if (value[index + offset]?.toLowerCase() !== lowerNeedle[offset]) {
        matched = false;
        break;
      }
    }
    if (matched) {
      return index;
    }
  }
  return -1;
}

function getOverflowHtmlImageScrubEnd(content: string, start: number, rangeEnd: number): number {
  const lineFeed = content.indexOf('\n', start);
  const carriageReturn = content.indexOf('\r', start);
  return Math.min(
    lineFeed === -1 ? rangeEnd : lineFeed,
    carriageReturn === -1 ? rangeEnd : carriageReturn,
    rangeEnd,
  );
}
