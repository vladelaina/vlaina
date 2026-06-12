import {
  getInlineCodeRanges,
  iterateNonFencedContentRanges,
  getRangeEndAtOffset,
  isEscapedMarkdownPunctuation,
  isOffsetInRanges,
} from './markdownRanges';
import { decodeMarkdownHtmlText } from '@/lib/notes/markdown/markdownHtmlText';

const DATA_IMAGE_PREFIX = 'data:image/';
const MAX_MARKDOWN_IMAGE_LABEL_SCAN_CHARS = 1024 * 1024;
const MAX_MARKDOWN_IMAGE_TOTAL_LABEL_SCAN_CHARS = 4 * 1024 * 1024;
const MAX_DATA_IMAGE_PREFIX_SCAN_CHARS = 128;
const MAX_INLINE_CODE_PROTECTION_RANGES = 4000;
const MARKDOWN_LINK_DESTINATION_ESCAPE_PATTERN = /\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g;

export interface OverflowDataImageScrubOptions {
  replacement: string;
  maxTargetChars: number;
  scrubMatchedDataImages?: boolean;
}

export function scrubOverflowMarkdownDataImages(
  content: string,
  options: OverflowDataImageScrubOptions,
): string {
  let output = '';
  let cursor = 0;

  for (const range of iterateNonFencedContentRanges(content)) {
    output += content.slice(cursor, range.start);
    const scrubbedRange = scrubOverflowMarkdownDataImagesInRange(content, range, options);
    output += scrubbedRange;
    cursor = range.end;
  }

  output += content.slice(cursor);
  return output;
}

function scrubOverflowMarkdownDataImagesInRange(
  content: string,
  range: { start: number; end: number },
  options: OverflowDataImageScrubOptions,
): string {
  const inlineCodeRanges = getInlineCodeRanges(
    content,
    range,
    MAX_INLINE_CODE_PROTECTION_RANGES,
  );
  let output = '';
  let cursor = range.start;
  let remainingLabelScanChars = MAX_MARKDOWN_IMAGE_TOTAL_LABEL_SCAN_CHARS;

  while (cursor < range.end) {
    const start = content.indexOf('![', cursor);
    if (start === -1 || start >= range.end) {
      output += content.slice(cursor, range.end);
      break;
    }

    if (isOffsetInRanges(start, inlineCodeRanges)) {
      const inlineCodeEnd = getRangeEndAtOffset(start, inlineCodeRanges) ?? start + 2;
      output += content.slice(cursor, inlineCodeEnd);
      cursor = inlineCodeEnd;
      continue;
    }
    if (isEscapedMarkdownPunctuation(content, start, range.start)) {
      output += content.slice(cursor, start + 2);
      cursor = start + 2;
      continue;
    }

    const labelResult = findMarkdownImageLabelEnd(
      content,
      start,
      range.end,
      remainingLabelScanChars,
    );
    remainingLabelScanChars = labelResult.remainingScanChars;
    if (labelResult.exhausted) {
      output += content.slice(cursor, start);
      output += options.replacement;
      cursor = range.end;
      break;
    }

    const labelEnd = labelResult.labelEnd;
    if (labelEnd === null) {
      output += content.slice(cursor, start + 2);
      cursor = start + 2;
      continue;
    }

    const targetEnd = content.indexOf(')', labelEnd + 2);
    if (
      targetEnd === -1 ||
      targetEnd >= range.end ||
      targetEnd - labelEnd > options.maxTargetChars
    ) {
      const targetStart = labelEnd + 2;
      if (isInlineDataImageMarkdownTargetAt(content, targetStart)) {
        const scrubEnd = targetEnd !== -1 && targetEnd < range.end
          ? targetEnd + 1
          : getOverflowDataImageScrubEnd(content, targetStart, range.end);
        output += content.slice(cursor, start);
        output += options.replacement;
        cursor = scrubEnd;
      } else {
        output += content.slice(cursor, start + 2);
        cursor = start + 2;
      }
      continue;
    }

    if (
      options.scrubMatchedDataImages !== false &&
      isInlineDataImageMarkdownTargetAt(content, labelEnd + 2)
    ) {
      output += content.slice(cursor, start);
      output += options.replacement;
      cursor = targetEnd + 1;
      continue;
    }

    output += content.slice(cursor, targetEnd + 1);
    cursor = targetEnd + 1;
  }

  return output;
}

function findMarkdownImageLabelEnd(
  content: string,
  start: number,
  rangeEnd: number,
  remainingScanChars: number,
): { exhausted: boolean; labelEnd: number | null; remainingScanChars: number } {
  const labelStart = start + 2;
  const scanEnd = Math.min(rangeEnd, labelStart + MAX_MARKDOWN_IMAGE_LABEL_SCAN_CHARS);
  const labelEnd = indexOfMarkdownImageLabelClose(content, labelStart, scanEnd);
  const boundedLabelEnd = labelEnd === -1 ? null : labelEnd;
  const scannedEnd = boundedLabelEnd === null ? scanEnd : boundedLabelEnd + 2;
  const nextRemainingScanChars = remainingScanChars - Math.max(0, scannedEnd - labelStart);

  return {
    exhausted: nextRemainingScanChars < 0,
    labelEnd: boundedLabelEnd,
    remainingScanChars: Math.max(0, nextRemainingScanChars),
  };
}

function indexOfMarkdownImageLabelClose(content: string, start: number, end: number): number {
  for (let index = start; index + 1 < end; index += 1) {
    if (content[index] === ']' && content[index + 1] === '(') {
      return index;
    }
  }
  return -1;
}

function isInlineDataImageMarkdownTargetAt(content: string, targetStart: number): boolean {
  let cursor = targetStart;
  while (cursor < content.length && /\s/.test(content[cursor])) {
    cursor += 1;
  }
  if (content[cursor] === '<') {
    cursor += 1;
    while (cursor < content.length && /\s/.test(content[cursor])) {
      cursor += 1;
    }
  }
  if (hasAsciiCaseInsensitiveInRange(content, DATA_IMAGE_PREFIX, cursor, cursor + DATA_IMAGE_PREFIX.length)) {
    return true;
  }

  const decodedPrefix = unescapeMarkdownLinkDestination(decodeMarkdownHtmlText(
    content.slice(cursor, Math.min(content.length, cursor + MAX_DATA_IMAGE_PREFIX_SCAN_CHARS))
  ));
  return hasAsciiCaseInsensitiveInRange(decodedPrefix, DATA_IMAGE_PREFIX, 0, DATA_IMAGE_PREFIX.length);
}

function unescapeMarkdownLinkDestination(value: string): string {
  return value.replace(MARKDOWN_LINK_DESTINATION_ESCAPE_PATTERN, '$1');
}

function getOverflowDataImageScrubEnd(content: string, targetStart: number, rangeEnd: number): number {
  const lineFeed = content.indexOf('\n', targetStart);
  const carriageReturn = content.indexOf('\r', targetStart);
  const lineEnd = Math.min(
    lineFeed === -1 ? rangeEnd : lineFeed,
    carriageReturn === -1 ? rangeEnd : carriageReturn,
    rangeEnd,
  );

  return Math.max(targetStart, lineEnd);
}

function hasAsciiCaseInsensitiveInRange(content: string, needle: string, start: number, end: number): boolean {
  const lowerNeedle = needle.toLowerCase();
  const maxStart = end - needle.length;

  for (let index = Math.max(0, start); index <= maxStart; index += 1) {
    let matched = true;
    for (let offset = 0; offset < needle.length; offset += 1) {
      if (content[index + offset]?.toLowerCase() !== lowerNeedle[offset]) {
        matched = false;
        break;
      }
    }
    if (matched) return true;
  }

  return false;
}
