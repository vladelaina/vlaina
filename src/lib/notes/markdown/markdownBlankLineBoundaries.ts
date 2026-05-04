const LIST_ITEM_MARKER_PATTERN = /^\s*(?:[-+*]|\d+[.)])\s+(?:\[(?: |x|X)\]\s+)?/;
const TABLE_DELIMITER_ROW_PATTERN =
  /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)+\|?\s*$/;
const TABLE_ROW_PATTERN = /^\s*\|.*\|\s*$/;
const FENCED_CODE_OPENER_PATTERN = /^(?: {0,3})(`{3,}|~{3,})(.*)$/;
const THEMATIC_BREAK_PATTERN = /^(?: {0,3})(?:(?:[-*_][ \t]*){3,})$/;
const HTML_COMMENT_CLOSE_PATTERN = /-->\s*$/;
const HTML_ONE_LINE_BLOCK_PATTERN =
  /^(?: {0,3})(?:<\?.*\?>|<![A-Za-z][^>]*>|<!\[CDATA\[[\s\S]*\]\]>)[ \t]*$/;
const HTML_BLOCK_TAG_PATTERN =
  /^(?: {0,3})<\/?(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h1|h2|h3|h4|h5|h6|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?:\s|\/?>|$)/i;
const ALIGNMENT_COMMENT_PATTERN = /^<!--\s*align:(?:left|center|right)\s*-->$/;

export function isListBoundaryBlankLine(lines: readonly string[], index: number): boolean {
  if (lines[index]?.trim() !== '') return false;

  const previous = findNearestNonBlankLine(lines, index, -1);
  const next = findNearestNonBlankLine(lines, index, 1);
  if (!previous || !next) return false;

  return LIST_ITEM_MARKER_PATTERN.test(previous) || LIST_ITEM_MARKER_PATTERN.test(next);
}

export function isBetweenListItemsBlankLine(lines: readonly string[], index: number): boolean {
  if (lines[index]?.trim() !== '') return false;

  const previous = findNearestNonBlankLine(lines, index, -1);
  const next = findNearestNonBlankLine(lines, index, 1);
  if (!previous || !next) return false;

  return LIST_ITEM_MARKER_PATTERN.test(previous) && LIST_ITEM_MARKER_PATTERN.test(next);
}

export function isIndentedCodeBoundaryBlankLine(lines: readonly string[], index: number): boolean {
  if (lines[index]?.trim() !== '') return false;

  const next = findNearestNonBlankLine(lines, index, 1);
  return next !== null && /^(?: {4,}|\t)/.test(next);
}

export function isFencedCodeBoundaryBlankLine(lines: readonly string[], index: number): boolean {
  if (lines[index]?.trim() !== '') return false;

  const next = findNearestNonBlankLine(lines, index, 1);
  return isValidFencedCodeOpener(next);
}

export function isTableBoundaryBlankLine(lines: readonly string[], index: number): boolean {
  if (lines[index]?.trim() !== '') return false;

  const previousIndex = findNearestNonBlankLineIndex(lines, index, -1);
  const nextIndex = findNearestNonBlankLineIndex(lines, index, 1);
  return isTableStartAt(lines, nextIndex) || isTableRowInTable(lines, previousIndex);
}

export function isThematicBreakBoundaryBlankLine(lines: readonly string[], index: number): boolean {
  if (lines[index]?.trim() !== '') return false;

  const previous = findNearestNonBlankLine(lines, index, -1);
  const next = findNearestNonBlankLine(lines, index, 1);
  return isThematicBreakLine(previous) || isThematicBreakLine(next);
}

export function isHtmlCommentBoundaryBlankLine(lines: readonly string[], index: number): boolean {
  if (lines[index]?.trim() !== '') return false;

  const previous = findNearestNonBlankLine(lines, index, -1);
  return previous !== null && HTML_COMMENT_CLOSE_PATTERN.test(previous);
}

export function isHtmlBlockBoundaryBlankLine(lines: readonly string[], index: number): boolean {
  if (lines[index]?.trim() !== '') return false;

  const previous = findNearestNonBlankLine(lines, index, -1);
  const next = findNearestNonBlankLine(lines, index, 1);
  return isHtmlBlockLine(previous) || isHtmlBlockLine(next);
}

export function isAlignmentCommentBoundaryBlankLine(lines: readonly string[], index: number): boolean {
  if (lines[index]?.trim() !== '') return false;

  const previous = findNearestNonBlankLine(lines, index, -1);
  const next = findNearestNonBlankLine(lines, index, 1);
  return isAlignmentCommentLine(previous) || isAlignmentCommentLine(next);
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
    if (TABLE_DELIMITER_ROW_PATTERN.test(line)) {
      return cursor > 0 && TABLE_ROW_PATTERN.test(lines[cursor - 1] ?? '');
    }
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
    if (line.trim() !== '') return index;
  }
  return null;
}

function isAlignmentCommentLine(line: string | null): boolean {
  return line !== null && ALIGNMENT_COMMENT_PATTERN.test(line.trim());
}

function isValidFencedCodeOpener(line: string | null): boolean {
  const match = line === null ? null : FENCED_CODE_OPENER_PATTERN.exec(line);
  if (!match) return false;

  const marker = match[1]?.[0] ?? '';
  const info = match[2] ?? '';
  return marker !== '`' || !info.includes('`');
}

function isHtmlBlockLine(line: string | null): boolean {
  return line !== null
    && (HTML_ONE_LINE_BLOCK_PATTERN.test(line) || HTML_BLOCK_TAG_PATTERN.test(line));
}

function isThematicBreakLine(line: string | null): boolean {
  return line !== null && THEMATIC_BREAK_PATTERN.test(line);
}
