import { mapMarkdownOutsideProtectedBlocks, mapMarkdownOutsideProtectedSegments, } from './markdownProtectedBlocks';
import {
  BR_ONLY_PATTERN, UTF8_BOM, MARKED_BR_ONLY_PATTERN, INTERNAL_MARKDOWN_BLANK_LINE_COMMENT_PATTERN, RENDERED_HTML_BOUNDARY_BLANK_LINE_COMMENT_PATTERN, INTERNAL_TIGHT_HEADING_COMMENT_PATTERN, HTML_COMMENT_OPEN_PATTERN, HTML_COMMENT_CLOSE_PATTERN, HTML_IMAGE_LINE_PATTERN, HTML_BLOCK_LINE_PATTERN, HTML_ONE_LINE_RENDERED_BLOCK_PATTERN, HTML_ONE_LINE_RENDERED_VOID_BLOCK_PATTERN, HTML_CLOSING_RENDERED_BLOCK_PATTERN, NON_EDITABLE_HTML_BOUNDARY_TAG_NAMES, MARKDOWN_ESCAPE_PATTERN, ESCAPED_LESS_THAN_PATTERN, REDUNDANT_PAIRED_MARKER_ESCAPES, LIST_GAP_SENTINEL, USER_BR_SENTINEL, LEAKED_USER_BR_SENTINEL_PATTERN, LEAKED_LIST_GAP_SENTINEL_WITH_NEWLINES_PATTERN, MARKDOWN_SPACE_ENTITY_PATTERN, LEADING_MARKDOWN_SPACE_ENTITY_RUN_PATTERN, MARKDOWN_SPACE_ENTITY_REPLACEMENT_PATTERN, BLOCKQUOTE_CONTAINER_PREFIX_PATTERN, LIST_CONTAINER_PREFIX_PATTERN, INVISIBLE_EMPTY_LINE_PLACEHOLDER_PATTERN, INVISIBLE_LIST_GAP_PLACEHOLDER_PATTERN, EDITABLE_LIST_GAP_PLACEHOLDER_PATTERN, USER_BR_SENTINEL_LINE_PATTERN, MARKED_EMPTY_MARKDOWN_LINE_PLACEHOLDER_PATTERN, MARKED_EMPTY_LINE_PATTERN, MARKED_EMPTY_LINE_TOKEN_PATTERN, MARKED_USER_BR_PATTERN, MARKED_BLOCKQUOTE_USER_BR_PATTERN, MARKED_BLOCKQUOTE_USER_BR_WITH_DEPTH_PATTERN, MARKED_BLOCKQUOTE_USER_BR_TOKEN_PATTERN, MARKED_USER_BR_TOKEN_PATTERN, MARKED_LIST_GAP_TOKEN_PATTERN, EMPTY_LIST_ITEM_PLACEHOLDER_PATTERN, EDITABLE_LIST_GAP_MARKER_PLACEHOLDER_PATTERN, SERIALIZED_EDITABLE_LIST_GAP_PLACEHOLDER_PATTERN, STANDALONE_BR_LINE_PATTERN, BLOCKQUOTE_STANDALONE_BR_LINE_PATTERN, INLINE_TERMINAL_LIST_BR_PATTERN, EMPTY_FOOTNOTE_DEFINITION_PLACEHOLDER_PATTERN, EMPTY_TABLE_CELL_PLACEHOLDER_PATTERN, EMPTY_ATX_HEADING_MARKER_PATTERN, LIST_ITEM_LINE_PATTERN, NESTED_LIST_ITEM_LINE_PATTERN, MISSING_ORDERED_LIST_SPACE_LINE_PATTERN, MISSING_UNORDERED_LIST_SPACE_LINE_PATTERN, UNICODE_BULLET_LIST_LINE_PATTERN, CHINESE_ORDERED_LIST_MARKER_PATTERN, MALFORMED_TASK_LIST_MARKER_PATTERN, FULLWIDTH_MARKDOWN_LINE_MARKER_PATTERN, FULLWIDTH_ORDERED_LIST_DIGIT_PATTERN, FULLWIDTH_TABLE_PIPE_PATTERN, TABLE_ROW_PATTERN, TABLE_DELIMITER_ROW_PATTERN, MISSING_BLOCKQUOTE_SPACE_PATTERN, CJK_ATX_HEADING_WITHOUT_SPACE_PATTERN, GENERIC_HTML_BLOCK_OPEN_LINE_PATTERN, RAW_HTML_BLOCK_OPEN_LINE_PATTERN, MAX_CACHED_MARKDOWN_NORMALIZATION_LENGTH, FAST_NORMALIZATION_MIN_LENGTH, ESCAPED_HIGHLIGHT_PATTERN, ESCAPED_URL_SCHEME_PATTERN, MARKDOWN_AUTOLINK_LITERAL_PATTERN, MAILTO_EMAIL_MARKDOWN_LINK_PATTERN, FAST_NORMALIZATION_STRUCTURAL_LINE_PATTERN, ALTERNATIVE_MATH_BLOCK_OPEN_PATTERN, ALTERNATIVE_MATH_BLOCK_STANDARD_CLOSE_PATTERN, ALTERNATIVE_MATH_BLOCK_BRACKET_CLOSE_PATTERN, ALTERNATIVE_MATH_BLOCK_STANDARD_CLOSE_SUFFIX_PATTERN, ALTERNATIVE_MATH_BLOCK_BRACKET_CLOSE_SUFFIX_PATTERN, DOLLAR_MATH_BLOCK_FENCE_PATTERN, LATEX_LIKE_MATH_CONTENT_PATTERN, GENERIC_HTML_BLOCK_TAGS, MathBlockFenceStyle, MathBlockFenceReference, MathBlockFenceReferenceIndex, DollarMathFenceMatch, MarkdownFenceLine, GenericHtmlSpacingFenceState } from './markdownSerializationShared';
import {
  getAlternativeMathBlockClose,
  isAlternativeMathBlockBracketCloseFence,
  isLatexLikeMathBlock,
  stripSingleTrailingBackslash,
} from './markdownSerializationMathFences';

export function restoreMathBlockFenceStylesFromReference(markdown: string, reference: string): string {
  const references = collectMathBlockFenceReferences(reference);
  if (!references.some((item) => item.style === 'bracket')) {
    return markdown;
  }

  const referenceIndex = createMathBlockFenceReferenceIndex(references);
  let nextReferenceIndex = 0;
  return mapMarkdownOutsideProtectedSegments(markdown, (segment) => {
    const lines = segment.split('\n');
    const dollarFenceMatches = collectDollarMathFenceMatches(lines);
    const output: string[] = [];

    for (let index = 0; index < lines.length; index += 1) {
      const match = dollarFenceMatches.get(index);
      if (!match) {
        output.push(lines[index]);
        continue;
      }

      const referenceMatch = takeMatchingMathBlockFenceReference(
        references,
        referenceIndex,
        normalizeMathBlockLatex(joinLineRange(lines, index + 1, match.closeIndex)),
        nextReferenceIndex
      );
      nextReferenceIndex = referenceMatch.nextIndex;

      if (referenceMatch.style === 'bracket') {
        output.push(`${match.prefix}\\[`);
        for (let cursor = index + 1; cursor < match.closeIndex; cursor += 1) {
          output.push(lines[cursor] ?? '');
        }
        output.push(`${match.prefix}\\]`);
      } else {
        for (let cursor = index; cursor <= match.closeIndex; cursor += 1) {
          output.push(lines[cursor] ?? '');
        }
      }
      index = match.closeIndex;
    }

    return output.join('\n');
  }, { protectMathBlocks: false });
}

export function takeMatchingMathBlockFenceReference(
  references: readonly MathBlockFenceReference[],
  referenceIndex: MathBlockFenceReferenceIndex,
  latex: string,
  startIndex: number
): { style: MathBlockFenceStyle | null; nextIndex: number } {
  const direct = references[startIndex];
  if (direct && referenceIndex.normalizedLatexes[startIndex] === latex) {
    return { style: direct.style, nextIndex: startIndex + 1 };
  }

  const matchIndex = findNextMathBlockFenceReferenceIndex(
    referenceIndex.byLatex.get(latex) ?? [],
    startIndex
  );
  if (matchIndex !== null) {
    return { style: references[matchIndex]?.style ?? null, nextIndex: matchIndex + 1 };
  }

  return { style: null, nextIndex: startIndex };
}

export function createMathBlockFenceReferenceIndex(
  references: readonly MathBlockFenceReference[]
): MathBlockFenceReferenceIndex {
  const byLatex = new Map<string, number[]>();
  const normalizedLatexes: string[] = [];

  references.forEach((reference, index) => {
    const latex = normalizeMathBlockLatex(reference.latex);
    normalizedLatexes.push(latex);
    const indexes = byLatex.get(latex);
    if (indexes) {
      indexes.push(index);
    } else {
      byLatex.set(latex, [index]);
    }
  });

  return { byLatex, normalizedLatexes };
}

export function findNextMathBlockFenceReferenceIndex(
  indexes: readonly number[],
  startIndex: number
): number | null {
  let low = 0;
  let high = indexes.length - 1;
  let result: number | null = null;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const index = indexes[mid] ?? 0;
    if (index <= startIndex) {
      low = mid + 1;
    } else {
      result = index;
      high = mid - 1;
    }
  }

  return result;
}

export function collectDollarMathFenceMatches(lines: readonly string[]): Map<number, DollarMathFenceMatch> {
  const matches = new Map<number, DollarMathFenceMatch>();
  const openByPrefix = new Map<string, number>();

  for (let index = 0; index < lines.length; index += 1) {
    const fence = DOLLAR_MATH_BLOCK_FENCE_PATTERN.exec(lines[index]);
    if (!fence) continue;

    const prefix = fence[1] ?? '';
    const openIndex = openByPrefix.get(prefix);
    if (openIndex === undefined) {
      openByPrefix.set(prefix, index);
      continue;
    }

    matches.set(openIndex, {
      prefix,
      closeIndex: index,
    });
    openByPrefix.delete(prefix);
  }

  return matches;
}

export function joinLineRange(lines: readonly string[], start: number, end: number): string {
  let output = '';
  for (let index = start; index < end; index += 1) {
    if (index > start) output += '\n';
    output += lines[index] ?? '';
  }
  return output;
}

export function collectMathBlockFenceReferences(markdown: string): MathBlockFenceReference[] {
  const references: MathBlockFenceReference[] = [];
  mapMarkdownOutsideProtectedSegments(markdown, (segment) => {
    collectMathBlockFenceReferencesFromSegment(segment, references);
    return segment;
  }, { protectMathBlocks: false });
  return references;
}

export function collectMathBlockFenceReferencesFromSegment(
  segment: string,
  references: MathBlockFenceReference[]
): void {
  const lines = segment.split('\n');
  const dollarFenceMatches = collectDollarMathFenceMatches(lines);

  for (let index = 0; index < lines.length; index += 1) {
    const dollarMatch = dollarFenceMatches.get(index);
    if (dollarMatch) {
      references.push({
        latex: joinLineRange(lines, index + 1, dollarMatch.closeIndex),
        style: 'dollar',
      });
      index = dollarMatch.closeIndex;
      continue;
    }

    const alternativeOpen = ALTERNATIVE_MATH_BLOCK_OPEN_PATTERN.exec(lines[index]);
    if (!alternativeOpen) continue;

    const pendingFence = {
      prefix: alternativeOpen[1] ?? '',
      bracketCloseFence: isAlternativeMathBlockBracketCloseFence(alternativeOpen[2] ?? ''),
      bracketOnlyFence: lines[index].trim() === '[',
    };
    const content: string[] = [];
    let closeIndex = -1;
    let inlineCloseContent: string | null = null;

    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const close = getAlternativeMathBlockClose(lines[cursor], pendingFence);
      if (close) {
        inlineCloseContent = close.contentLine;
        if (close.bracketClose && inlineCloseContent === null && content.length > 0) {
          const lastIndex = content.length - 1;
          content[lastIndex] = stripSingleTrailingBackslash(content[lastIndex] ?? '');
        } else if (close.bracketClose && inlineCloseContent !== null) {
          inlineCloseContent = stripSingleTrailingBackslash(inlineCloseContent);
        }
        closeIndex = cursor;
        break;
      }
      content.push(lines[cursor]);
    }

    if (closeIndex < 0) continue;
    const fullContent = inlineCloseContent === null ? content : [...content, inlineCloseContent];
    if (!pendingFence.bracketOnlyFence || isLatexLikeMathBlock(fullContent)) {
      references.push({
        latex: fullContent.join('\n'),
        style: 'bracket',
      });
      index = closeIndex;
    }
  }
}

export function normalizeMathBlockLatex(latex: string): string {
  return latex.replace(/\r\n?/g, '\n').trim();
}
