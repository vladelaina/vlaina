import { MAX_EXCLUDED_RANGES, MAX_FAILED_MARKDOWN_LINK_PART_SCAN_CHARS, MAX_MARKDOWN_LINK_PART_SCAN_CHARS } from './tagMarkdownRangeLimits';
import type { NoteMarkdownExcludedRange } from './tagMarkdownExcludedRanges';
import { isEscaped, pushExcludedRange } from './tagMarkdownExcludedRanges';

export function collectMarkdownLinkTargetRanges(content: string, ranges: NoteMarkdownExcludedRange[]): void {
  let remainingFailedPartScanChars = MAX_FAILED_MARKDOWN_LINK_PART_SCAN_CHARS;
  for (let index = 0; index < content.length && ranges.length < MAX_EXCLUDED_RANGES; index += 1) {
    if (content[index] !== '[' || isEscaped(content, index)) {
      continue;
    }
    if (remainingFailedPartScanChars <= 0) {
      break;
    }

    const labelScanEnd = getMarkdownLinkPartScanEnd(content, index);
    const labelEnd = scanBalancedLabelEnd(content, index);
    if (labelEnd === null || content[labelEnd + 1] !== '(') {
      remainingFailedPartScanChars -= Math.max(0, (labelEnd ?? labelScanEnd) - index);
      continue;
    }
    const targetScanEnd = getMarkdownLinkPartScanEnd(content, labelEnd + 1);
    const targetEnd = scanLinkTargetEnd(content, labelEnd + 1);
    if (targetEnd === null) {
      remainingFailedPartScanChars -= Math.max(0, targetScanEnd - (labelEnd + 1));
      continue;
    }
    pushExcludedRange(ranges, { from: labelEnd + 1, to: targetEnd + 1 });
    index = targetEnd;
  }
}

function getMarkdownLinkPartScanEnd(content: string, start: number): number {
  return Math.min(content.length, start + MAX_MARKDOWN_LINK_PART_SCAN_CHARS);
}

function scanBalancedLabelEnd(content: string, start: number): number | null {
  let depth = 0;
  const scanEnd = getMarkdownLinkPartScanEnd(content, start);
  for (let index = start; index < scanEnd; index += 1) {
    if (isEscaped(content, index)) {
      continue;
    }
    if (content[index] === '[') {
      depth += 1;
    } else if (content[index] === ']') {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    } else if (content[index] === '\n') {
      return null;
    }
  }
  return null;
}

function scanLinkTargetEnd(content: string, openParenIndex: number): number | null {
  let depth = 0;
  let quote: string | null = null;
  const scanEnd = getMarkdownLinkPartScanEnd(content, openParenIndex);
  for (let index = openParenIndex; index < scanEnd; index += 1) {
    const character = content[index] ?? '';
    if (isEscaped(content, index)) {
      continue;
    }
    if (quote) {
      if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
    } else if (character === '(') {
      depth += 1;
    } else if (character === ')') {
      depth -= 1;
      if (depth === 0) return index;
    } else if (character === '\n') {
      return null;
    }
  }
  return null;
}
