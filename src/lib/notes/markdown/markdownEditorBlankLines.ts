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
const EDITOR_RENDERED_HTML_BOUNDARY_PLACEHOLDER = '<!--vlaina-rendered-html-boundary-blank-line-->';
const EDITOR_TIGHT_HEADING_PLACEHOLDER = '<!--vlaina-markdown-tight-heading-->';
const EDITOR_NON_PERSISTED_BLOCK_BOUNDARY_PLACEHOLDER = EDITOR_TIGHT_HEADING_PLACEHOLDER;
const LIST_GAP_PLACEHOLDER = '\u2800';
const USER_BR_SENTINEL = '\u0000VLAINA_USER_BR_SENTINEL\u0000';
const HARD_BREAK_LINE_PATTERN = /(?:\\| {2,})$/;
const INLINE_TERMINAL_LIST_BR_PATTERN =
  /^(\s*(?:>\s*)*)((?:[-+*])|(\d+[.)]))\s+(?:\[(?: |x|X)\]\s+)?(.+?)<br\s*\/?>\s*$/i;
const USER_BR_SENTINEL_LINE_PATTERN =
  new RegExp(`^(\\s*(?:>\\s*)*)${USER_BR_SENTINEL}$`);
const MARKDOWN_HEADING_LINE_PATTERN = /^\s{0,3}#{1,6}\s+/;
const STANDALONE_ESCAPED_BACKSLASH_LINE_PATTERN = /^[ \t]*\\\\[ \t]*$/;
const HTML_ONE_LINE_RENDERED_BLOCK_PATTERN =
  /^(?: {0,3})<([A-Za-z][A-Za-z0-9-]*)(?:\s|>|\/>)[\s\S]*?(?:<\/\1>|\/>)[ \t]*$/;
const HTML_ONE_LINE_RENDERED_VOID_BLOCK_PATTERN =
  /^(?: {0,3})<(?:img|hr|br)(?:\s|\/?>|$)[\s\S]*$/i;
const HTML_CLOSING_RENDERED_BLOCK_PATTERN =
  /^(?: {0,3})<\/([A-Za-z][A-Za-z0-9-]*)\s*>[ \t]*$/;
const NON_EDITABLE_HTML_BOUNDARY_TAG_NAMES = new Set([
  'base',
  'basefont',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'script',
  'style',
  'pre',
  'textarea',
  'title',
  'xmp',
  'noembed',
  'noframes',
  'plaintext',
  'math',
  'noscript',
  'svg',
]);
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
  const preserved = mapMarkdownOutsideProtectedBlocks(escapedText, (line, index, lines) => {
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
      STANDALONE_ESCAPED_BACKSLASH_LINE_PATTERN.test(line)
      && (lines[index + 1] ?? '').trim() !== ''
    ) {
      return `${line}\n${EDITOR_NON_PERSISTED_BLOCK_BOUNDARY_PLACEHOLDER}`;
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
  return normalizeUserBreakSentinels(
    exposeRenderedHtmlBoundaryBlankLinesForEditor(preserved)
  );
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

function exposeRenderedHtmlBoundaryBlankLinesForEditor(text: string): string {
  if (!text.includes('\n\n')) return text;

  const lines = text.split('\n');
  let changed = false;
  const output: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    output.push(line);
    if (line.trim() !== '') continue;

    const previous = findNearestNonBlankLine(lines, index, -1);
    const next = findNearestNonBlankLine(lines, index, 1);
    if (!next || !isRenderedHtmlBoundaryBlockLine(previous)) continue;
    if ((lines[index + 1] ?? '').trim() === EDITOR_MARKDOWN_BLANK_LINE_PLACEHOLDER) continue;
    if ((lines[index + 1] ?? '').trim() === EDITOR_RENDERED_HTML_BOUNDARY_PLACEHOLDER) continue;

    changed = true;
    output.push(EDITOR_RENDERED_HTML_BOUNDARY_PLACEHOLDER);
  }

  return changed ? output.join('\n') : text;
}

function isRenderedHtmlBoundaryBlockLine(line: string | null): boolean {
  if (line === null) return false;

  const match = HTML_ONE_LINE_RENDERED_BLOCK_PATTERN.exec(line)
    ?? HTML_ONE_LINE_RENDERED_VOID_BLOCK_PATTERN.exec(line);
  const closingTagName = HTML_CLOSING_RENDERED_BLOCK_PATTERN.exec(line)?.[1]?.toLowerCase();
  const tagName = match?.[1]?.toLowerCase() ?? closingTagName ?? getHtmlStartTagName(line);
  return Boolean(tagName && !NON_EDITABLE_HTML_BOUNDARY_TAG_NAMES.has(tagName));
}

function getHtmlStartTagName(line: string): string | null {
  const match = /^(?: {0,3})<([A-Za-z][A-Za-z0-9-]*)(?:\s|>|\/>)/.exec(line);
  return match?.[1]?.toLowerCase() ?? null;
}

function findNearestNonBlankLine(
  lines: readonly string[],
  startIndex: number,
  direction: -1 | 1,
): string | null {
  for (let index = startIndex + direction; index >= 0 && index < lines.length; index += direction) {
    const line = lines[index] ?? '';
    if (line.trim() !== '') return line;
  }
  return null;
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

  return mapMarkdownOutsideProtectedSegments(text, normalizeUserBreakSentinelSegment);
}

function normalizeUserBreakSentinelSegment(segment: string): string {
  const lines = segment.split('\n');
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
