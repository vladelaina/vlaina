import { mapMarkdownOutsideProtectedBlocks, mapMarkdownOutsideProtectedSegments, } from './markdownProtectedBlocks';
import {
  collapseSyntheticBlankLinesAroundEmptyPlaceholders, collapseSyntheticBlankLinesBetweenAdjacentHeadings, } from './markdownHeadingSpacing';
import {
  normalizeCanonicalMarkdownSpacingForPersistence, normalizeInlineHtmlTextForPersistence, } from './markdownCanonicalSpacing';
import {
  BR_ONLY_PATTERN, UTF8_BOM, MARKED_BR_ONLY_PATTERN, INTERNAL_MARKDOWN_BLANK_LINE_COMMENT_PATTERN, RENDERED_HTML_BOUNDARY_BLANK_LINE_COMMENT_PATTERN, INTERNAL_TIGHT_HEADING_COMMENT_PATTERN, HTML_COMMENT_OPEN_PATTERN, HTML_COMMENT_CLOSE_PATTERN, HTML_IMAGE_LINE_PATTERN, HTML_BLOCK_LINE_PATTERN, HTML_ONE_LINE_RENDERED_BLOCK_PATTERN, HTML_ONE_LINE_RENDERED_VOID_BLOCK_PATTERN, HTML_CLOSING_RENDERED_BLOCK_PATTERN, NON_EDITABLE_HTML_BOUNDARY_TAG_NAMES, MARKDOWN_ESCAPE_PATTERN, ESCAPED_LESS_THAN_PATTERN, REDUNDANT_PAIRED_MARKER_ESCAPES, LIST_GAP_SENTINEL, USER_BR_SENTINEL, LEAKED_USER_BR_SENTINEL_PATTERN, LEAKED_LIST_GAP_SENTINEL_WITH_NEWLINES_PATTERN, MARKDOWN_SPACE_ENTITY_PATTERN, LEADING_MARKDOWN_SPACE_ENTITY_RUN_PATTERN, MARKDOWN_SPACE_ENTITY_REPLACEMENT_PATTERN, BLOCKQUOTE_CONTAINER_PREFIX_PATTERN, LIST_CONTAINER_PREFIX_PATTERN, INVISIBLE_EMPTY_LINE_PLACEHOLDER_PATTERN, INVISIBLE_LIST_GAP_PLACEHOLDER_PATTERN, EDITABLE_LIST_GAP_PLACEHOLDER_PATTERN, USER_BR_SENTINEL_LINE_PATTERN, MARKED_EMPTY_MARKDOWN_LINE_PLACEHOLDER_PATTERN, MARKED_EMPTY_LINE_PATTERN, MARKED_EMPTY_LINE_TOKEN_PATTERN, MARKED_USER_BR_PATTERN, MARKED_BLOCKQUOTE_USER_BR_PATTERN, MARKED_BLOCKQUOTE_USER_BR_WITH_DEPTH_PATTERN, MARKED_BLOCKQUOTE_USER_BR_TOKEN_PATTERN, MARKED_USER_BR_TOKEN_PATTERN, MARKED_LIST_GAP_TOKEN_PATTERN, EMPTY_LIST_ITEM_PLACEHOLDER_PATTERN, EDITABLE_LIST_GAP_MARKER_PLACEHOLDER_PATTERN, SERIALIZED_EDITABLE_LIST_GAP_PLACEHOLDER_PATTERN, STANDALONE_BR_LINE_PATTERN, BLOCKQUOTE_STANDALONE_BR_LINE_PATTERN, INLINE_TERMINAL_LIST_BR_PATTERN, EMPTY_FOOTNOTE_DEFINITION_PLACEHOLDER_PATTERN, EMPTY_TABLE_CELL_PLACEHOLDER_PATTERN, EMPTY_ATX_HEADING_MARKER_PATTERN, LIST_ITEM_LINE_PATTERN, NESTED_LIST_ITEM_LINE_PATTERN, MISSING_ORDERED_LIST_SPACE_LINE_PATTERN, MISSING_UNORDERED_LIST_SPACE_LINE_PATTERN, UNICODE_BULLET_LIST_LINE_PATTERN, CHINESE_ORDERED_LIST_MARKER_PATTERN, MALFORMED_TASK_LIST_MARKER_PATTERN, FULLWIDTH_MARKDOWN_LINE_MARKER_PATTERN, FULLWIDTH_ORDERED_LIST_DIGIT_PATTERN, FULLWIDTH_TABLE_PIPE_PATTERN, TABLE_ROW_PATTERN, TABLE_DELIMITER_ROW_PATTERN, MISSING_BLOCKQUOTE_SPACE_PATTERN, CJK_ATX_HEADING_WITHOUT_SPACE_PATTERN, GENERIC_HTML_BLOCK_OPEN_LINE_PATTERN, RAW_HTML_BLOCK_OPEN_LINE_PATTERN, MAX_CACHED_MARKDOWN_NORMALIZATION_LENGTH, FAST_NORMALIZATION_MIN_LENGTH, ESCAPED_HIGHLIGHT_PATTERN, ESCAPED_URL_SCHEME_PATTERN, MARKDOWN_AUTOLINK_LITERAL_PATTERN, MAILTO_EMAIL_MARKDOWN_LINK_PATTERN, FAST_NORMALIZATION_STRUCTURAL_LINE_PATTERN, ALTERNATIVE_MATH_BLOCK_OPEN_PATTERN, ALTERNATIVE_MATH_BLOCK_STANDARD_CLOSE_PATTERN, ALTERNATIVE_MATH_BLOCK_BRACKET_CLOSE_PATTERN, ALTERNATIVE_MATH_BLOCK_STANDARD_CLOSE_SUFFIX_PATTERN, ALTERNATIVE_MATH_BLOCK_BRACKET_CLOSE_SUFFIX_PATTERN, DOLLAR_MATH_BLOCK_FENCE_PATTERN, LATEX_LIKE_MATH_CONTENT_PATTERN, GENERIC_HTML_BLOCK_TAGS, MathBlockFenceStyle, MathBlockFenceReference, MathBlockFenceReferenceIndex, DollarMathFenceMatch, MarkdownFenceLine, GenericHtmlSpacingFenceState } from './markdownSerializationShared';
import {
  canUseLargePlainMarkdownNormalizationFastPath,
  normalizeEscapedAngleBracketText,
  normalizeEscapedUrlSchemes,
  normalizeMarkdownAutolinkLiterals,
  normalizeRedundantMarkdownEscapes,
  stripLeadingBom,
  unescapeMarkdownPunctuation,
} from './markdownSerializationEscapes';
import { normalizeMailtoEmailMarkdownLinks } from './markdownSerializationLinks';
import { normalizeGenericHtmlBlockClosingSpacing } from './markdownSerializationHtmlSpacing';
import { normalizeMissingOrderedListMarkerSpaces } from './markdownSerializationListMarkers';
import {
  normalizeEditorBreakPlaceholders,
  normalizeEditorEmptyParagraphBreaks,
  normalizeEmptyAtxHeadingMarkers,
  normalizeEscapedHighlightSyntax,
  normalizeStandaloneBreakHtmlToMarkdown,
  normalizeTableCellBreakPlaceholders,
} from './markdownSerializationEditorBreaks';
import { normalizeInternalMarkdownBlankLineComments } from './markdownSerializationInternalBlankComments';
import { normalizeInternalTightHeadingComments } from './markdownSerializationInternalTightComments';
import {
  normalizeInternalClipboardArtifacts,
  normalizeLeakedInternalArtifacts,
  normalizeListItemBlankLines,
  normalizeUserBreakSentinels,
} from './markdownSerializationSentinels';

let lastNormalizedMarkdownInput: string | null = null;
let lastNormalizedMarkdownOutput: string | null = null;

export function normalizeUrlSerializationArtifacts(text: string): string {
  return normalizeMailtoEmailMarkdownLinks(
    normalizeMarkdownAutolinkLiterals(normalizeEscapedUrlSchemes(text))
  );
}

export function normalizeMarkdownSpaceEntityArtifacts(text: string): string {
  if (!MARKDOWN_SPACE_ENTITY_PATTERN.test(text)) return text;

  return mapMarkdownOutsideProtectedSegments(text, (segment) =>
    segment.split('\n').map(normalizeMarkdownSpaceEntityLine).join('\n')
  );
}

export function normalizeMarkdownSpaceEntityLine(line: string): string {
  const contentStart = getMarkdownContainerContentStart(line);
  const leadingContent = line.slice(contentStart);
  const match = LEADING_MARKDOWN_SPACE_ENTITY_RUN_PATTERN.exec(leadingContent);
  if (!match) return line;

  return `${line.slice(0, contentStart)}${leadingContent.replace(
    LEADING_MARKDOWN_SPACE_ENTITY_RUN_PATTERN,
    (prefix) => prefix.replace(MARKDOWN_SPACE_ENTITY_REPLACEMENT_PATTERN, ' ')
  )}`;
}

export function getMarkdownContainerContentStart(line: string): number {
  let cursor = 0;

  while (cursor < line.length) {
    const blockquoteMatch = BLOCKQUOTE_CONTAINER_PREFIX_PATTERN.exec(line.slice(cursor));
    if (!blockquoteMatch) break;
    cursor += blockquoteMatch[0].length;
  }

  const listMatch = LIST_CONTAINER_PREFIX_PATTERN.exec(line.slice(cursor));
  if (listMatch) {
    cursor += listMatch[0].length;
  }

  return cursor;
}

export function stripEmptyMarkdownPlaceholders(text: string): string {
  return mapMarkdownOutsideProtectedBlocks(
    normalizeEditorBreakPlaceholders(text),
    (line) => line
      .replace(MARKED_EMPTY_MARKDOWN_LINE_PLACEHOLDER_PATTERN, (_match, prefix: string) =>
        prefix.trimEnd()
      )
      .replace(EMPTY_LIST_ITEM_PLACEHOLDER_PATTERN, (_match, prefix: string) =>
        prefix.trimEnd()
      )
      .replace(EMPTY_FOOTNOTE_DEFINITION_PLACEHOLDER_PATTERN, (_match, prefix: string) =>
        prefix.trimEnd()
      )
      .replace(EMPTY_TABLE_CELL_PLACEHOLDER_PATTERN, '$1 $2')
  );
}

export function stripTrailingNewlines(text: string): string {
  return text.replace(/\n+$/, '');
}

export function normalizeSerializedMarkdownBlock(text: string): string {
  const normalizedPlaceholders = normalizeInternalClipboardArtifacts(text);
  const withoutTrailingNewlines = stripTrailingNewlines(
    normalizeUserBreakSentinels(stripEmptyMarkdownPlaceholders(normalizedPlaceholders))
  );
  if (BR_ONLY_PATTERN.test(withoutTrailingNewlines.trim())) return '';
  return normalizeUrlSerializationArtifacts(
    normalizeEscapedHighlightSyntax(normalizeEscapedAngleBracketText(
      unescapeMarkdownPunctuation(withoutTrailingNewlines)
    ))
  );
}

export function normalizeSerializedMarkdownDocument(text: string): string {
  if (text === lastNormalizedMarkdownInput && lastNormalizedMarkdownOutput !== null) {
    return lastNormalizedMarkdownOutput;
  }

  const source = stripLeadingBom(text);

  if (canUseLargePlainMarkdownNormalizationFastPath(source)) {
    return source;
  }

  const output = runMarkdownDocumentNormalizationPipeline(source).output;
  if (text.length <= MAX_CACHED_MARKDOWN_NORMALIZATION_LENGTH) {
    lastNormalizedMarkdownInput = text;
    lastNormalizedMarkdownOutput = output;
  } else {
    lastNormalizedMarkdownInput = null;
    lastNormalizedMarkdownOutput = null;
  }
  return output;
}

export function normalizeEditorStateMarkdownDocument(text: string): string {
  return normalizeEditorRuntimeMarkdownArtifactsForState(text);
}

export function normalizeEditorRuntimeMarkdownArtifacts(text: string): string {
  const afterInternalTightHeadingComments = normalizeInternalTightHeadingComments(text);
  const afterInternalMarkdownBlankLineComments =
    normalizeInternalMarkdownBlankLineComments(afterInternalTightHeadingComments);
  const afterStripPlaceholders = stripEmptyMarkdownPlaceholders(afterInternalMarkdownBlankLineComments);
  const afterEmptyParagraphBreaks = normalizeEditorEmptyParagraphBreaks(afterStripPlaceholders);
  const afterUserBreaks = normalizeUserBreakSentinels(afterEmptyParagraphBreaks);
  const afterListItems = normalizeListItemBlankLines(afterUserBreaks);
  const afterLeakedInternalArtifacts = normalizeUserBreakSentinels(
    normalizeLeakedInternalArtifacts(afterListItems)
  );
  const afterEmptyAtxHeadings = normalizeEmptyAtxHeadingMarkers(afterLeakedInternalArtifacts);
  const afterTableCellBreaks = normalizeTableCellBreakPlaceholders(afterEmptyAtxHeadings);
  const afterStandaloneBreakHtml = normalizeStandaloneBreakHtmlToMarkdown(afterTableCellBreaks);
  const afterMarkdownSpaceEntities = normalizeMarkdownSpaceEntityArtifacts(afterStandaloneBreakHtml);
  const afterEscapedAngleBracketText = normalizeEscapedAngleBracketText(afterMarkdownSpaceEntities);
  return normalizeRedundantMarkdownEscapes(afterEscapedAngleBracketText);
}

export function normalizeEditorRuntimeMarkdownArtifactsForState(text: string): string {
  const source = stripLeadingBom(text).replace(/\r\n?/g, '\n');
  const afterInternalTightHeadingComments = normalizeInternalTightHeadingComments(source);
  const afterInternalMarkdownBlankLineComments =
    normalizeInternalMarkdownBlankLineComments(afterInternalTightHeadingComments);
  const afterStripPlaceholders = stripEmptyMarkdownPlaceholders(afterInternalMarkdownBlankLineComments);
  const afterEmptyParagraphBreaks = normalizeEditorEmptyParagraphBreaks(afterStripPlaceholders);
  const afterUserBreaks = normalizeUserBreakSentinels(afterEmptyParagraphBreaks);
  const afterListItems = normalizeListItemBlankLines(afterUserBreaks);
  const afterLeakedInternalArtifacts = normalizeUserBreakSentinels(
    normalizeLeakedInternalArtifacts(afterListItems)
  );
  const afterEmptyAtxHeadings = normalizeEmptyAtxHeadingMarkers(afterLeakedInternalArtifacts);
  const afterTableCellBreaks = normalizeTableCellBreakPlaceholders(afterEmptyAtxHeadings);
  const afterStandaloneBreakHtml = normalizeStandaloneBreakHtmlToMarkdown(afterTableCellBreaks);
  const afterInlineHtmlText = normalizeInlineHtmlTextForPersistence(afterStandaloneBreakHtml);
  const afterMarkdownSpaceEntities = normalizeMarkdownSpaceEntityArtifacts(afterInlineHtmlText);
  const afterEscapedAngleBracketText = normalizeEscapedAngleBracketText(afterMarkdownSpaceEntities);
  const afterRedundantMarkdownEscapes = normalizeRedundantMarkdownEscapes(afterEscapedAngleBracketText);

  return normalizeUrlSerializationArtifacts(afterRedundantMarkdownEscapes);
}

export function summarizeMarkdownNormalizationPipeline(text: string) {
  const pipeline = runMarkdownDocumentNormalizationPipeline(text);
  return Object.fromEntries(
    Object.entries(pipeline).map(([key, value]) => [
      key,
      {
        length: value.length,
        lines: value.length === 0 ? 0 : value.split('\n').length,
        preview: value.replace(/\r/g, '\\r').replace(/\n/g, '\\n').slice(0, 500),
      },
    ])
  );
}

export function runMarkdownDocumentNormalizationPipeline(text: string) {
  const afterInternalTightHeadingComments = normalizeInternalTightHeadingComments(text);
  const afterHeadingSpacing = collapseSyntheticBlankLinesBetweenAdjacentHeadings(afterInternalTightHeadingComments);
  const afterInternalMarkdownBlankLineComments =
    normalizeInternalMarkdownBlankLineComments(afterHeadingSpacing);
  const afterSyntheticBlankLines =
    collapseSyntheticBlankLinesAroundEmptyPlaceholders(afterInternalMarkdownBlankLineComments);
  const afterEscapedAngleBracketText = normalizeEscapedAngleBracketText(afterSyntheticBlankLines);
  const afterCanonicalSpacing = normalizeCanonicalMarkdownSpacingForPersistence(afterEscapedAngleBracketText);
  const afterGenericHtmlBlockClosingSpacing = normalizeGenericHtmlBlockClosingSpacing(afterCanonicalSpacing);
  const afterStripPlaceholders = stripEmptyMarkdownPlaceholders(afterGenericHtmlBlockClosingSpacing);
  const afterEmptyParagraphBreaks = normalizeEditorEmptyParagraphBreaks(afterStripPlaceholders);
  const afterUserBreaks = normalizeUserBreakSentinels(afterEmptyParagraphBreaks);
  const afterListItems = normalizeListItemBlankLines(afterUserBreaks);
  const afterLeakedInternalArtifacts = normalizeUserBreakSentinels(
    normalizeLeakedInternalArtifacts(afterListItems)
  );
  const afterEmptyAtxHeadings = normalizeEmptyAtxHeadingMarkers(afterLeakedInternalArtifacts);
  const afterEscapedHighlight = afterEmptyAtxHeadings;
  const afterAbbreviationDefinitions = afterEscapedHighlight;
  const afterTableCellBreaks = normalizeTableCellBreakPlaceholders(afterAbbreviationDefinitions);
  const afterStandaloneBreakHtml = normalizeStandaloneBreakHtmlToMarkdown(afterTableCellBreaks);
  const afterMarkdownSpaceEntities = normalizeMarkdownSpaceEntityArtifacts(afterStandaloneBreakHtml);
  const afterRedundantMarkdownEscapes = normalizeRedundantMarkdownEscapes(afterMarkdownSpaceEntities);
  const afterMissingOrderedListMarkerSpaces =
    normalizeMissingOrderedListMarkerSpaces(afterRedundantMarkdownEscapes);
  const output = normalizeUrlSerializationArtifacts(afterMissingOrderedListMarkerSpaces);

  return {
    input: text,
    afterInternalTightHeadingComments,
    afterHeadingSpacing,
    afterInternalMarkdownBlankLineComments,
    afterSyntheticBlankLines,
    afterEscapedAngleBracketText,
    afterCanonicalSpacing,
    afterGenericHtmlBlockClosingSpacing,
    afterStripPlaceholders,
    afterEmptyParagraphBreaks,
    afterUserBreaks,
    afterListItems,
    afterLeakedInternalArtifacts,
    afterEmptyAtxHeadings,
    afterEscapedHighlight,
    afterAbbreviationDefinitions,
    afterTableCellBreaks,
    afterStandaloneBreakHtml,
    afterMarkdownSpaceEntities,
    afterRedundantMarkdownEscapes,
    afterMissingOrderedListMarkerSpaces,
    output,
  };
}
