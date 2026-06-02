const TAG_PATTERN = /(?<![\p{L}\p{N}_/-])#([\p{L}\p{N}_/-][\p{L}\p{N}_/-]*)/gu;
const HEX_COLOR_PATTERN = /^(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const FENCED_CODE_BLOCK_PATTERN = /(^|\n)( {0,3})(`{3,}|~{3,})[\s\S]*?(?:\n\2\3[ \t]*(?=\n|$)|$)/g;
const FRONTMATTER_PATTERN = /^---[ \t]*(?:\n[\s\S]*?\n---[ \t]*(?=\n|$))/;

export interface NoteTagOccurrence {
  tag: string;
  token: string;
  index: number;
  matchOrdinal: number;
}

interface ExcludedRange {
  from: number;
  to: number;
}

interface TokenMatchCursor {
  cursor: number;
  count: number;
}

export function isNoteTagToken(value: string): boolean {
  return !HEX_COLOR_PATTERN.test(value);
}

function collectExcludedRanges(content: string): ExcludedRange[] {
  const ranges: ExcludedRange[] = [];
  const frontmatterMatch = FRONTMATTER_PATTERN.exec(content);
  if (frontmatterMatch) {
    ranges.push({ from: 0, to: frontmatterMatch[0].length });
  }

  FENCED_CODE_BLOCK_PATTERN.lastIndex = 0;
  let fencedMatch: RegExpExecArray | null;
  while ((fencedMatch = FENCED_CODE_BLOCK_PATTERN.exec(content)) !== null) {
    const leadingNewline = fencedMatch[1] ?? '';
    ranges.push({
      from: fencedMatch.index + leadingNewline.length,
      to: fencedMatch.index + fencedMatch[0].length,
    });
  }

  collectInlineCodeRanges(content, ranges);
  collectAutolinkRanges(content, ranges);
  collectHtmlTagRanges(content, ranges);
  collectMarkdownLinkTargetRanges(content, ranges);

  return ranges.sort((a, b) => a.from - b.from || a.to - b.to);
}

function collectInlineCodeRanges(content: string, ranges: ExcludedRange[]): void {
  for (let index = 0; index < content.length; index += 1) {
    if (content[index] !== '`') {
      continue;
    }
    const markerEnd = scanRepeatedChar(content, index, '`');
    const markerLength = markerEnd - index;
    if (markerLength === 1 && content[index + 1] === '`') {
      continue;
    }
    const closeIndex = content.indexOf('`'.repeat(markerLength), markerEnd);
    if (closeIndex === -1 || content.slice(markerEnd, closeIndex).includes('\n')) {
      index = markerEnd - 1;
      continue;
    }
    ranges.push({ from: index, to: closeIndex + markerLength });
    index = closeIndex + markerLength - 1;
  }
}

function collectAutolinkRanges(content: string, ranges: ExcludedRange[]): void {
  const pattern = /<(?:(?:https?:|mailto:)[^<>\s]*|[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+)>/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) !== null) {
    ranges.push({ from: match.index, to: match.index + match[0].length });
  }
}

function collectHtmlTagRanges(content: string, ranges: ExcludedRange[]): void {
  for (let index = 0; index < content.length; index += 1) {
    if (content[index] !== '<') {
      continue;
    }
    const end = scanHtmlTagEnd(content, index);
    if (end !== null) {
      ranges.push({ from: index, to: end });
      index = end - 1;
    }
  }
}

function collectMarkdownLinkTargetRanges(content: string, ranges: ExcludedRange[]): void {
  for (let index = 0; index < content.length; index += 1) {
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
    ranges.push({ from: labelEnd + 1, to: targetEnd + 1 });
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

function scanHtmlTagEnd(content: string, start: number): number | null {
  if (content.startsWith('<!--', start)) {
    const closeIndex = content.indexOf('-->', start + 4);
    return closeIndex === -1 ? content.length : closeIndex + 3;
  }
  if (!/^<\/?[A-Za-z][A-Za-z0-9:-]*(?:\s|\/?>|$)/.test(content.slice(start))) {
    return null;
  }
  let quote: string | null = null;
  for (let index = start + 1; index < content.length; index += 1) {
    const character = content[index] ?? '';
    if (quote) {
      if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
    } else if (character === '>') {
      return index + 1;
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

function isIndexExcluded(index: number, ranges: readonly ExcludedRange[], startAt = 0): boolean {
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

export function extractNoteTagOccurrences(content: string): NoteTagOccurrence[] {
  const excludedRanges = collectExcludedRanges(content);
  const occurrences: NoteTagOccurrence[] = [];
  const normalizedContent = content.toLocaleLowerCase();
  const tokenMatchCursors = new Map<string, TokenMatchCursor>();
  let excludedRangeCursor = 0;

  TAG_PATTERN.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = TAG_PATTERN.exec(content)) !== null) {
    while (
      excludedRangeCursor < excludedRanges.length &&
      excludedRanges[excludedRangeCursor].to <= match.index
    ) {
      excludedRangeCursor += 1;
    }

    const token = match[0];
    const normalizedToken = token.toLocaleLowerCase();
    const tokenCursor = tokenMatchCursors.get(normalizedToken) ?? { cursor: 0, count: 0 };
    while (tokenCursor.cursor <= match.index - normalizedToken.length) {
      const matchIndex = normalizedContent.indexOf(normalizedToken, tokenCursor.cursor);
      if (matchIndex === -1 || matchIndex >= match.index) {
        break;
      }

      tokenCursor.count += 1;
      tokenCursor.cursor = matchIndex + Math.max(1, normalizedToken.length);
    }
    const matchOrdinal = tokenCursor.count;
    tokenCursor.count += 1;
    tokenCursor.cursor = match.index + Math.max(1, normalizedToken.length);
    tokenMatchCursors.set(normalizedToken, tokenCursor);

    if (isIndexExcluded(match.index, excludedRanges, excludedRangeCursor)) {
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
