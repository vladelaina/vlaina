import { mapMarkdownOutsideProtectedBlocks, mapMarkdownOutsideProtectedSegments, } from './markdownProtectedBlocks';
import {
  BR_ONLY_PATTERN, UTF8_BOM, MARKED_BR_ONLY_PATTERN, INTERNAL_MARKDOWN_BLANK_LINE_COMMENT_PATTERN, RENDERED_HTML_BOUNDARY_BLANK_LINE_COMMENT_PATTERN, INTERNAL_TIGHT_HEADING_COMMENT_PATTERN, HTML_COMMENT_OPEN_PATTERN, HTML_COMMENT_CLOSE_PATTERN, HTML_IMAGE_LINE_PATTERN, HTML_BLOCK_LINE_PATTERN, HTML_ONE_LINE_RENDERED_BLOCK_PATTERN, HTML_ONE_LINE_RENDERED_VOID_BLOCK_PATTERN, HTML_CLOSING_RENDERED_BLOCK_PATTERN, NON_EDITABLE_HTML_BOUNDARY_TAG_NAMES, MARKDOWN_ESCAPE_PATTERN, ESCAPED_LESS_THAN_PATTERN, REDUNDANT_PAIRED_MARKER_ESCAPES, LIST_GAP_SENTINEL, USER_BR_SENTINEL, LEAKED_USER_BR_SENTINEL_PATTERN, LEAKED_LIST_GAP_SENTINEL_WITH_NEWLINES_PATTERN, MARKDOWN_SPACE_ENTITY_PATTERN, LEADING_MARKDOWN_SPACE_ENTITY_RUN_PATTERN, MARKDOWN_SPACE_ENTITY_REPLACEMENT_PATTERN, BLOCKQUOTE_CONTAINER_PREFIX_PATTERN, LIST_CONTAINER_PREFIX_PATTERN, INVISIBLE_EMPTY_LINE_PLACEHOLDER_PATTERN, INVISIBLE_LIST_GAP_PLACEHOLDER_PATTERN, EDITABLE_LIST_GAP_PLACEHOLDER_PATTERN, USER_BR_SENTINEL_LINE_PATTERN, MARKED_EMPTY_MARKDOWN_LINE_PLACEHOLDER_PATTERN, MARKED_EMPTY_LINE_PATTERN, MARKED_EMPTY_LINE_TOKEN_PATTERN, MARKED_USER_BR_PATTERN, MARKED_BLOCKQUOTE_USER_BR_PATTERN, MARKED_BLOCKQUOTE_USER_BR_WITH_DEPTH_PATTERN, MARKED_BLOCKQUOTE_USER_BR_TOKEN_PATTERN, MARKED_USER_BR_TOKEN_PATTERN, MARKED_LIST_GAP_TOKEN_PATTERN, EMPTY_LIST_ITEM_PLACEHOLDER_PATTERN, EDITABLE_LIST_GAP_MARKER_PLACEHOLDER_PATTERN, SERIALIZED_EDITABLE_LIST_GAP_PLACEHOLDER_PATTERN, STANDALONE_BR_LINE_PATTERN, BLOCKQUOTE_STANDALONE_BR_LINE_PATTERN, INLINE_TERMINAL_LIST_BR_PATTERN, EMPTY_FOOTNOTE_DEFINITION_PLACEHOLDER_PATTERN, EMPTY_TABLE_CELL_PLACEHOLDER_PATTERN, EMPTY_ATX_HEADING_MARKER_PATTERN, LIST_ITEM_LINE_PATTERN, NESTED_LIST_ITEM_LINE_PATTERN, MISSING_ORDERED_LIST_SPACE_LINE_PATTERN, MISSING_UNORDERED_LIST_SPACE_LINE_PATTERN, UNICODE_BULLET_LIST_LINE_PATTERN, CHINESE_ORDERED_LIST_MARKER_PATTERN, MALFORMED_TASK_LIST_MARKER_PATTERN, FULLWIDTH_MARKDOWN_LINE_MARKER_PATTERN, FULLWIDTH_ORDERED_LIST_DIGIT_PATTERN, FULLWIDTH_TABLE_PIPE_PATTERN, TABLE_ROW_PATTERN, TABLE_DELIMITER_ROW_PATTERN, MISSING_BLOCKQUOTE_SPACE_PATTERN, CJK_ATX_HEADING_WITHOUT_SPACE_PATTERN, GENERIC_HTML_BLOCK_OPEN_LINE_PATTERN, RAW_HTML_BLOCK_OPEN_LINE_PATTERN, MAX_CACHED_MARKDOWN_NORMALIZATION_LENGTH, FAST_NORMALIZATION_MIN_LENGTH, ESCAPED_HIGHLIGHT_PATTERN, ESCAPED_URL_SCHEME_PATTERN, MARKDOWN_AUTOLINK_LITERAL_PATTERN, MAILTO_EMAIL_MARKDOWN_LINK_PATTERN, FAST_NORMALIZATION_STRUCTURAL_LINE_PATTERN, ALTERNATIVE_MATH_BLOCK_OPEN_PATTERN, ALTERNATIVE_MATH_BLOCK_STANDARD_CLOSE_PATTERN, ALTERNATIVE_MATH_BLOCK_BRACKET_CLOSE_PATTERN, ALTERNATIVE_MATH_BLOCK_STANDARD_CLOSE_SUFFIX_PATTERN, ALTERNATIVE_MATH_BLOCK_BRACKET_CLOSE_SUFFIX_PATTERN, DOLLAR_MATH_BLOCK_FENCE_PATTERN, LATEX_LIKE_MATH_CONTENT_PATTERN, GENERIC_HTML_BLOCK_TAGS, MathBlockFenceStyle, MathBlockFenceReference, MathBlockFenceReferenceIndex, DollarMathFenceMatch, MarkdownFenceLine, GenericHtmlSpacingFenceState } from './markdownSerializationShared';

export function normalizeAlternativeMathBlockFences(text: string): string {
  return mapMarkdownOutsideProtectedSegments(text, (segment) => {
    const lines = segment.split('\n');
    const output: string[] = [];
    let pendingFence: {
      prefix: string;
      bracketCloseFence: boolean;
      bracketOnlyFence: boolean;
      lines: string[];
    } | null = null;

    for (const line of lines) {
      if (pendingFence) {
        const close = getAlternativeMathBlockClose(line, pendingFence);

        if (
          close
          && (!pendingFence.bracketOnlyFence
            || isLatexLikeMathBlock([
              ...pendingFence.lines.slice(1),
              ...(close.contentLine === null ? [] : [close.contentLine]),
            ]))
        ) {
          const converted = [
            `${pendingFence.prefix}$$`,
            ...pendingFence.lines.slice(1),
            ...(close.contentLine === null ? [] : [close.contentLine]),
            `${pendingFence.prefix}$$`,
          ];
          if (close.bracketClose && converted.length > 2) {
            const contentLineIndex = converted.length - 2;
            converted[contentLineIndex] = stripSingleTrailingBackslash(
              converted[contentLineIndex] ?? ''
            );
          }
          output.push(...converted);
          pendingFence = null;
          continue;
        }

        pendingFence.lines.push(line);
        continue;
      }

      const open = ALTERNATIVE_MATH_BLOCK_OPEN_PATTERN.exec(line);
      if (open) {
        pendingFence = {
          prefix: open[1] ?? '',
          bracketCloseFence: isAlternativeMathBlockBracketCloseFence(open[2] ?? ''),
          bracketOnlyFence: line.trim() === '[',
          lines: [line],
        };
        continue;
      }

      output.push(line);
    }

    if (pendingFence) {
      output.push(...pendingFence.lines);
    }

    return output.join('\n');
  }, { protectMathBlocks: false });
}

export function getAlternativeMathBlockClose(
  line: string,
  pendingFence: { prefix: string; bracketCloseFence: boolean; bracketOnlyFence: boolean }
): { bracketClose: boolean; contentLine: string | null } | null {
  const standardClose = ALTERNATIVE_MATH_BLOCK_STANDARD_CLOSE_PATTERN.exec(line);
  if (standardClose && (standardClose[1] ?? '') === pendingFence.prefix) {
    return { bracketClose: false, contentLine: null };
  }

  const canUseBracketClose = pendingFence.bracketCloseFence || pendingFence.bracketOnlyFence;
  const bracketClose = canUseBracketClose
    ? ALTERNATIVE_MATH_BLOCK_BRACKET_CLOSE_PATTERN.exec(line)
    : null;
  if (bracketClose && (bracketClose[1] ?? '') === pendingFence.prefix) {
    return { bracketClose: true, contentLine: null };
  }

  const standardSuffix = ALTERNATIVE_MATH_BLOCK_STANDARD_CLOSE_SUFFIX_PATTERN.exec(line);
  if (standardSuffix && hasAlternativeMathInlineCloseContent(standardSuffix[1] ?? '', pendingFence.prefix)) {
    return { bracketClose: false, contentLine: standardSuffix[1] ?? '' };
  }

  const bracketSuffix = canUseBracketClose
    ? ALTERNATIVE_MATH_BLOCK_BRACKET_CLOSE_SUFFIX_PATTERN.exec(line)
    : null;
  if (bracketSuffix && hasAlternativeMathInlineCloseContent(bracketSuffix[1] ?? '', pendingFence.prefix)) {
    return { bracketClose: true, contentLine: bracketSuffix[1] ?? '' };
  }

  return null;
}

export function hasAlternativeMathInlineCloseContent(contentLine: string, prefix: string): boolean {
  if (prefix && !contentLine.startsWith(prefix)) return false;
  return contentLine.slice(prefix.length).trim().length > 0;
}

export function isLatexLikeMathBlock(lines: readonly string[]): boolean {
  return LATEX_LIKE_MATH_CONTENT_PATTERN.test(lines.join('\n'));
}

export function isAlternativeMathBlockBracketCloseFence(marker: string): boolean {
  return marker === '[' || marker.endsWith('\\');
}

export function stripSingleTrailingBackslash(line: string): string {
  const withoutTrailingWhitespace = line.replace(/[ \t]+$/, '');
  return withoutTrailingWhitespace.endsWith('\\') && !withoutTrailingWhitespace.endsWith('\\\\')
    ? withoutTrailingWhitespace.slice(0, -1)
    : line;
}
