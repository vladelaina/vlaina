import { mapMarkdownOutsideProtectedBlocks, mapMarkdownOutsideProtectedSegments, } from './markdownProtectedBlocks';
import { getMarkdownBlockContent } from '@/lib/markdown/markdownHtmlBlockClassification';
import {
  BR_ONLY_PATTERN, UTF8_BOM, MARKED_BR_ONLY_PATTERN, INTERNAL_MARKDOWN_BLANK_LINE_COMMENT_PATTERN, RENDERED_HTML_BOUNDARY_BLANK_LINE_COMMENT_PATTERN, INTERNAL_TIGHT_HEADING_COMMENT_PATTERN, HTML_COMMENT_OPEN_PATTERN, HTML_COMMENT_CLOSE_PATTERN, HTML_IMAGE_LINE_PATTERN, HTML_BLOCK_LINE_PATTERN, HTML_ONE_LINE_RENDERED_BLOCK_PATTERN, HTML_ONE_LINE_RENDERED_VOID_BLOCK_PATTERN, HTML_CLOSING_RENDERED_BLOCK_PATTERN, NON_EDITABLE_HTML_BOUNDARY_TAG_NAMES, MARKDOWN_ESCAPE_PATTERN, ESCAPED_LESS_THAN_PATTERN, REDUNDANT_PAIRED_MARKER_ESCAPES, LIST_GAP_SENTINEL, USER_BR_SENTINEL, LEAKED_USER_BR_SENTINEL_PATTERN, LEAKED_LIST_GAP_SENTINEL_WITH_NEWLINES_PATTERN, MARKDOWN_SPACE_ENTITY_PATTERN, LEADING_MARKDOWN_SPACE_ENTITY_RUN_PATTERN, MARKDOWN_SPACE_ENTITY_REPLACEMENT_PATTERN, BLOCKQUOTE_CONTAINER_PREFIX_PATTERN, LIST_CONTAINER_PREFIX_PATTERN, INVISIBLE_EMPTY_LINE_PLACEHOLDER_PATTERN, INVISIBLE_LIST_GAP_PLACEHOLDER_PATTERN, EDITABLE_LIST_GAP_PLACEHOLDER_PATTERN, USER_BR_SENTINEL_LINE_PATTERN, MARKED_EMPTY_MARKDOWN_LINE_PLACEHOLDER_PATTERN, MARKED_EMPTY_LINE_PATTERN, MARKED_EMPTY_LINE_TOKEN_PATTERN, MARKED_USER_BR_PATTERN, MARKED_BLOCKQUOTE_USER_BR_PATTERN, MARKED_BLOCKQUOTE_USER_BR_WITH_DEPTH_PATTERN, MARKED_BLOCKQUOTE_USER_BR_TOKEN_PATTERN, MARKED_USER_BR_TOKEN_PATTERN, MARKED_LIST_GAP_TOKEN_PATTERN, EMPTY_LIST_ITEM_PLACEHOLDER_PATTERN, EDITABLE_LIST_GAP_MARKER_PLACEHOLDER_PATTERN, SERIALIZED_EDITABLE_LIST_GAP_PLACEHOLDER_PATTERN, STANDALONE_BR_LINE_PATTERN, BLOCKQUOTE_STANDALONE_BR_LINE_PATTERN, INLINE_TERMINAL_LIST_BR_PATTERN, EMPTY_FOOTNOTE_DEFINITION_PLACEHOLDER_PATTERN, EMPTY_TABLE_CELL_PLACEHOLDER_PATTERN, EMPTY_ATX_HEADING_MARKER_PATTERN, LIST_ITEM_LINE_PATTERN, NESTED_LIST_ITEM_LINE_PATTERN, MISSING_ORDERED_LIST_SPACE_LINE_PATTERN, MISSING_UNORDERED_LIST_SPACE_LINE_PATTERN, UNICODE_BULLET_LIST_LINE_PATTERN, CHINESE_ORDERED_LIST_MARKER_PATTERN, MALFORMED_TASK_LIST_MARKER_PATTERN, FULLWIDTH_MARKDOWN_LINE_MARKER_PATTERN, FULLWIDTH_ORDERED_LIST_DIGIT_PATTERN, FULLWIDTH_TABLE_PIPE_PATTERN, TABLE_ROW_PATTERN, TABLE_DELIMITER_ROW_PATTERN, MISSING_BLOCKQUOTE_SPACE_PATTERN, CJK_ATX_HEADING_WITHOUT_SPACE_PATTERN, GENERIC_HTML_BLOCK_OPEN_LINE_PATTERN, RAW_HTML_BLOCK_OPEN_LINE_PATTERN, MAX_CACHED_MARKDOWN_NORMALIZATION_LENGTH, FAST_NORMALIZATION_MIN_LENGTH, ESCAPED_HIGHLIGHT_PATTERN, ESCAPED_URL_SCHEME_PATTERN, MARKDOWN_AUTOLINK_LITERAL_PATTERN, MAILTO_EMAIL_MARKDOWN_LINK_PATTERN, FAST_NORMALIZATION_STRUCTURAL_LINE_PATTERN, ALTERNATIVE_MATH_BLOCK_OPEN_PATTERN, ALTERNATIVE_MATH_BLOCK_STANDARD_CLOSE_PATTERN, ALTERNATIVE_MATH_BLOCK_BRACKET_CLOSE_PATTERN, ALTERNATIVE_MATH_BLOCK_STANDARD_CLOSE_SUFFIX_PATTERN, ALTERNATIVE_MATH_BLOCK_BRACKET_CLOSE_SUFFIX_PATTERN, DOLLAR_MATH_BLOCK_FENCE_PATTERN, LATEX_LIKE_MATH_CONTENT_PATTERN, GENERIC_HTML_BLOCK_TAGS, MathBlockFenceStyle, MathBlockFenceReference, MathBlockFenceReferenceIndex, DollarMathFenceMatch, MarkdownFenceLine, GenericHtmlSpacingFenceState } from './markdownSerializationShared';

export function normalizeGenericHtmlBlockClosingSpacing(text: string): string {
  if (!text.includes('</')) return text;

  return mapMarkdownOutsideProtectedSegments(
    text,
    (segment) => normalizeGenericHtmlBlockClosingSpacingSegment(segment),
    { protectHtmlBlocks: false },
  );
}

export function normalizeGenericHtmlBlockClosingSpacingSegment(text: string): string {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const output: string[] = [];
  let activeFence: GenericHtmlSpacingFenceState | null = null;
  let activeGenericTagName: string | null = null;
  let activeRawTagName: string | null = null;

  for (const line of lines) {
    const content = getMarkdownBlockContent(line);

    if (activeFence) {
      output.push(line);
      if (isGenericHtmlSpacingFenceClose(content, activeFence)) {
        activeFence = null;
      }
      continue;
    }

    if (activeRawTagName) {
      output.push(line);
      if (new RegExp(`</${activeRawTagName}(?:\\s[^>]*)?>`, 'i').test(content)) {
        activeRawTagName = null;
      }
      continue;
    }

    if (activeGenericTagName) {
      const closePattern = new RegExp(`^(?: {0,3})<\\/${activeGenericTagName}\\s*>\\s*$`, 'i');
      const isCloseLine = closePattern.test(content);
      if (isCloseLine && output[output.length - 1] === '') {
        output.pop();
      }
      output.push(line);
      if (isCloseLine) {
        activeGenericTagName = null;
      }
      continue;
    }

    output.push(line);

    activeFence = getGenericHtmlSpacingFenceOpen(content);
    if (activeFence) {
      continue;
    }

    const rawTagName = RAW_HTML_BLOCK_OPEN_LINE_PATTERN.exec(content)?.[1]?.toLowerCase();
    if (rawTagName && !new RegExp(`</${rawTagName}(?:\\s[^>]*)?>`, 'i').test(content)) {
      activeRawTagName = rawTagName;
      continue;
    }

    const openTagName = GENERIC_HTML_BLOCK_OPEN_LINE_PATTERN.exec(content)?.[1]?.toLowerCase();
    if (
      openTagName &&
      GENERIC_HTML_BLOCK_TAGS.has(openTagName) &&
      !/\/>\s*$/.test(content)
    ) {
      activeGenericTagName = openTagName;
    }
  }

  return output.join('\n');
}

export function getGenericHtmlSpacingFenceOpen(content: string): GenericHtmlSpacingFenceState | null {
  const fence = parseGenericHtmlSpacingFenceLine(content);
  if (!fence) return null;
  if (fence.marker === '`' && content.indexOf('`', fence.infoStart) !== -1) return null;
  return { marker: fence.marker, length: fence.length };
}

export function isGenericHtmlSpacingFenceClose(
  content: string,
  activeFence: GenericHtmlSpacingFenceState,
): boolean {
  const fence = parseGenericHtmlSpacingFenceLine(content);
  return Boolean(
    fence &&
    fence.marker === activeFence.marker &&
    fence.length >= activeFence.length &&
    content.slice(fence.infoStart).trim() === ''
  );
}

export function parseGenericHtmlSpacingFenceLine(content: string): MarkdownFenceLine | null {
  let index = 0;
  while (index < content.length && index <= 3 && content[index] === ' ') {
    index += 1;
  }
  if (index > 3) return null;

  const marker = content[index];
  if (marker !== '`' && marker !== '~') return null;

  let length = 0;
  while (content[index + length] === marker) {
    length += 1;
  }
  if (length < 3) return null;

  return {
    infoStart: index + length,
    length,
    marker,
  };
}
