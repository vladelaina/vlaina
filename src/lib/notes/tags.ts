const TAG_PATTERN = /(?<![\p{L}\p{N}_/-])#([\p{L}\p{N}_/-][\p{L}\p{N}_/-]*)/gu;
const HEX_COLOR_PATTERN = /^(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const FENCED_CODE_BLOCK_PATTERN = /(^|\n)( {0,3})(`{3,}|~{3,})[\s\S]*?(?:\n\2\3[ \t]*(?=\n|$)|$)/g;
const INLINE_CODE_PATTERN = /`[^`\n]*`/g;

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

  FENCED_CODE_BLOCK_PATTERN.lastIndex = 0;
  let fencedMatch: RegExpExecArray | null;
  while ((fencedMatch = FENCED_CODE_BLOCK_PATTERN.exec(content)) !== null) {
    const leadingNewline = fencedMatch[1] ?? '';
    ranges.push({
      from: fencedMatch.index + leadingNewline.length,
      to: fencedMatch.index + fencedMatch[0].length,
    });
  }

  INLINE_CODE_PATTERN.lastIndex = 0;
  let inlineMatch: RegExpExecArray | null;
  while ((inlineMatch = INLINE_CODE_PATTERN.exec(content)) !== null) {
    ranges.push({
      from: inlineMatch.index,
      to: inlineMatch.index + inlineMatch[0].length,
    });
  }

  return ranges.sort((a, b) => a.from - b.from || a.to - b.to);
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
