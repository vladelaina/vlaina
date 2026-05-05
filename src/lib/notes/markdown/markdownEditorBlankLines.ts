import { mapMarkdownOutsideProtectedBlocks } from './markdownProtectedBlocks';
import {
  isAlignmentCommentBoundaryBlankLine,
  isFencedCodeBoundaryBlankLine,
  isBetweenListItemsBlankLine,
  isHtmlBlockBoundaryBlankLine,
  isHtmlCommentBoundaryBlankLine,
  isIndentedCodeBoundaryBlankLine,
  isListBoundaryBlankLine,
  isTableBoundaryBlankLine,
  isThematicBreakBoundaryBlankLine,
} from './markdownBlankLineBoundaries';

const BR_ONLY_PATTERN = /^<br\s*\/?>$/i;
const BLOCKQUOTE_BR_ONLY_PATTERN = /^(\s*(?:>\s*)+)<br\s*\/?>$/i;
const EDITOR_EMPTY_PARAGRAPH_PLACEHOLDER = '<br />';
const LIST_GAP_PLACEHOLDER = '\u200B\u200C';
const USER_BR_SENTINEL = '\u0000VLAINA_USER_BR_SENTINEL\u0000';
const USER_BR_SENTINEL_LINE_PATTERN =
  new RegExp(`^(\\s*(?:>\\s*)*)${USER_BR_SENTINEL}$`);
const MARKDOWN_HEADING_LINE_PATTERN = /^\s{0,3}#{1,6}\s+/;

export function preserveMarkdownBlankLinesForEditor(text: string): string {
  if (text.length === 0) return text;

  const preserved = mapMarkdownOutsideProtectedBlocks(text, (line, index, lines) => {
    const blockquoteBrMatch = BLOCKQUOTE_BR_ONLY_PATTERN.exec(line);
    if (blockquoteBrMatch) {
      const prefix = blockquoteBrMatch[1] ?? '';
      return `${prefix}${getBlockquoteUserBrPlaceholder(prefix)}`;
    }

    if (BR_ONLY_PATTERN.test(line.trim())) {
      if (isBlankLineSurroundedLine(lines, index)) {
        return EDITOR_EMPTY_PARAGRAPH_PLACEHOLDER;
      }
      return USER_BR_SENTINEL;
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

    if (isThematicBreakBoundaryBlankLine(lines, index)) {
      return line;
    }

    if (isIndentedCodeBoundaryBlankLine(lines, index)) {
      return line;
    }

    if (isFencedCodeBoundaryBlankLine(lines, index)) {
      return line;
    }

    if (isHtmlCommentBoundaryBlankLine(lines, index)) {
      return line;
    }

    if (isHtmlBlockBoundaryBlankLine(lines, index)) {
      return line;
    }

    if (isAlignmentCommentBoundaryBlankLine(lines, index)) {
      return line;
    }

    const editorBlankLinePlaceholder = getEditorBlankLinePlaceholder(lines, index);
    if (editorBlankLinePlaceholder !== null) {
      return editorBlankLinePlaceholder;
    }

    return line;
  });
  return normalizeUserBreakSentinels(preserved);
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
