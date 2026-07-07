import { mapMarkdownOutsideProtectedBlocks, mapMarkdownOutsideProtectedSegments, } from './markdownProtectedBlocks';
import {
  BR_ONLY_PATTERN, UTF8_BOM, MARKED_BR_ONLY_PATTERN, INTERNAL_MARKDOWN_BLANK_LINE_COMMENT_PATTERN, RENDERED_HTML_BOUNDARY_BLANK_LINE_COMMENT_PATTERN, INTERNAL_TIGHT_HEADING_COMMENT_PATTERN, HTML_COMMENT_OPEN_PATTERN, HTML_COMMENT_CLOSE_PATTERN, HTML_IMAGE_LINE_PATTERN, HTML_BLOCK_LINE_PATTERN, HTML_ONE_LINE_RENDERED_BLOCK_PATTERN, HTML_ONE_LINE_RENDERED_VOID_BLOCK_PATTERN, HTML_CLOSING_RENDERED_BLOCK_PATTERN, NON_EDITABLE_HTML_BOUNDARY_TAG_NAMES, MARKDOWN_ESCAPE_PATTERN, ESCAPED_LESS_THAN_PATTERN, REDUNDANT_PAIRED_MARKER_ESCAPES, LIST_GAP_SENTINEL, USER_BR_SENTINEL, LEAKED_USER_BR_SENTINEL_PATTERN, LEAKED_LIST_GAP_SENTINEL_WITH_NEWLINES_PATTERN, MARKDOWN_SPACE_ENTITY_PATTERN, LEADING_MARKDOWN_SPACE_ENTITY_RUN_PATTERN, MARKDOWN_SPACE_ENTITY_REPLACEMENT_PATTERN, BLOCKQUOTE_CONTAINER_PREFIX_PATTERN, LIST_CONTAINER_PREFIX_PATTERN, INVISIBLE_EMPTY_LINE_PLACEHOLDER_PATTERN, INVISIBLE_LIST_GAP_PLACEHOLDER_PATTERN, EDITABLE_LIST_GAP_PLACEHOLDER_PATTERN, USER_BR_SENTINEL_LINE_PATTERN, MARKED_EMPTY_MARKDOWN_LINE_PLACEHOLDER_PATTERN, MARKED_EMPTY_LINE_PATTERN, MARKED_EMPTY_LINE_TOKEN_PATTERN, MARKED_USER_BR_PATTERN, MARKED_BLOCKQUOTE_USER_BR_PATTERN, MARKED_BLOCKQUOTE_USER_BR_WITH_DEPTH_PATTERN, MARKED_BLOCKQUOTE_USER_BR_TOKEN_PATTERN, MARKED_USER_BR_TOKEN_PATTERN, MARKED_LIST_GAP_TOKEN_PATTERN, EMPTY_LIST_ITEM_PLACEHOLDER_PATTERN, EDITABLE_LIST_GAP_MARKER_PLACEHOLDER_PATTERN, SERIALIZED_EDITABLE_LIST_GAP_PLACEHOLDER_PATTERN, STANDALONE_BR_LINE_PATTERN, BLOCKQUOTE_STANDALONE_BR_LINE_PATTERN, INLINE_TERMINAL_LIST_BR_PATTERN, EMPTY_FOOTNOTE_DEFINITION_PLACEHOLDER_PATTERN, EMPTY_TABLE_CELL_PLACEHOLDER_PATTERN, EMPTY_ATX_HEADING_MARKER_PATTERN, LIST_ITEM_LINE_PATTERN, NESTED_LIST_ITEM_LINE_PATTERN, MISSING_ORDERED_LIST_SPACE_LINE_PATTERN, MISSING_UNORDERED_LIST_SPACE_LINE_PATTERN, UNICODE_BULLET_LIST_LINE_PATTERN, CHINESE_ORDERED_LIST_MARKER_PATTERN, MALFORMED_TASK_LIST_MARKER_PATTERN, FULLWIDTH_MARKDOWN_LINE_MARKER_PATTERN, FULLWIDTH_ORDERED_LIST_DIGIT_PATTERN, FULLWIDTH_TABLE_PIPE_PATTERN, TABLE_ROW_PATTERN, TABLE_DELIMITER_ROW_PATTERN, MISSING_BLOCKQUOTE_SPACE_PATTERN, CJK_ATX_HEADING_WITHOUT_SPACE_PATTERN, GENERIC_HTML_BLOCK_OPEN_LINE_PATTERN, RAW_HTML_BLOCK_OPEN_LINE_PATTERN, MAX_CACHED_MARKDOWN_NORMALIZATION_LENGTH, FAST_NORMALIZATION_MIN_LENGTH, ESCAPED_HIGHLIGHT_PATTERN, ESCAPED_URL_SCHEME_PATTERN, MARKDOWN_AUTOLINK_LITERAL_PATTERN, MAILTO_EMAIL_MARKDOWN_LINK_PATTERN, FAST_NORMALIZATION_STRUCTURAL_LINE_PATTERN, ALTERNATIVE_MATH_BLOCK_OPEN_PATTERN, ALTERNATIVE_MATH_BLOCK_STANDARD_CLOSE_PATTERN, ALTERNATIVE_MATH_BLOCK_BRACKET_CLOSE_PATTERN, ALTERNATIVE_MATH_BLOCK_STANDARD_CLOSE_SUFFIX_PATTERN, ALTERNATIVE_MATH_BLOCK_BRACKET_CLOSE_SUFFIX_PATTERN, DOLLAR_MATH_BLOCK_FENCE_PATTERN, LATEX_LIKE_MATH_CONTENT_PATTERN, GENERIC_HTML_BLOCK_TAGS, MathBlockFenceStyle, MathBlockFenceReference, MathBlockFenceReferenceIndex, DollarMathFenceMatch, MarkdownFenceLine, GenericHtmlSpacingFenceState } from './markdownSerializationShared';
import { containsAsciiCaseInsensitive } from './markdownSerializationAscii';

export function stripLeadingBom(text: string): string {
  return text.startsWith(UTF8_BOM) ? text.slice(1) : text;
}

export function canUseLargePlainMarkdownNormalizationFastPath(text: string): boolean {
  if (text.length < FAST_NORMALIZATION_MIN_LENGTH) return false;
  if (
    text.includes('\r') ||
    text.includes('\\') ||
    text.includes('<') ||
    text.includes('\u200B') ||
    text.includes('\u200C') ||
    text.includes('\u2800') ||
    text.includes('\u0000VLAINA_') ||
    text.includes('VLAINA_') ||
    text.includes('vlaina-') ||
    text.includes('｜') ||
    text.includes('＞') ||
    text.includes('＃') ||
    text.includes('－') ||
    text.includes('＊') ||
    text.includes('＋') ||
    text.includes('、') ||
    text.includes('．') ||
    text.includes('（') ||
    text.includes('）') ||
    text.includes('［') ||
    text.includes('］') ||
    text.includes('【') ||
    text.includes('】') ||
    text.includes('•') ||
    text.includes('‣') ||
    text.includes('◦') ||
    text.includes('ｘ') ||
    text.includes('Ｘ') ||
    text.includes('✓') ||
    text.includes('✔') ||
    text.includes('√') ||
    containsAsciiCaseInsensitive(text, '](mailto:') ||
    MARKDOWN_SPACE_ENTITY_PATTERN.test(text)
  ) {
    return false;
  }

  let lineStart = 0;
  let previousLineWasPlainText = false;
  for (let index = 0; index <= text.length; index += 1) {
    if (index < text.length && text[index] !== '\n') {
      continue;
    }

    const line = text.slice(lineStart, index);
    const trimmed = line.trim();
    lineStart = index + 1;

    if (trimmed.length === 0) {
      previousLineWasPlainText = false;
      continue;
    }

    if (FAST_NORMALIZATION_STRUCTURAL_LINE_PATTERN.test(line)) {
      return false;
    }

    if (previousLineWasPlainText) {
      return false;
    }
    previousLineWasPlainText = true;
  }

  return true;
}

export function unescapeMarkdownPunctuation(text: string): string {
  if (!text.includes('\\')) return text;

  return mapMarkdownOutsideProtectedBlocks(text, (line) => line.replace(MARKDOWN_ESCAPE_PATTERN, '$1'));
}

export function normalizeRedundantMarkdownEscapes(text: string): string {
  if (!text.includes('\\')) return text;

  return mapMarkdownOutsideProtectedSegments(text, (segment) =>
    normalizeRedundantMarkdownEscapesInSegment(segment)
  );
}

export function normalizeRedundantMarkdownEscapesInSegment(segment: string): string {
  let output = '';
  for (let index = 0; index < segment.length; index += 1) {
    const char = segment[index];
    const escaped = segment[index + 1];
    if (char === '\\' && escaped && isRedundantMarkdownEscape(segment, index, escaped)) {
      output += escaped;
      index += 1;
      continue;
    }
    output += char;
  }
  return output;
}

export function isRedundantMarkdownEscape(segment: string, slashIndex: number, escaped: string): boolean {
  if (escaped === '_') {
    return isRedundantUnderscoreEscape(segment, slashIndex);
  }
  if (escaped === '[') {
    if (isEscapedAbbreviationDefinitionBracket(segment, slashIndex)) return false;
    return isRedundantOpeningBracketEscape(segment, slashIndex);
  }
  if (escaped === '#') {
    return isRedundantHeadingMarkerEscape(segment, slashIndex);
  }
  if (escaped === '`') {
    return countMarkerInSegment(segment, escaped) === 1;
  }
  if (escaped === '*' && isEscapedAbbreviationDefinitionMarker(segment, slashIndex)) {
    return false;
  }
  if (REDUNDANT_PAIRED_MARKER_ESCAPES.has(escaped)) {
    return isSingleMarkerInCurrentTextToken(segment, slashIndex, escaped);
  }
  return false;
}

export function isRedundantUnderscoreEscape(segment: string, slashIndex: number): boolean {
  const previous = segment[slashIndex - 1];
  const next = segment[slashIndex + 2];
  return isNonWhitespace(previous)
    && isNonWhitespace(next)
    && (isUnicodeLetterOrNumber(previous) || isUnicodeLetterOrNumber(next));
}

export function isRedundantOpeningBracketEscape(segment: string, slashIndex: number): boolean {
  return isNonWhitespace(segment[slashIndex - 1]);
}

export function isEscapedAbbreviationDefinitionMarker(segment: string, slashIndex: number): boolean {
  const { line, offset } = getLineAtIndex(segment, slashIndex);
  return /^[ \t]*$/.test(line.slice(0, offset))
    && /^\\\*\\?\[[^\]\n]+]:(?=\s|$)/.test(line.slice(offset));
}

export function isEscapedAbbreviationDefinitionBracket(segment: string, slashIndex: number): boolean {
  const { line, offset } = getLineAtIndex(segment, slashIndex);
  return /^[ \t]*\\\*$/.test(line.slice(0, offset))
    && /^\\\[[^\]\n]+]:(?=\s|$)/.test(line.slice(offset));
}

export function isRedundantHeadingMarkerEscape(segment: string, slashIndex: number): boolean {
  const lineStart = segment.lastIndexOf('\n', slashIndex - 1) + 1;
  if (segment.slice(lineStart, slashIndex).trim().length > 0) return false;

  let markerEnd = slashIndex + 1;
  while (segment[markerEnd] === '#') {
    markerEnd += 1;
  }
  const afterMarker = segment[markerEnd];
  return Boolean(afterMarker && afterMarker !== ' ' && afterMarker !== '\t' && afterMarker !== '\n');
}

export function isSingleMarkerInCurrentTextToken(
  segment: string,
  slashIndex: number,
  marker: string
): boolean {
  const { start, end } = getNonWhitespaceTokenBounds(segment, slashIndex);
  return countMarkerInRange(segment, marker, start, end) === 1;
}

export function countMarkerInSegment(segment: string, marker: string): number {
  return countMarkerInRange(segment, marker, 0, segment.length);
}

export function countMarkerInRange(
  segment: string,
  marker: string,
  start: number,
  end: number
): number {
  let markerCount = 0;

  for (let index = start; index < end; index += 1) {
    if (segment[index] === '\\' && segment[index + 1] === marker) {
      markerCount += 1;
      index += 1;
      continue;
    }
    if (segment[index] === marker) {
      markerCount += 1;
    }
  }

  return markerCount;
}

export function getNonWhitespaceTokenBounds(segment: string, index: number): { start: number; end: number } {
  let start = index;
  while (start > 0 && isNonWhitespace(segment[start - 1])) {
    start -= 1;
  }

  let end = index;
  while (end < segment.length && isNonWhitespace(segment[end])) {
    end += 1;
  }

  return { start, end };
}

export function getLineAtIndex(segment: string, index: number): { line: string; offset: number } {
  const lineStart = segment.lastIndexOf('\n', index - 1) + 1;
  const nextLineBreak = segment.indexOf('\n', index);
  const lineEnd = nextLineBreak === -1 ? segment.length : nextLineBreak;
  return {
    line: segment.slice(lineStart, lineEnd),
    offset: index - lineStart,
  };
}

export function isNonWhitespace(value: string | undefined): value is string {
  return value !== undefined && !/\s/u.test(value);
}

export function isUnicodeLetterOrNumber(value: string | undefined): boolean {
  return value !== undefined && /[\p{L}\p{N}]/u.test(value);
}

export function normalizeEscapedAngleBracketText(text: string): string {
  if (!text.includes('\\<')) return text;

  return mapMarkdownOutsideProtectedSegments(text, (segment) =>
    segment.replace(ESCAPED_LESS_THAN_PATTERN, '$1<')
  );
}

export function normalizeEscapedUrlSchemes(text: string): string {
  if (!text.includes('\\:')) return text;

  return mapMarkdownOutsideProtectedSegments(text, (segment) =>
    segment.replace(ESCAPED_URL_SCHEME_PATTERN, '$1:')
  );
}

export function normalizeMarkdownAutolinkLiterals(text: string): string {
  if (!text.includes('<') || !text.includes('>')) return text;

  return mapMarkdownOutsideProtectedSegments(text, (segment) =>
    segment.replace(MARKDOWN_AUTOLINK_LITERAL_PATTERN, '$1')
  );
}
