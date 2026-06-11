import {
  collectHtmlTagRanges as collectMarkdownHtmlTagRanges,
  getRawTextHtmlRanges,
} from '../markdown/markdownHtmlRanges';
import { getHtmlCommentRanges, getMarkdownHtmlBlockRanges } from '../markdown/markdownRanges';

const MAX_NOTE_TAG_TOKEN_CHARS = 128;
const MAX_NOTE_TAG_OCCURRENCES = 2000;
const MAX_NOTE_TAG_MATCHES = 10_000;
const MAX_EXCLUDED_RANGES = 50_000;
const MAX_FRONTMATTER_DELIMITER_LINE_CHARS = 1024;
const MAX_FRONTMATTER_CHARS = 256 * 1024;
const MAX_FRONTMATTER_LINES = 2048;
const UTF8_BOM = '\uFEFF';

const TAG_PATTERN = /(?<![\p{L}\p{N}_/-])#([\p{L}\p{N}_/-][\p{L}\p{N}_/-]{0,127})/gu;
const TAG_BODY_CHARACTER_PATTERN = /^[\p{L}\p{N}_/-]$/u;
const HEX_COLOR_PATTERN = /^(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const FRONTMATTER_DELIMITER_PATTERN = /^---[ \t]*$/;

export interface NoteTagOccurrence {
  tag: string;
  token: string;
  index: number;
  matchOrdinal: number;
}

export interface NoteMarkdownExcludedRange {
  from: number;
  to: number;
}

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

export function isNoteTagToken(value: string): boolean {
  return !HEX_COLOR_PATTERN.test(value);
}

export function getNoteMarkdownExcludedRanges(content: string): NoteMarkdownExcludedRange[] {
  const ranges: NoteMarkdownExcludedRange[] = [];
  const frontmatterEnd = getLeadingFrontmatterEnd(content);
  if (frontmatterEnd !== null) {
    ranges.push({ from: 0, to: frontmatterEnd });
  }

  collectFencedCodeRanges(content, ranges);
  collectInlineCodeRanges(content, ranges);
  collectAutolinkRanges(content, ranges);
  collectRawTextHtmlRanges(content, ranges);
  collectMarkdownHtmlBlockRanges(content, ranges);
  collectHtmlTagRanges(content, ranges);
  collectMarkdownLinkTargetRanges(content, ranges);

  ranges.sort((a, b) => a.from - b.from || a.to - b.to);

  if (ranges.length >= MAX_EXCLUDED_RANGES) {
    const lastRange = ranges[ranges.length - 1];
    if (lastRange) {
      lastRange.to = content.length;
    }
  }

  return ranges;
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

function getLeadingFrontmatterEnd(content: string): number | null {
  const firstLine = readLine(content, 0, MAX_FRONTMATTER_DELIMITER_LINE_CHARS + 1);
  const firstLineText = firstLine.line.startsWith(UTF8_BOM) ? firstLine.line.slice(1) : firstLine.line;
  if (firstLine.truncated || !FRONTMATTER_DELIMITER_PATTERN.test(firstLineText)) {
    return null;
  }

  let cursor = firstLine.nextStart;
  let lineCount = 0;
  const frontmatterBudgetEnd = firstLine.nextStart + MAX_FRONTMATTER_CHARS + 1;

  while (cursor < content.length && lineCount < MAX_FRONTMATTER_LINES) {
    const line = readLine(content, cursor, frontmatterBudgetEnd);
    if (line.truncated || line.contentEnd - firstLine.nextStart > MAX_FRONTMATTER_CHARS) {
      break;
    }

    if (FRONTMATTER_DELIMITER_PATTERN.test(line.line)) {
      return line.contentEnd;
    }

    lineCount += 1;
    cursor = line.nextStart;
  }

  return null;
}

function collectFencedCodeRanges(content: string, ranges: NoteMarkdownExcludedRange[]): void {
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

function pushExcludedRange(ranges: NoteMarkdownExcludedRange[], range: NoteMarkdownExcludedRange): void {
  if (ranges.length >= MAX_EXCLUDED_RANGES) {
    return;
  }
  ranges.push(range);
}

function collectInlineCodeRanges(content: string, ranges: NoteMarkdownExcludedRange[]): void {
  for (let index = 0; index < content.length && ranges.length < MAX_EXCLUDED_RANGES; index += 1) {
    if (content[index] !== '`') {
      continue;
    }
    const markerEnd = scanRepeatedChar(content, index, '`');
    const markerLength = markerEnd - index;
    if (markerLength === 1 && content[index + 1] === '`') {
      continue;
    }
    const closeIndex = content.indexOf('`'.repeat(markerLength), markerEnd);
    if (closeIndex === -1 || rangeContainsNewline(content, markerEnd, closeIndex)) {
      index = markerEnd - 1;
      continue;
    }
    pushExcludedRange(ranges, { from: index, to: closeIndex + markerLength });
    index = closeIndex + markerLength - 1;
  }
}

function rangeContainsNewline(content: string, from: number, to: number): boolean {
  for (let index = from; index < to; index += 1) {
    if (content.charCodeAt(index) === 10) {
      return true;
    }
  }
  return false;
}

function collectAutolinkRanges(content: string, ranges: NoteMarkdownExcludedRange[]): void {
  const pattern = /<(?:(?:https?:|mailto:)[^<>\s]*|[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+)>/g;
  let match: RegExpExecArray | null;
  while (ranges.length < MAX_EXCLUDED_RANGES && (match = pattern.exec(content)) !== null) {
    pushExcludedRange(ranges, { from: match.index, to: match.index + match[0].length });
  }
}

function collectRawTextHtmlRanges(content: string, ranges: NoteMarkdownExcludedRange[]): void {
  const remainingRanges = MAX_EXCLUDED_RANGES - ranges.length;
  if (remainingRanges <= 0) {
    return;
  }

  for (const range of getRawTextHtmlRanges(content, { start: 0, end: content.length }, remainingRanges)) {
    pushExcludedRange(ranges, { from: range.start, to: range.end });
    if (ranges.length >= MAX_EXCLUDED_RANGES) {
      return;
    }
  }
}

function collectMarkdownHtmlBlockRanges(content: string, ranges: NoteMarkdownExcludedRange[]): void {
  const remainingRanges = MAX_EXCLUDED_RANGES - ranges.length;
  if (remainingRanges <= 0) {
    return;
  }

  for (const range of getMarkdownHtmlBlockRanges(
    content,
    { start: 0, end: content.length },
    remainingRanges,
  )) {
    pushExcludedRange(ranges, { from: range.start, to: range.end });
    if (ranges.length >= MAX_EXCLUDED_RANGES) {
      return;
    }
  }
}

function collectHtmlTagRanges(content: string, ranges: NoteMarkdownExcludedRange[]): void {
  let remainingRanges = MAX_EXCLUDED_RANGES - ranges.length;
  if (remainingRanges <= 0) {
    return;
  }

  for (const range of getHtmlCommentRanges(content, { start: 0, end: content.length }, remainingRanges)) {
    pushExcludedRange(ranges, { from: range.start, to: range.end });
    if (ranges.length >= MAX_EXCLUDED_RANGES) {
      return;
    }
  }

  remainingRanges = MAX_EXCLUDED_RANGES - ranges.length;
  if (remainingRanges <= 0) {
    return;
  }

  const htmlTagScan = collectMarkdownHtmlTagRanges(content, { start: 0, end: content.length }, remainingRanges);
  const htmlTagRanges = [...htmlTagScan.ranges, ...htmlTagScan.protectedRanges]
    .sort((left, right) => left.start - right.start || left.end - right.end);
  for (const range of htmlTagRanges) {
    pushExcludedRange(ranges, { from: range.start, to: range.end });
    if (ranges.length >= MAX_EXCLUDED_RANGES) {
      return;
    }
  }
}

function collectMarkdownLinkTargetRanges(content: string, ranges: NoteMarkdownExcludedRange[]): void {
  for (let index = 0; index < content.length && ranges.length < MAX_EXCLUDED_RANGES; index += 1) {
    if (content[index] !== '[' || isEscaped(content, index)) {
      continue;
    }
    const labelEnd = scanBalancedLabelEnd(content, index);
    if (labelEnd === null || content[labelEnd + 1] !== '(') {
      continue;
    }
    const targetEnd = scanLinkTargetEnd(content, labelEnd + 1);
    if (targetEnd === null) {
      continue;
    }
    pushExcludedRange(ranges, { from: labelEnd + 1, to: targetEnd + 1 });
    index = targetEnd;
  }
}

function scanBalancedLabelEnd(content: string, start: number): number | null {
  let depth = 0;
  for (let index = start; index < content.length; index += 1) {
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
  for (let index = openParenIndex; index < content.length; index += 1) {
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

function scanRepeatedChar(content: string, start: number, character: string): number {
  let index = start;
  while (content[index] === character) {
    index += 1;
  }
  return index;
}

function isEscaped(content: string, index: number): boolean {
  let slashCount = 0;
  for (let cursor = index - 1; cursor >= 0 && content[cursor] === '\\'; cursor -= 1) {
    slashCount += 1;
  }
  return slashCount % 2 === 1;
}

export function isNoteMarkdownIndexExcluded(index: number, ranges: readonly NoteMarkdownExcludedRange[], startAt = 0): boolean {
  for (let rangeIndex = startAt; rangeIndex < ranges.length; rangeIndex += 1) {
    const range = ranges[rangeIndex];
    if (index < range.from) {
      return false;
    }
    if (index < range.to) {
      return true;
    }
  }

  return false;
}

function isOverlongTagToken(content: string, tokenEnd: number): boolean {
  const nextCharacter = content[tokenEnd] ?? '';
  return nextCharacter.length > 0 && TAG_BODY_CHARACTER_PATTERN.test(nextCharacter);
}

function addTokenPrefixes(prefixCounts: Map<string, number>, normalizedToken: string): void {
  for (let length = 1; length <= normalizedToken.length; length += 1) {
    const prefix = normalizedToken.slice(0, length);
    prefixCounts.set(prefix, (prefixCounts.get(prefix) ?? 0) + 1);
  }
}

export function extractNoteTagOccurrences(content: string): NoteTagOccurrence[] {
  const excludedRanges = getNoteMarkdownExcludedRanges(content);
  const occurrences: NoteTagOccurrence[] = [];
  const tokenPrefixCounts = new Map<string, number>();
  let excludedRangeCursor = 0;
  let visibleMatches = 0;

  TAG_PATTERN.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = TAG_PATTERN.exec(content)) !== null) {
    while (
      excludedRangeCursor < excludedRanges.length &&
      excludedRanges[excludedRangeCursor].to <= match.index
    ) {
      excludedRangeCursor += 1;
    }
    const currentExcludedRange = excludedRanges[excludedRangeCursor];
    if (
      currentExcludedRange &&
      currentExcludedRange.to === content.length &&
      match.index >= currentExcludedRange.from
    ) {
      break;
    }

    const token = match[0];
    if (
      token.length > MAX_NOTE_TAG_TOKEN_CHARS + 1 ||
      isOverlongTagToken(content, match.index + token.length)
    ) {
      continue;
    }

    const excluded = isEscaped(content, match.index)
      || isNoteMarkdownIndexExcluded(match.index, excludedRanges, excludedRangeCursor);
    if (!excluded) {
      visibleMatches += 1;
      if (visibleMatches > MAX_NOTE_TAG_MATCHES || occurrences.length >= MAX_NOTE_TAG_OCCURRENCES) {
        break;
      }
    }

    const normalizedToken = token.toLocaleLowerCase();
    const matchOrdinal = tokenPrefixCounts.get(normalizedToken) ?? 0;
    addTokenPrefixes(tokenPrefixCounts, normalizedToken);

    if (excluded) {
      continue;
    }

    const tag = match[1]?.trim();
    if (tag && isNoteTagToken(tag)) {
      occurrences.push({
        tag: tag.toLocaleLowerCase(),
        token,
        index: match.index,
        matchOrdinal,
      });
    }
  }

  return occurrences;
}

export function extractNoteTags(content: string): string[] {
  const tags = new Set<string>();

  for (const occurrence of extractNoteTagOccurrences(content)) {
    tags.add(occurrence.tag);
  }

  return Array.from(tags);
}
