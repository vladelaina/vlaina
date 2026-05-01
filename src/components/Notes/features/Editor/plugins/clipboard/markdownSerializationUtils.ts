import {
  mapMarkdownOutsideProtectedBlocks,
  mapMarkdownOutsideProtectedSegments,
} from './markdownProtectedBlocks';

const BR_ONLY_PATTERN = /^<br\s*\/?>$/i;
const BLOCKQUOTE_BR_ONLY_PATTERN = /^(\s*(?:>\s*)+)<br\s*\/?>$/i;
const MARKED_BR_ONLY_PATTERN = /^<br\s+data-vlaina-empty-line="true"\s*\/?>$/i;
const MARKDOWN_ESCAPE_PATTERN = /\\([\\`*_{}[\]()#+\-.!])/g;
const EMPTY_LINE_PLACEHOLDER = '<br data-vlaina-empty-line="true" />';
const USER_BR_PLACEHOLDER = '<br data-vlaina-user-br="true" />';
const LIST_GAP_PLACEHOLDER = '<br data-vlaina-list-gap="true" />';
const LIST_GAP_SENTINEL = '\u0000VLAINA_LIST_GAP_SENTINEL\u0000';
const MARKED_EMPTY_MARKDOWN_LINE_PLACEHOLDER_PATTERN =
  /^(\s*(?:>\s*)*(?:(?:[-+*]|\d+[.)])\s+(?:\[(?: |x|X)\]\s+)?)?)<br\s+data-vlaina-empty-line="true"\s*\/?>$/gim;
const MARKED_EMPTY_LINE_PATTERN = /^<br\s+data-vlaina-empty-line="true"\s*\/?>$/i;
const MARKED_EMPTY_LINE_TOKEN_PATTERN = /[ \t]*<br\s+data-vlaina-empty-line="true"\s*\/?>[ \t]*/gi;
const MARKED_USER_BR_PATTERN = /^<br\s+data-vlaina-user-br="true"\s*\/?>$/i;
const MARKED_BLOCKQUOTE_USER_BR_PATTERN =
  /^(\s*(?:>\s*)+)<br\s+data-vlaina-user-br="true"\s*\/?>$/i;
const MARKED_BLOCKQUOTE_USER_BR_WITH_DEPTH_PATTERN =
  /^(\s*(?:>\s*)*)<br\b(?=[^>]*\bdata-vlaina-user-br="true")(?=[^>]*\bdata-vlaina-blockquote-depth="(\d+)")[^>]*\/?>$/i;
const MARKED_BLOCKQUOTE_USER_BR_TOKEN_PATTERN =
  /[ \t]*<br\b(?=[^>]*\bdata-vlaina-user-br="true")(?=[^>]*\bdata-vlaina-blockquote-depth="(\d+)")[^>]*\/?>[ \t]*/gi;
const MARKED_USER_BR_TOKEN_PATTERN = /[ \t]*<br\s+data-vlaina-user-br="true"\s*\/?>[ \t]*/gi;
const MARKED_LIST_GAP_TOKEN_PATTERN = /[ \t]*<br\s+data-vlaina-list-gap="true"\s*\/?>[ \t]*/gi;
const EMPTY_LIST_ITEM_PLACEHOLDER_PATTERN =
  /^(\s*(?:>\s*)*(?:[-+*]|\d+[.)])\s+(?:\[(?: |x|X)\]\s+)?)<br\s*\/?>$/gim;
const EMPTY_TABLE_CELL_PLACEHOLDER_PATTERN = /(\|\s*)<br\s*\/?>(\s*\|)/g;
const LIST_ITEM_MARKER_PATTERN = /^\s*(?:[-+*]|\d+[.)])\s+(?:\[(?: |x|X)\]\s+)?/;
const TABLE_DELIMITER_ROW_PATTERN =
  /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)+\|?\s*$/;
const TABLE_ROW_PATTERN = /^\s*\|.*\|\s*$/;

function unescapeMarkdownPunctuation(text: string): string {
  return text.replace(MARKDOWN_ESCAPE_PATTERN, '$1');
}

function stripEmptyMarkdownPlaceholders(text: string): string {
  return mapMarkdownOutsideProtectedBlocks(
    normalizeEditorBreakPlaceholders(text),
    (line) => line
      .replace(MARKED_EMPTY_MARKDOWN_LINE_PLACEHOLDER_PATTERN, (_match, prefix: string) =>
        prefix.trimEnd()
      )
      .replace(EMPTY_LIST_ITEM_PLACEHOLDER_PATTERN, (_match, prefix: string) =>
        prefix.trimEnd()
      )
      .replace(EMPTY_TABLE_CELL_PLACEHOLDER_PATTERN, '$1 $2')
  );
}

export function stripTrailingNewlines(text: string): string {
  return text.replace(/\n+$/, '');
}

export function normalizeSerializedMarkdownBlock(text: string): string {
  const withoutTrailingNewlines = stripTrailingNewlines(
    stripEmptyMarkdownPlaceholders(text)
  );
  if (BR_ONLY_PATTERN.test(withoutTrailingNewlines.trim())) return '';
  return unescapeMarkdownPunctuation(withoutTrailingNewlines);
}

export function normalizeSerializedMarkdownDocument(text: string): string {
  return unescapeMarkdownPunctuation(
    normalizeListItemBlankLines(
      stripEmptyMarkdownPlaceholders(text)
    )
  );
}

export function preserveMarkdownBlankLinesForEditor(text: string): string {
  if (text.length === 0) return text;

  return mapMarkdownOutsideProtectedBlocks(text, (line, index, lines) => {
    const blockquoteBrMatch = BLOCKQUOTE_BR_ONLY_PATTERN.exec(line);
    if (blockquoteBrMatch) {
      const prefix = blockquoteBrMatch[1] ?? '';
      return `${prefix}${getBlockquoteUserBrPlaceholder(prefix)}`;
    }

    if (BR_ONLY_PATTERN.test(line.trim())) {
      return USER_BR_PLACEHOLDER;
    }

    if (isBetweenListItemsBlankLine(lines, index)) {
      return LIST_GAP_PLACEHOLDER;
    }

    if (isListBoundaryBlankLine(lines, index)) {
      return line;
    }

    if (isTableBoundaryBlankLine(lines, index)) {
      return line;
    }

    if (isIndentedCodeBoundaryBlankLine(lines, index)) {
      return line;
    }

    if (line.trim() === '') {
      return EMPTY_LINE_PLACEHOLDER;
    }

    return line;
  });
}

function normalizeEditorBreakPlaceholders(text: string): string {
  return mapMarkdownOutsideProtectedBlocks(
    text,
    (line) => {
      const trimmed = line.trim();
      if (MARKED_EMPTY_LINE_PATTERN.test(trimmed)) {
        return '';
      }
      if (MARKED_USER_BR_PATTERN.test(trimmed)) {
        return '<br />';
      }
      const blockquoteUserBrWithDepthMatch =
        MARKED_BLOCKQUOTE_USER_BR_WITH_DEPTH_PATTERN.exec(line);
      if (blockquoteUserBrWithDepthMatch) {
        const prefix = blockquoteUserBrWithDepthMatch[1] || getBlockquotePrefix(
          Number(blockquoteUserBrWithDepthMatch[2] ?? 0)
        );
        return `${prefix}<br />`;
      }
      const blockquoteUserBrMatch = MARKED_BLOCKQUOTE_USER_BR_PATTERN.exec(line);
      if (blockquoteUserBrMatch) {
        return `${blockquoteUserBrMatch[1] ?? ''}<br />`;
      }
      return line
        .replace(MARKED_LIST_GAP_TOKEN_PATTERN, `\n${LIST_GAP_SENTINEL}\n`)
        .replace(MARKED_EMPTY_LINE_TOKEN_PATTERN, '\n')
        .replace(
          MARKED_BLOCKQUOTE_USER_BR_TOKEN_PATTERN,
          (_match, depth: string) => `\n${getBlockquotePrefix(Number(depth))}<br />`
        )
        .replace(MARKED_USER_BR_TOKEN_PATTERN, '\n<br />');
    }
  );
}

function normalizeListItemBlankLines(text: string): string {
  return mapMarkdownOutsideProtectedSegments(text, (segment) => segment
    .replace(/((?:^|\n)(?: {0,3})(?:[-+*]|\d+[.)])[^\n]*)\n{2,}((?: {0,3})(?:[-+*]|\d+[.)])\s+)/g, '$1\n$2')
    .replace(new RegExp(`\\n*${LIST_GAP_SENTINEL}\\n*`, 'g'), '\n\n'));
}

function isListBoundaryBlankLine(lines: readonly string[], index: number): boolean {
  if (lines[index]?.trim() !== '') return false;

  const previous = findNearestNonBlankLine(lines, index, -1);
  const next = findNearestNonBlankLine(lines, index, 1);
  if (!previous || !next) return false;

  return LIST_ITEM_MARKER_PATTERN.test(previous) || LIST_ITEM_MARKER_PATTERN.test(next);
}

function isBetweenListItemsBlankLine(lines: readonly string[], index: number): boolean {
  if (lines[index]?.trim() !== '') return false;

  const previous = findNearestNonBlankLine(lines, index, -1);
  const next = findNearestNonBlankLine(lines, index, 1);
  if (!previous || !next) return false;

  return LIST_ITEM_MARKER_PATTERN.test(previous) && LIST_ITEM_MARKER_PATTERN.test(next);
}

function isIndentedCodeBoundaryBlankLine(lines: readonly string[], index: number): boolean {
  if (lines[index]?.trim() !== '') return false;

  const next = findNearestNonBlankLine(lines, index, 1);
  return next !== null && /^(?: {4,}|\t)/.test(next);
}

function isTableBoundaryBlankLine(lines: readonly string[], index: number): boolean {
  if (lines[index]?.trim() !== '') return false;

  const previousIndex = findNearestNonBlankLineIndex(lines, index, -1);
  const nextIndex = findNearestNonBlankLineIndex(lines, index, 1);
  return isTableStartAt(lines, nextIndex) || isTableRowInTable(lines, previousIndex);
}

function isTableStartAt(lines: readonly string[], index: number | null): boolean {
  if (index === null) return false;
  return TABLE_ROW_PATTERN.test(lines[index] ?? '')
    && TABLE_DELIMITER_ROW_PATTERN.test(lines[index + 1] ?? '');
}

function isTableRowInTable(lines: readonly string[], index: number | null): boolean {
  if (index === null || !TABLE_ROW_PATTERN.test(lines[index] ?? '')) return false;
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const line = lines[cursor] ?? '';
    if (line.trim() === '') return false;
    if (TABLE_DELIMITER_ROW_PATTERN.test(line)) return cursor > 0 && TABLE_ROW_PATTERN.test(lines[cursor - 1] ?? '');
  }
  return false;
}

function findNearestNonBlankLine(
  lines: readonly string[],
  startIndex: number,
  direction: -1 | 1,
): string | null {
  const index = findNearestNonBlankLineIndex(lines, startIndex, direction);
  return index === null ? null : lines[index] ?? '';
}

function findNearestNonBlankLineIndex(
  lines: readonly string[],
  startIndex: number,
  direction: -1 | 1,
): number | null {
  for (let index = startIndex + direction; index >= 0 && index < lines.length; index += direction) {
    const line = lines[index] ?? '';
    if (line.trim() !== '') {
      return index;
    }
  }
  return null;
}

function getBlockquoteUserBrPlaceholder(prefix: string): string {
  return `<br data-vlaina-user-br="true" data-vlaina-blockquote-depth="${getBlockquoteDepth(prefix)}" />`;
}

function getBlockquoteDepth(prefix: string): number {
  return (prefix.match(/>/g) ?? []).length;
}

function getBlockquotePrefix(depth: number): string {
  return Array.from({ length: Math.max(0, depth) }, () => '>').join(' ') + (depth > 0 ? ' ' : '');
}

export function normalizeSerializedMarkdownSelection(text: string): string {
  const trimmedText = stripTrailingNewlines(text).trim();
  const isStandaloneBreak =
    BR_ONLY_PATTERN.test(trimmedText) || MARKED_BR_ONLY_PATTERN.test(trimmedText);
  const withoutTrailingNewlines = stripTrailingNewlines(
    stripEmptyMarkdownPlaceholders(text)
  );
  if (isStandaloneBreak || BR_ONLY_PATTERN.test(withoutTrailingNewlines.trim())) return '\n';
  return unescapeMarkdownPunctuation(withoutTrailingNewlines);
}

export function joinSerializedBlocks(blocks: readonly string[]): string {
  if (blocks.length === 0) return '';

  let joined = blocks[0] ?? '';
  for (let index = 1; index < blocks.length; index += 1) {
    const previous = blocks[index - 1] ?? '';
    const next = blocks[index] ?? '';
    const separator =
      previous.length === 0
      || next.length === 0
      || (LIST_ITEM_MARKER_PATTERN.test(previous) && LIST_ITEM_MARKER_PATTERN.test(next))
        ? '\n'
        : '\n\n';
    joined += separator + next;
  }

  if (joined.length === 0) {
    return '\n';
  }
  return joined;
}
