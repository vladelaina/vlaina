import {
  mapMarkdownOutsideProtectedBlocks,
  mapMarkdownOutsideProtectedSegments,
} from './markdownProtectedBlocks';
import {
  isAlignmentCommentBoundaryBlankLine,
  isBetweenListItemsBlankLine,
  isDefinitionListBoundaryBlankLine,
  isHtmlImageStructuralBoundaryBlankLine,
  isIndentedCodeBoundaryBlankLine,
  isIndentedContinuationBoundaryBlankLine,
  isListBoundaryBlankLine,
  isMarkdownImageStructuralBoundaryBlankLine,
} from './markdownBlankLineBoundaries';
import { escapeParagraphTrailingBackslashesForEditor } from './plainTextBackslashHardBreaks';

const BR_ONLY_PATTERN = /^<br\s*\/?>$/i;
const BLOCKQUOTE_BR_ONLY_PATTERN = /^(\s*(?:>\s*)+)<br\s*\/?>$/i;
const EDITOR_EMPTY_PARAGRAPH_PLACEHOLDER = '<br />';
const EDITOR_MARKDOWN_BLANK_LINE_PLACEHOLDER = '<!--vlaina-markdown-blank-line-->';
const EDITOR_TIGHT_HEADING_PLACEHOLDER = '<!--vlaina-markdown-tight-heading-->';
const LIST_GAP_PLACEHOLDER = '\u2800';
const USER_BR_SENTINEL = '\u0000VLAINA_USER_BR_SENTINEL\u0000';
const MAX_CONSECUTIVE_EDITOR_BLANK_LINES = 8;
const HARD_BREAK_LINE_PATTERN = /(?:\\| {2,})$/;
const INLINE_TERMINAL_LIST_BR_PATTERN =
  /^(\s*(?:>\s*)*)((?:[-+*])|(\d+[.)]))\s+(?:\[(?: |x|X)\]\s+)?(.+?)<br\s*\/?>\s*$/i;
const USER_BR_SENTINEL_LINE_PATTERN =
  new RegExp(`^(\\s*(?:>\\s*)*)${USER_BR_SENTINEL}$`);
const MARKDOWN_HEADING_LINE_PATTERN = /^\s{0,3}#{1,6}\s+/;
const EMPTY_LIST_ITEM_LINE_PATTERN =
  /^([ \t]*(?:>[ \t]*)*(?:[-+*]|\d+[.)]))[ \t]*$/;
const EMPTY_TASK_LIST_ITEM_LINE_PATTERN =
  /^([ \t]*(?:>[ \t]*)*(?:[-+*]|\d+[.)])[ \t]+\[(?: |x|X)\])[ \t]*$/;
const LIST_ITEM_MARKER_LINE_PATTERN =
  /^([ \t]*(?:>[ \t]*)*)([-+*]|\d+[.)])([ \t]+(?:\[(?: |x|X)\][ \t]+)?)(.*)$/;

export function preserveMarkdownBlankLinesForEditor(text: string): string {
  if (text.length === 0) return text;

  const expandedText = expandInlineTerminalListBreaksForEditor(text);
  const escapedText = escapeParagraphTrailingBackslashesForEditor(expandedText);
  const collapsedText = collapseExcessiveBlankLineRunsForEditor(escapedText);
  const preserved = mapMarkdownOutsideProtectedBlocks(collapsedText, (line, index, lines) => {
    const emptyListItemMatch = EMPTY_LIST_ITEM_LINE_PATTERN.exec(line);
    if (emptyListItemMatch) {
      return `${emptyListItemMatch[1]} ${EDITOR_EMPTY_PARAGRAPH_PLACEHOLDER}`;
    }

    const emptyTaskListItemMatch = EMPTY_TASK_LIST_ITEM_LINE_PATTERN.exec(line);
    if (emptyTaskListItemMatch) {
      return `${emptyTaskListItemMatch[1]} ${EDITOR_EMPTY_PARAGRAPH_PLACEHOLDER}`;
    }

    const blockquoteBrMatch = BLOCKQUOTE_BR_ONLY_PATTERN.exec(line);
    if (blockquoteBrMatch) {
      const prefix = blockquoteBrMatch[1] ?? '';
      return `${prefix}${getBlockquoteUserBrPlaceholder(prefix)}`;
    }

    if (BR_ONLY_PATTERN.test(line.trim())) {
      if (isBlankLineSurroundedLine(lines, index)) {
        return EDITOR_EMPTY_PARAGRAPH_PLACEHOLDER;
      }
      return `${line.match(/^\s*/)?.[0] ?? ''}${USER_BR_SENTINEL}`;
    }

    if (isBetweenListItemsBlankLine(lines, index)) {
      return createEditableListGapPlaceholderLine(lines, index);
    }

    if (
      isListBoundaryBlankLine(lines, index)
      || isDefinitionListBoundaryBlankLine(lines, index)
      || isHtmlImageStructuralBoundaryBlankLine(lines, index)
      || isMarkdownImageStructuralBoundaryBlankLine(lines, index)
      || isIndentedCodeBoundaryBlankLine(lines, index)
      || isIndentedContinuationBoundaryBlankLine(lines, index)
      || isAlignmentCommentBoundaryBlankLine(lines, index)
    ) {
      return line;
    }

    if (line.trim() === '') {
      return EDITOR_MARKDOWN_BLANK_LINE_PLACEHOLDER;
    }

    if (
      MARKDOWN_HEADING_LINE_PATTERN.test(line)
      && MARKDOWN_HEADING_LINE_PATTERN.test(lines[index + 1] ?? '')
    ) {
      return `${line}\n${EDITOR_TIGHT_HEADING_PLACEHOLDER}`;
    }

    const editorBlankLinePlaceholder = getEditorBlankLinePlaceholder(lines, index);
    if (editorBlankLinePlaceholder !== null) {
      return editorBlankLinePlaceholder;
    }

    return line;
  });
  return normalizeUserBreakSentinels(preserved);
}

export function preserveMarkdownBlankLinesForPaste(text: string): string {
  return compactEditorOnlyBlankLinePlaceholdersForPaste(
    preserveMarkdownBlankLinesForEditor(text)
  );
}

function compactEditorOnlyBlankLinePlaceholdersForPaste(text: string): string {
  if (
    !text.includes(EDITOR_MARKDOWN_BLANK_LINE_PLACEHOLDER)
    && !text.includes(EDITOR_TIGHT_HEADING_PLACEHOLDER)
  ) {
    return text;
  }

  const lines = text.split('\n');
  const output: string[] = [];

  for (let index = 0; index < lines.length;) {
    const line = lines[index] ?? '';

    if (line.trim() === EDITOR_TIGHT_HEADING_PLACEHOLDER) {
      output.push('');
      index += 1;
      continue;
    }

    if (line.trim() !== EDITOR_MARKDOWN_BLANK_LINE_PLACEHOLDER) {
      output.push(line);
      index += 1;
      continue;
    }

    let end = index + 1;
    while ((lines[end] ?? '').trim() === EDITOR_MARKDOWN_BLANK_LINE_PLACEHOLDER) {
      end += 1;
    }

    output.push('');
    for (let placeholderIndex = index + 1; placeholderIndex < end; placeholderIndex += 1) {
      output.push(EDITOR_MARKDOWN_BLANK_LINE_PLACEHOLDER);
    }
    index = end;
  }

  return output.join('\n');
}

function createEditableListGapPlaceholderLine(lines: readonly string[], index: number): string {
  const reference = findNearestListItemLine(lines, index, 1)
    ?? findNearestListItemLine(lines, index, -1);
  if (!reference) return LIST_GAP_PLACEHOLDER;

  const match = LIST_ITEM_MARKER_LINE_PATTERN.exec(reference);
  if (!match) return LIST_GAP_PLACEHOLDER;

  return `${match[1] ?? ''}- ${LIST_GAP_PLACEHOLDER}`;
}

function findNearestListItemLine(
  lines: readonly string[],
  startIndex: number,
  direction: -1 | 1,
): string | null {
  for (let index = startIndex + direction; index >= 0 && index < lines.length; index += direction) {
    const line = lines[index] ?? '';
    if (line.trim() === '') continue;
    if (LIST_ITEM_MARKER_LINE_PATTERN.test(line)) return line;
    return null;
  }
  return null;
}

function expandInlineTerminalListBreaksForEditor(text: string): string {
  return mapMarkdownOutsideProtectedSegments(text, (segment) =>
    segment.split('\n').map((line) => {
      const match = INLINE_TERMINAL_LIST_BR_PATTERN.exec(line);
      if (!match) return line;

      const prefix = match[1] ?? '';
      const marker = match[2] ?? '';
      const orderedMarker = match[3] ?? '';
      const content = match[4] ?? '';
      const lineWithoutBreak = line.slice(0, line.length - (line.match(/<br\s*\/?>\s*$/i)?.[0].length ?? 0));
      if (content.trim().length === 0) return line;

      const continuationIndent = orderedMarker
        ? `${prefix}${' '.repeat(marker.length + 1)}`
        : `${prefix}  `;
      return `${lineWithoutBreak}\\\n${continuationIndent}<br />`;
    }).join('\n')
  );
}

function collapseExcessiveBlankLineRunsForEditor(text: string): string {
  return mapMarkdownOutsideProtectedSegments(text, (segment) => {
    const lines = segment.split('\n');
    const output: string[] = [];
    let blankRunLength = 0;

    for (const line of lines) {
      if (line.trim() === '') {
        blankRunLength += 1;
        if (blankRunLength <= MAX_CONSECUTIVE_EDITOR_BLANK_LINES) {
          output.push(line);
        }
        continue;
      }

      blankRunLength = 0;
      output.push(line);
    }

    return output.join('\n');
  });
}

function getEditorBlankLinePlaceholder(
  lines: readonly string[],
  index: number,
): string | null {
  const line = lines[index] ?? '';
  if (line.trim() !== '') return null;

  const previousLine = index > 0 ? lines[index - 1] ?? '' : '';
  const nextLine = index < lines.length - 1 ? lines[index + 1] ?? '' : '';
  if (
    index > 0
    && index < lines.length - 1
    && previousLine.trim() === ''
  ) return `${EDITOR_EMPTY_PARAGRAPH_PLACEHOLDER}\n`;
  if (
    MARKDOWN_HEADING_LINE_PATTERN.test(previousLine)
    && MARKDOWN_HEADING_LINE_PATTERN.test(nextLine)
  ) return EDITOR_EMPTY_PARAGRAPH_PLACEHOLDER;
  return null;
}

function isBlankLineSurroundedLine(lines: readonly string[], index: number): boolean {
  if (index <= 0 || index >= lines.length - 1) return false;
  return (lines[index - 1] ?? '').trim() === ''
    && (lines[index + 1] ?? '').trim() === '';
}

function normalizeUserBreakSentinels(text: string): string {
  if (!text.includes(USER_BR_SENTINEL)) return text;

  const lines = text.split('\n');
  const output: string[] = [];

  for (const line of lines) {
    const sentinelMatch = USER_BR_SENTINEL_LINE_PATTERN.exec(line);
    if (!sentinelMatch) {
      output.push(line);
      continue;
    }

    const prefix = sentinelMatch[1] ?? '';
    const previousIndex = output.length - 1;
    const previousLine = previousIndex >= 0 ? output[previousIndex] : null;

    if (previousLine !== null && !isEditorPlaceholderBlankLine(previousLine)) {
      if (HARD_BREAK_LINE_PATTERN.test(previousLine)) {
        output.push(`${prefix}<br />`);
        continue;
      }
      output[previousIndex] = previousLine.replace(/[ \t]*$/, '\\');
      continue;
    }

    output.push(`${prefix}<br />`);
  }

  return output.join('\n')
    .replace(/\n{3,}(<br \/>)/g, '\n\n$1')
    .replace(/(<br \/>)\n{3,}/g, '$1\n\n');
}

function isEditorPlaceholderBlankLine(line: string): boolean {
  return line.replace(/\\?\u200B|\\?\u200C/g, '').trim().length === 0;
}

function getBlockquoteUserBrPlaceholder(_prefix: string): string {
  return USER_BR_SENTINEL;
}
