import {
  mapMarkdownOutsideProtectedBlocks,
  mapMarkdownOutsideProtectedSegments,
} from './markdownProtectedBlocks';
import {
  collapseSyntheticBlankLinesAroundEmptyPlaceholders,
  collapseSyntheticBlankLinesBetweenAdjacentHeadings,
} from './markdownHeadingSpacing';
import { normalizeCanonicalMarkdownSpacing } from './markdownCanonicalSpacing';
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
export { joinSerializedBlocks } from './markdownBlockJoin';

const BR_ONLY_PATTERN = /^<br\s*\/?>$/i;
const BLOCKQUOTE_BR_ONLY_PATTERN = /^(\s*(?:>\s*)+)<br\s*\/?>$/i;
const VLAINA_EMPTY_LINE_ATTR_PATTERN = '\\bdat[ae]-vla(?:ina|ian)-?(?:empty|empt)-line';
const VLAINA_LIST_GAP_ATTR_PATTERN = '\\bdat[ae]-vla(?:ina|ian)-?list-gap';
const VLAINA_USER_BR_ATTR_PATTERN = '\\bdat[ae]-vla(?:ina|ian)-?user-br';
const VLAINA_BLOCKQUOTE_DEPTH_ATTR_PATTERN = '\\bdat[ae]-vla(?:ina|ian)-?blockquote-depth';
const TRUE_ATTR_VALUE_PATTERN = '(?:"true"|\'true\'|true\\b)';
const DEPTH_ATTR_VALUE_PATTERN = '(?:"(\\d+)"|\'(\\d+)\'|(\\d+)\\b)';
const MARKED_BR_ONLY_PATTERN =
  new RegExp(`^<br\\b(?=[^>]*${VLAINA_EMPTY_LINE_ATTR_PATTERN}=${TRUE_ATTR_VALUE_PATTERN})[^>]*\\/?>\\s*(?:<\\/br>)?$`, 'i');
const MARKDOWN_ESCAPE_PATTERN = /\\([\\`*_{}[\]()#+\-.!])/g;
const EMPTY_LINE_PLACEHOLDER = '\u200B';
const USER_BR_PLACEHOLDER = '<br data-vlaina-user-br="true" />';
const LIST_GAP_PLACEHOLDER = '\u200B\u200C';
const LIST_GAP_SENTINEL = '\u0000VLAINA_LIST_GAP_SENTINEL\u0000';
const INVISIBLE_EMPTY_LINE_PLACEHOLDER_PATTERN = /^[\t ]*\\?\u200B[\t ]*$/;
const INVISIBLE_LIST_GAP_PLACEHOLDER_PATTERN = /^[\t ]*\\?\u200B\\?\u200C[\t ]*$/;
const MARKED_EMPTY_MARKDOWN_LINE_PLACEHOLDER_PATTERN =
  new RegExp(`^(\\s*(?:>\\s*)*(?:(?:[-+*]|\\d+[.)])\\s+(?:\\[(?: |x|X)\\]\\s+)?)?)<br\\b(?=[^>]*${VLAINA_EMPTY_LINE_ATTR_PATTERN}=${TRUE_ATTR_VALUE_PATTERN})[^>]*\\/?>\\s*(?:<\\/br>)?$`, 'gim');
const MARKED_EMPTY_LINE_PATTERN =
  new RegExp(`^<br\\b(?=[^>]*${VLAINA_EMPTY_LINE_ATTR_PATTERN}=${TRUE_ATTR_VALUE_PATTERN})[^>]*\\/?>\\s*(?:<\\/br>)?$`, 'i');
const MARKED_EMPTY_LINE_TOKEN_PATTERN =
  new RegExp(`[ \\t]*<br\\b(?=[^>]*${VLAINA_EMPTY_LINE_ATTR_PATTERN}=${TRUE_ATTR_VALUE_PATTERN})[^>]*\\/?>[ \\t]*(?:<\\/br>)?`, 'gi');
const MARKED_USER_BR_PATTERN =
  new RegExp(`^<br\\b(?=[^>]*${VLAINA_USER_BR_ATTR_PATTERN}=${TRUE_ATTR_VALUE_PATTERN})[^>]*\\/?>\\s*(?:<\\/br>)?$`, 'i');
const MARKED_BLOCKQUOTE_USER_BR_PATTERN =
  new RegExp(`^(\\s*(?:>\\s*)+)<br\\b(?=[^>]*${VLAINA_USER_BR_ATTR_PATTERN}=${TRUE_ATTR_VALUE_PATTERN})[^>]*\\/?>\\s*(?:<\\/br>)?$`, 'i');
const MARKED_BLOCKQUOTE_USER_BR_WITH_DEPTH_PATTERN =
  new RegExp(`^(\\s*(?:>\\s*)*)<br\\b(?=[^>]*${VLAINA_USER_BR_ATTR_PATTERN}=${TRUE_ATTR_VALUE_PATTERN})(?=[^>]*${VLAINA_BLOCKQUOTE_DEPTH_ATTR_PATTERN}=${DEPTH_ATTR_VALUE_PATTERN})[^>]*\\/?>\\s*(?:<\\/br>)?$`, 'i');
const MARKED_BLOCKQUOTE_USER_BR_TOKEN_PATTERN =
  new RegExp(`[ \\t]*(?:\\\\?\\u200B[ \\t]*)?<br\\b(?=[^>]*${VLAINA_USER_BR_ATTR_PATTERN}=${TRUE_ATTR_VALUE_PATTERN})(?=[^>]*${VLAINA_BLOCKQUOTE_DEPTH_ATTR_PATTERN}=${DEPTH_ATTR_VALUE_PATTERN})[^>]*\\/?>[ \\t]*(?:<\\/br>)?`, 'gi');
const MARKED_USER_BR_TOKEN_PATTERN =
  new RegExp(`[ \\t]*(?:\\\\?\\u200B[ \\t]*)?<br\\b(?=[^>]*${VLAINA_USER_BR_ATTR_PATTERN}=${TRUE_ATTR_VALUE_PATTERN})[^>]*\\/?>[ \\t]*(?:<\\/br>)?`, 'gi');
const MARKED_LIST_GAP_TOKEN_PATTERN = new RegExp(`[ \\t]*<br\\b(?=[^>]*${VLAINA_LIST_GAP_ATTR_PATTERN}=${TRUE_ATTR_VALUE_PATTERN})[^>]*\\/?>[ \\t]*(?:<\\/br>)?`, 'gi');
const EMPTY_LIST_ITEM_PLACEHOLDER_PATTERN =
  /^(\s*(?:>\s*)*(?:[-+*]|\d+[.)])\s+(?:\[(?: |x|X)\]\s+)?)<br\s*\/?>$/gim;
const EMPTY_TABLE_CELL_PLACEHOLDER_PATTERN = /(\|\s*)<br\s*\/?>(\s*\|)/g;

function unescapeMarkdownPunctuation(text: string): string {
  return mapMarkdownOutsideProtectedBlocks(text, (line) => line.replace(MARKDOWN_ESCAPE_PATTERN, '$1'));
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
  return normalizeListItemBlankLines(
    stripEmptyMarkdownPlaceholders(
      normalizeCanonicalMarkdownSpacing(
        collapseSyntheticBlankLinesAroundEmptyPlaceholders(
          collapseSyntheticBlankLinesBetweenAdjacentHeadings(text)
        )
      )
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
      if (INVISIBLE_LIST_GAP_PLACEHOLDER_PATTERN.test(line)) {
        return LIST_GAP_SENTINEL;
      }
      if (INVISIBLE_EMPTY_LINE_PLACEHOLDER_PATTERN.test(line)) {
        return '';
      }
      if (MARKED_EMPTY_LINE_PATTERN.test(trimmed)) {
        return '';
      }
      const blockquoteUserBrWithDepthMatch =
        MARKED_BLOCKQUOTE_USER_BR_WITH_DEPTH_PATTERN.exec(line);
      if (blockquoteUserBrWithDepthMatch) {
        const prefix = blockquoteUserBrWithDepthMatch[1] || getBlockquotePrefix(
          Number(
            blockquoteUserBrWithDepthMatch[2]
            ?? blockquoteUserBrWithDepthMatch[3]
            ?? blockquoteUserBrWithDepthMatch[4]
            ?? 0
          )
        );
        return `${prefix}<br />`;
      }
      if (MARKED_USER_BR_PATTERN.test(trimmed)) {
        return '<br />';
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
          (_match, doubleQuotedDepth: string, singleQuotedDepth: string, unquotedDepth: string) =>
            `\n${getBlockquotePrefix(Number(
              doubleQuotedDepth ?? singleQuotedDepth ?? unquotedDepth
            ))}<br />`
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
  if (
    isStandaloneBreak
    || (text.length > 0 && withoutTrailingNewlines.length === 0)
    || BR_ONLY_PATTERN.test(withoutTrailingNewlines.trim())
  ) return '\n';
  return unescapeMarkdownPunctuation(withoutTrailingNewlines);
}
