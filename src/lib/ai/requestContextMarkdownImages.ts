import { IMAGE_PLACEHOLDER } from './prompts';
import {
  getInlineCodeRanges,
  getRangeEndAtOffset,
  isEscapedMarkdownPunctuation,
  isOffsetInRanges,
  iterateNonFencedContentRanges,
  type ContentRange,
} from '@/lib/markdown/markdownRanges';
import { parseVideoUrl } from '@/lib/markdown/videoUrl';
import {
  getHistoryMarkdownImageTarget,
  getOverflowHistoryMarkdownImageScrubEnd,
  isHistoryImageSource,
  MAX_REQUEST_HISTORY_IMAGE_LABEL_SCAN_CHARS,
  MAX_REQUEST_HISTORY_IMAGE_TARGET_CHARS,
  MAX_REQUEST_HISTORY_IMAGE_TOTAL_LABEL_SCAN_CHARS,
  MAX_REQUEST_HISTORY_INLINE_CODE_PROTECTION_RANGES,
} from './requestContextImageSources';

export function scrubOverflowHistoryMarkdownImages(content: string): string {
  let output = '';
  let cursor = 0;

  for (const range of iterateNonFencedContentRanges(content)) {
    output += content.slice(cursor, range.start);
    output += scrubOverflowHistoryMarkdownImagesInRange(content, range);
    cursor = range.end;
  }

  output += content.slice(cursor);
  return output;
}

function scrubOverflowHistoryMarkdownImagesInRange(content: string, range: ContentRange): string {
  const inlineCodeRanges = getInlineCodeRanges(
    content,
    range,
    MAX_REQUEST_HISTORY_INLINE_CODE_PROTECTION_RANGES,
  );
  let output = '';
  let cursor = range.start;
  let remainingLabelScanChars = MAX_REQUEST_HISTORY_IMAGE_TOTAL_LABEL_SCAN_CHARS;

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

    const labelResult = findHistoryMarkdownImageLabelEnd(
      content,
      start,
      range.end,
      remainingLabelScanChars,
    );
    remainingLabelScanChars = labelResult.remainingScanChars;
    if (labelResult.exhausted) {
      output += content.slice(cursor, start);
      output += IMAGE_PLACEHOLDER;
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
      targetEnd - labelEnd > MAX_REQUEST_HISTORY_IMAGE_TARGET_CHARS
    ) {
      if (isHistoryMarkdownImageTargetAt(content, labelEnd + 2)) {
        const scrubEnd = targetEnd !== -1 && targetEnd < range.end
          ? targetEnd + 1
          : getOverflowHistoryMarkdownImageScrubEnd(content, labelEnd + 2, range.end);
        output += content.slice(cursor, start);
        output += IMAGE_PLACEHOLDER;
        cursor = scrubEnd;
      } else {
        output += content.slice(cursor, start + 2);
        cursor = start + 2;
      }
      continue;
    }

    const target = getHistoryMarkdownImageTarget(content.slice(labelEnd + 2, targetEnd));
    if (target && parseVideoUrl(target)) {
      output += content.slice(cursor, targetEnd + 1);
      cursor = targetEnd + 1;
      continue;
    }

    output += content.slice(cursor, start);
    output += IMAGE_PLACEHOLDER;
    cursor = targetEnd + 1;
  }

  return output;
}

function findHistoryMarkdownImageLabelEnd(
  content: string,
  start: number,
  rangeEnd: number,
  remainingScanChars: number,
): { exhausted: boolean; labelEnd: number | null; remainingScanChars: number } {
  const labelStart = start + 2;
  const scanEnd = Math.min(rangeEnd, labelStart + MAX_REQUEST_HISTORY_IMAGE_LABEL_SCAN_CHARS);
  const labelEnd = indexOfHistoryMarkdownImageLabelClose(content, labelStart, scanEnd);
  const boundedLabelEnd = labelEnd === -1 ? null : labelEnd;
  const scannedEnd = boundedLabelEnd === null ? scanEnd : boundedLabelEnd + 2;
  const nextRemainingScanChars = remainingScanChars - Math.max(0, scannedEnd - labelStart);

  return {
    exhausted: nextRemainingScanChars < 0,
    labelEnd: boundedLabelEnd,
    remainingScanChars: Math.max(0, nextRemainingScanChars),
  };
}

function indexOfHistoryMarkdownImageLabelClose(content: string, start: number, end: number): number {
  for (let index = start; index + 1 < end; index += 1) {
    if (content[index] === ']' && content[index + 1] === '(') {
      return index;
    }
  }
  return -1;
}

function isHistoryMarkdownImageTargetAt(content: string, targetStart: number): boolean {
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
  return isHistoryImageSource(content.slice(cursor, cursor + 128));
}
