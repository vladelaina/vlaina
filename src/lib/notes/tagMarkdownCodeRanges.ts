import { MAX_EXCLUDED_RANGES } from './tagMarkdownRangeLimits';
import type { NoteMarkdownExcludedRange } from './tagMarkdownExcludedRanges';

interface FenceInfo {
  marker: string;
  length: number;
}

interface ReadLineResult {
  line: string;
  contentEnd: number;
  nextStart: number;
  truncated: boolean;
}

function readLine(value: string, start: number, maxContentEnd = value.length): ReadLineResult {
  let index = start;
  while (
    index < value.length &&
    index < maxContentEnd &&
    value[index] !== '\n' &&
    value[index] !== '\r'
  ) {
    index += 1;
  }

  let nextStart = index;
  const truncated = index >= maxContentEnd && index < value.length && value[index] !== '\n' && value[index] !== '\r';
  if (!truncated && index < value.length) {
    nextStart = value[index] === '\r' && value[index + 1] === '\n'
      ? index + 2
      : index + 1;
  }

  return {
    line: value.slice(start, index),
    contentEnd: index,
    nextStart,
    truncated,
  };
}

function pushExcludedRange(ranges: NoteMarkdownExcludedRange[], range: NoteMarkdownExcludedRange): void {
  if (ranges.length >= MAX_EXCLUDED_RANGES) {
    return;
  }
  ranges.push(range);
}

export function collectFencedCodeRanges(content: string, ranges: NoteMarkdownExcludedRange[]): void {
  let lineStart = 0;

  while (lineStart < content.length && ranges.length < MAX_EXCLUDED_RANGES) {
    const openerLine = readLine(content, lineStart);
    const opener = parseFenceOpener(content, lineStart, openerLine.contentEnd);
    if (!opener) {
      lineStart = openerLine.nextStart;
      continue;
    }

    const blockStart = lineStart;
    let blockEnd = openerLine.nextStart;
    lineStart = openerLine.nextStart;

    while (lineStart < content.length) {
      const currentLineStart = lineStart;
      const line = readLine(content, lineStart);
      blockEnd = line.nextStart;
      lineStart = line.nextStart;
      if (isFenceCloser(content, currentLineStart, line.contentEnd, opener)) {
        break;
      }
    }

    pushExcludedRange(ranges, {
      from: blockStart,
      to: blockEnd,
    });
  }
}

function parseFenceOpener(content: string, lineStart: number, lineEnd: number): FenceInfo | null {
  let index = lineStart;
  let spaces = 0;
  while (index < lineEnd && content[index] === ' ') {
    spaces += 1;
    if (spaces > 3) {
      return null;
    }
    index += 1;
  }

  const marker = content[index];
  if (marker !== '`' && marker !== '~') {
    return null;
  }

  const markerEnd = scanRepeatedChar(content, index, marker);
  const markerLength = markerEnd - index;
  if (markerLength < 3) {
    return null;
  }

  if (marker === '`' && content.slice(markerEnd, lineEnd).includes('`')) {
    return null;
  }

  return { marker, length: markerLength };
}

function isFenceCloser(
  content: string,
  lineStart: number,
  lineEnd: number,
  opener: FenceInfo,
): boolean {
  let index = lineStart;
  let spaces = 0;

  while (index < lineEnd && content[index] === ' ') {
    spaces += 1;
    if (spaces > 3) {
      return false;
    }
    index += 1;
  }

  let markerLength = 0;
  while (content[index + markerLength] === opener.marker) {
    markerLength += 1;
  }
  if (markerLength < opener.length) {
    return false;
  }

  for (let cursor = index + markerLength; cursor < lineEnd; cursor += 1) {
    const character = content[cursor];
    if (character !== ' ' && character !== '\t') {
      return false;
    }
  }

  return true;
}

export function collectInlineCodeRanges(content: string, ranges: NoteMarkdownExcludedRange[]): void {
  for (let index = 0; index < content.length && ranges.length < MAX_EXCLUDED_RANGES; index += 1) {
    if (content[index] !== '`') {
      continue;
    }
    const markerEnd = scanRepeatedChar(content, index, '`');
    const markerLength = markerEnd - index;
    if (markerLength === 1 && content[index + 1] === '`') {
      continue;
    }
    const closeIndex = findClosingInlineCodeMarker(content, markerEnd, markerLength);
    if (closeIndex === -1 || rangeContainsNewline(content, markerEnd, closeIndex)) {
      index = markerEnd - 1;
      continue;
    }
    pushExcludedRange(ranges, { from: index, to: closeIndex + markerLength });
    index = closeIndex + markerLength - 1;
  }
}

function findClosingInlineCodeMarker(content: string, start: number, markerLength: number): number {
  for (let index = start; index < content.length; index += 1) {
    if (content[index] !== '`') {
      continue;
    }

    const markerEnd = scanRepeatedChar(content, index, '`');
    if (markerEnd - index === markerLength) {
      return index;
    }
    index = markerEnd - 1;
  }

  return -1;
}

function rangeContainsNewline(content: string, from: number, to: number): boolean {
  for (let index = from; index < to; index += 1) {
    if (content.charCodeAt(index) === 10) {
      return true;
    }
  }
  return false;
}

export function collectAutolinkRanges(content: string, ranges: NoteMarkdownExcludedRange[]): void {
  const pattern = /<(?:(?:https?:|mailto:)[^<>\s]*|[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+)>/g;
  let match: RegExpExecArray | null;
  while (ranges.length < MAX_EXCLUDED_RANGES && (match = pattern.exec(content)) !== null) {
    pushExcludedRange(ranges, { from: match.index, to: match.index + match[0].length });
  }
}

function scanRepeatedChar(content: string, start: number, character: string): number {
  let index = start;
  while (content[index] === character) {
    index += 1;
  }
  return index;
}
