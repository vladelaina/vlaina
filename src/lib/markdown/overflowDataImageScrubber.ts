import {
  getInlineCodeRanges,
  getNonFencedContentRanges,
  getRangeEndAtOffset,
  isOffsetInRanges,
} from './markdownRanges';

const DATA_IMAGE_PREFIX = 'data:image/';
const MAX_MARKDOWN_IMAGE_LABEL_CHARS = 512;

export interface OverflowDataImageScrubOptions {
  replacement: string;
  maxTargetChars: number;
}

export function scrubOverflowMarkdownDataImages(
  content: string,
  options: OverflowDataImageScrubOptions,
): string {
  let output = '';
  let cursor = 0;

  for (const range of getNonFencedContentRanges(content)) {
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
  const inlineCodeRanges = getInlineCodeRanges(content, range);
  let output = '';
  let cursor = range.start;

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

    const labelEnd = content.indexOf('](', start + 2);
    if (labelEnd === -1 || labelEnd >= range.end || labelEnd - start > MAX_MARKDOWN_IMAGE_LABEL_CHARS) {
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
      if (targetEnd !== -1 && targetEnd < range.end && isInlineDataImageMarkdownTargetAt(content, labelEnd + 2)) {
        output += content.slice(cursor, start);
        output += options.replacement;
        cursor = targetEnd + 1;
      } else {
        output += content.slice(cursor, start + 2);
        cursor = start + 2;
      }
      continue;
    }

    if (!hasAsciiCaseInsensitiveInRange(content, DATA_IMAGE_PREFIX, labelEnd + 2, targetEnd)) {
      output += content.slice(cursor, targetEnd + 1);
      cursor = targetEnd + 1;
      continue;
    }

    output += content.slice(cursor, start);
    output += options.replacement;
    cursor = targetEnd + 1;
  }

  return output;
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
  return hasAsciiCaseInsensitiveInRange(content, DATA_IMAGE_PREFIX, cursor, cursor + DATA_IMAGE_PREFIX.length);
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
