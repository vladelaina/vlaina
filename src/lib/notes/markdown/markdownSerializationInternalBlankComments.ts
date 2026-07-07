import { mapMarkdownOutsideProtectedBlocks, mapMarkdownOutsideProtectedSegments, } from './markdownProtectedBlocks';
import { getMarkdownBlockContent } from '@/lib/markdown/markdownHtmlBlockClassification';
import { isMarkdownImageOnlyLine } from './markdownImageLine';
import {
  BR_ONLY_PATTERN, UTF8_BOM, MARKED_BR_ONLY_PATTERN, INTERNAL_MARKDOWN_BLANK_LINE_COMMENT_PATTERN, RENDERED_HTML_BOUNDARY_BLANK_LINE_COMMENT_PATTERN, INTERNAL_TIGHT_HEADING_COMMENT_PATTERN, HTML_COMMENT_OPEN_PATTERN, HTML_COMMENT_CLOSE_PATTERN, HTML_IMAGE_LINE_PATTERN, HTML_BLOCK_LINE_PATTERN, HTML_ONE_LINE_RENDERED_BLOCK_PATTERN, HTML_ONE_LINE_RENDERED_VOID_BLOCK_PATTERN, HTML_CLOSING_RENDERED_BLOCK_PATTERN, NON_EDITABLE_HTML_BOUNDARY_TAG_NAMES, MARKDOWN_ESCAPE_PATTERN, ESCAPED_LESS_THAN_PATTERN, REDUNDANT_PAIRED_MARKER_ESCAPES, LIST_GAP_SENTINEL, USER_BR_SENTINEL, LEAKED_USER_BR_SENTINEL_PATTERN, LEAKED_LIST_GAP_SENTINEL_WITH_NEWLINES_PATTERN, MARKDOWN_SPACE_ENTITY_PATTERN, LEADING_MARKDOWN_SPACE_ENTITY_RUN_PATTERN, MARKDOWN_SPACE_ENTITY_REPLACEMENT_PATTERN, BLOCKQUOTE_CONTAINER_PREFIX_PATTERN, LIST_CONTAINER_PREFIX_PATTERN, INVISIBLE_EMPTY_LINE_PLACEHOLDER_PATTERN, INVISIBLE_LIST_GAP_PLACEHOLDER_PATTERN, EDITABLE_LIST_GAP_PLACEHOLDER_PATTERN, USER_BR_SENTINEL_LINE_PATTERN, MARKED_EMPTY_MARKDOWN_LINE_PLACEHOLDER_PATTERN, MARKED_EMPTY_LINE_PATTERN, MARKED_EMPTY_LINE_TOKEN_PATTERN, MARKED_USER_BR_PATTERN, MARKED_BLOCKQUOTE_USER_BR_PATTERN, MARKED_BLOCKQUOTE_USER_BR_WITH_DEPTH_PATTERN, MARKED_BLOCKQUOTE_USER_BR_TOKEN_PATTERN, MARKED_USER_BR_TOKEN_PATTERN, MARKED_LIST_GAP_TOKEN_PATTERN, EMPTY_LIST_ITEM_PLACEHOLDER_PATTERN, EDITABLE_LIST_GAP_MARKER_PLACEHOLDER_PATTERN, SERIALIZED_EDITABLE_LIST_GAP_PLACEHOLDER_PATTERN, STANDALONE_BR_LINE_PATTERN, BLOCKQUOTE_STANDALONE_BR_LINE_PATTERN, INLINE_TERMINAL_LIST_BR_PATTERN, EMPTY_FOOTNOTE_DEFINITION_PLACEHOLDER_PATTERN, EMPTY_TABLE_CELL_PLACEHOLDER_PATTERN, EMPTY_ATX_HEADING_MARKER_PATTERN, LIST_ITEM_LINE_PATTERN, NESTED_LIST_ITEM_LINE_PATTERN, MISSING_ORDERED_LIST_SPACE_LINE_PATTERN, MISSING_UNORDERED_LIST_SPACE_LINE_PATTERN, UNICODE_BULLET_LIST_LINE_PATTERN, CHINESE_ORDERED_LIST_MARKER_PATTERN, MALFORMED_TASK_LIST_MARKER_PATTERN, FULLWIDTH_MARKDOWN_LINE_MARKER_PATTERN, FULLWIDTH_ORDERED_LIST_DIGIT_PATTERN, FULLWIDTH_TABLE_PIPE_PATTERN, TABLE_ROW_PATTERN, TABLE_DELIMITER_ROW_PATTERN, MISSING_BLOCKQUOTE_SPACE_PATTERN, CJK_ATX_HEADING_WITHOUT_SPACE_PATTERN, GENERIC_HTML_BLOCK_OPEN_LINE_PATTERN, RAW_HTML_BLOCK_OPEN_LINE_PATTERN, MAX_CACHED_MARKDOWN_NORMALIZATION_LENGTH, FAST_NORMALIZATION_MIN_LENGTH, ESCAPED_HIGHLIGHT_PATTERN, ESCAPED_URL_SCHEME_PATTERN, MARKDOWN_AUTOLINK_LITERAL_PATTERN, MAILTO_EMAIL_MARKDOWN_LINK_PATTERN, FAST_NORMALIZATION_STRUCTURAL_LINE_PATTERN, ALTERNATIVE_MATH_BLOCK_OPEN_PATTERN, ALTERNATIVE_MATH_BLOCK_STANDARD_CLOSE_PATTERN, ALTERNATIVE_MATH_BLOCK_BRACKET_CLOSE_PATTERN, ALTERNATIVE_MATH_BLOCK_STANDARD_CLOSE_SUFFIX_PATTERN, ALTERNATIVE_MATH_BLOCK_BRACKET_CLOSE_SUFFIX_PATTERN, DOLLAR_MATH_BLOCK_FENCE_PATTERN, LATEX_LIKE_MATH_CONTENT_PATTERN, GENERIC_HTML_BLOCK_TAGS, MathBlockFenceStyle, MathBlockFenceReference, MathBlockFenceReferenceIndex, DollarMathFenceMatch, MarkdownFenceLine, GenericHtmlSpacingFenceState } from './markdownSerializationShared';
import { containsAsciiCaseInsensitive } from './markdownSerializationAscii';

export function normalizeInternalMarkdownBlankLineComments(text: string): string {
  if (
    !containsAsciiCaseInsensitive(text, 'vlaina-markdown-blank-line')
    && !containsAsciiCaseInsensitive(text, 'vlaina-rendered-html-boundary-blank-line')
  ) return text;

  const afterRenderedHtmlBoundaryHelpers = normalizeRenderedHtmlBoundaryHelperComments(text);
  const shouldCollapseSingleHtmlBoundaryPlaceholder =
    hasSingleInternalBlankLineCommentAfterHtmlBoundary(afterRenderedHtmlBoundaryHelpers);
  const normalized = mapMarkdownOutsideProtectedSegments(
    afterRenderedHtmlBoundaryHelpers,
    (segment, startIndex, lines) =>
      normalizeInternalMarkdownBlankLineCommentSegment(segment, startIndex, lines),
    { protectHtmlComments: false },
  );
  return shouldCollapseSingleHtmlBoundaryPlaceholder
    ? collapseHtmlBoundaryBlankLinesCreatedByInternalComments(normalized)
    : normalized;
}

export function normalizeRenderedHtmlBoundaryHelperComments(text: string): string {
  if (!containsAsciiCaseInsensitive(text, 'vlaina-rendered-html-boundary-blank-line')) return text;

  return mapMarkdownOutsideProtectedSegments(
    text,
    (segment, startIndex, lines) =>
      normalizeRenderedHtmlBoundaryHelperCommentSegment(segment, startIndex, lines),
    { protectHtmlBlocks: false, protectHtmlComments: false },
  );
}

export function normalizeRenderedHtmlBoundaryHelperCommentSegment(
  text: string,
  startIndex: number,
  allLines: readonly string[],
): string {
  const lines = text.split('\n');
  let changed = false;
  const output: string[] = [];
  let activeHtmlComment = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (activeHtmlComment || isMultiLineHtmlCommentOpenLine(line)) {
      output.push(line);
      activeHtmlComment = shouldKeepHtmlCommentProtectionActive(activeHtmlComment, line);
      continue;
    }

    if (!RENDERED_HTML_BOUNDARY_BLANK_LINE_COMMENT_PATTERN.test(line)) {
      output.push(line);
      continue;
    }

    const previousBoundaryLine =
      findNearestPreviousNonBlankOutputLine(output)
      ?? findNearestPreviousNonBlankInputLine(allLines, startIndex + index - 1);
    if (isRenderedHtmlBlockBoundaryLine(previousBoundaryLine)) {
      changed = true;
      const hadLocalBlankBeforeHelper = output.length > 0 && output[output.length - 1]?.trim() === '';
      const hadInputBlankBeforeHelper = (allLines[startIndex + index - 1] ?? '').trim() === '';
      while (output.length > 0 && output[output.length - 1]?.trim() === '') {
        output.pop();
      }
      if (hadLocalBlankBeforeHelper || !hadInputBlankBeforeHelper) {
        output.push('');
      }
    } else {
      output.push(line);
      continue;
    }

    while (index + 1 < lines.length && (lines[index + 1] ?? '').trim() === '') {
      index += 1;
    }
  }

  return changed ? output.join('\n') : text;
}

export function hasSingleInternalBlankLineCommentAfterHtmlBoundary(text: string): boolean {
  const lines = text.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    if (!INTERNAL_MARKDOWN_BLANK_LINE_COMMENT_PATTERN.test(lines[index] ?? '')) {
      continue;
    }

    if (INTERNAL_MARKDOWN_BLANK_LINE_COMMENT_PATTERN.test(lines[index + 1] ?? '')) {
      continue;
    }

    if ((lines[index + 1] ?? '').trim() === '') {
      continue;
    }

    const previousLine = lines[index - 1] ?? '';
    if (previousLine.trim() !== '') {
      continue;
    }

    if (isHtmlBlockBoundaryLine(findNearestPreviousNonBlankInputLine(lines, index - 1))) {
      return true;
    }
  }
  return false;
}

export function findNearestPreviousNonBlankInputLine(lines: readonly string[], startIndex: number): string | null {
  for (let index = startIndex; index >= 0; index -= 1) {
    const line = lines[index] ?? '';
    if (line.trim() !== '') return line;
  }
  return null;
}

export function collapseHtmlBoundaryBlankLinesCreatedByInternalComments(text: string): string {
  if (!text.includes('\n\n\n')) return text;

  const lines = text.split('\n');
  const output: string[] = [];
  for (const line of lines) {
    if (
      line.trim() === ''
      && output.length >= 2
      && output[output.length - 1]?.trim() === ''
      && isHtmlBlockBoundaryLine(findNearestPreviousNonBlankOutputLine(output))
    ) {
      continue;
    }
    output.push(line);
  }
  return output.join('\n');
}

export function findNearestPreviousNonBlankOutputLine(lines: readonly string[]): string | null {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index] ?? '';
    if (line.trim() !== '') return line;
  }
  return null;
}

export function isHtmlBlockBoundaryLine(line: string | null): boolean {
  return line !== null
    && (
      HTML_BLOCK_LINE_PATTERN.test(line)
      || /^<![A-Za-z][^>]*>\s*$/.test(line)
      || /^<\?.*\?>\s*$/.test(line)
      || /^<!\[CDATA\[[\s\S]*\]\]>\s*$/.test(line)
    );
}

export function isRenderedHtmlBlockBoundaryLine(line: string | null): boolean {
  if (line === null) return false;

  const match = HTML_ONE_LINE_RENDERED_BLOCK_PATTERN.exec(line)
    ?? HTML_ONE_LINE_RENDERED_VOID_BLOCK_PATTERN.exec(line);
  const closingTagName = HTML_CLOSING_RENDERED_BLOCK_PATTERN.exec(line)?.[1]?.toLowerCase();
  const tagName = match?.[1]?.toLowerCase() ?? closingTagName ?? getHtmlStartTagName(line);
  return Boolean(tagName && !NON_EDITABLE_HTML_BOUNDARY_TAG_NAMES.has(tagName));
}

export function getHtmlStartTagName(line: string): string | null {
  const match = /^(?: {0,3})<([A-Za-z][A-Za-z0-9-]*)(?:\s|>|\/>)/.exec(line);
  return match?.[1]?.toLowerCase() ?? null;
}

export function normalizeInternalMarkdownBlankLineCommentSegment(
  segment: string,
  startIndex = 0,
  allLines: readonly string[] = segment.split('\n'),
): string {
  const lines = segment.split('\n');
  const output: string[] = [];
  let previousWasInternalBlankLine = false;
  let activeHtmlComment = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (activeHtmlComment || isMultiLineHtmlCommentOpenLine(line)) {
      output.push(line);
      activeHtmlComment = shouldKeepHtmlCommentProtectionActive(activeHtmlComment, line);
      continue;
    }

    if (!INTERNAL_MARKDOWN_BLANK_LINE_COMMENT_PATTERN.test(line)) {
      output.push(line);
      if (line.trim() !== '') {
        previousWasInternalBlankLine = false;
      }
      continue;
    }

    if (
      output.length === 0
      && isDiscardableHtmlBoundaryInternalBlankLineComment(allLines, startIndex + index)
    ) {
      while (index + 1 < lines.length && (lines[index + 1] ?? '').trim() === '') {
        index += 1;
      }
      continue;
    }

    if (!previousWasInternalBlankLine && !hasStructuralBlankAfterImage(output)) {
      while (output.length > 0 && output[output.length - 1]?.trim() === '') {
        output.pop();
      }
    }

    output.push('');
    previousWasInternalBlankLine = true;

    while (index + 1 < lines.length && (lines[index + 1] ?? '').trim() === '') {
      index += 1;
    }
  }

  return output.join('\n');
}

export function isDiscardableHtmlBoundaryInternalBlankLineComment(
  lines: readonly string[],
  index: number,
): boolean {
  if ((lines[index - 1] ?? '').trim() !== '') return false;

  const previous = findNearestPreviousNonBlankInputLine(lines, index - 1);
  return isHtmlBlockBoundaryLine(previous)
    && !HTML_IMAGE_LINE_PATTERN.test(previous ?? '')
    && !isMarkdownImageOnlyLine(previous);
}

export function hasStructuralBlankAfterImage(lines: readonly string[]): boolean {
  if ((lines[lines.length - 1] ?? '').trim() !== '') return false;

  for (let index = lines.length - 2; index >= 0; index -= 1) {
    const line = lines[index] ?? '';
    if (line.trim() === '') continue;
    return HTML_IMAGE_LINE_PATTERN.test(line) || isMarkdownImageOnlyLine(line);
  }

  return false;
}

export function isMultiLineHtmlCommentOpenLine(line: string): boolean {
  return isHtmlCommentOpenLine(line) && !isHtmlCommentCloseLine(line);
}

export function isHtmlCommentOpenLine(line: string): boolean {
  return HTML_COMMENT_OPEN_PATTERN.test(getMarkdownBlockContent(line));
}

export function isHtmlCommentCloseLine(line: string): boolean {
  return HTML_COMMENT_CLOSE_PATTERN.test(getMarkdownBlockContent(line));
}

export function shouldKeepHtmlCommentProtectionActive(wasActive: boolean, line: string): boolean {
  if (wasActive && isInternalEditorCommentLine(line)) {
    return true;
  }
  return !isHtmlCommentCloseLine(line);
}

export function isInternalEditorCommentLine(line: string): boolean {
  return INTERNAL_MARKDOWN_BLANK_LINE_COMMENT_PATTERN.test(line)
    || RENDERED_HTML_BOUNDARY_BLANK_LINE_COMMENT_PATTERN.test(line)
    || INTERNAL_TIGHT_HEADING_COMMENT_PATTERN.test(line);
}
