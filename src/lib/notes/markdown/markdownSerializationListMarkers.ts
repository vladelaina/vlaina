import { mapMarkdownOutsideProtectedBlocks, mapMarkdownOutsideProtectedSegments, } from './markdownProtectedBlocks';
import {
  BR_ONLY_PATTERN, UTF8_BOM, MARKED_BR_ONLY_PATTERN, INTERNAL_MARKDOWN_BLANK_LINE_COMMENT_PATTERN, RENDERED_HTML_BOUNDARY_BLANK_LINE_COMMENT_PATTERN, INTERNAL_TIGHT_HEADING_COMMENT_PATTERN, HTML_COMMENT_OPEN_PATTERN, HTML_COMMENT_CLOSE_PATTERN, HTML_IMAGE_LINE_PATTERN, HTML_BLOCK_LINE_PATTERN, HTML_ONE_LINE_RENDERED_BLOCK_PATTERN, HTML_ONE_LINE_RENDERED_VOID_BLOCK_PATTERN, HTML_CLOSING_RENDERED_BLOCK_PATTERN, NON_EDITABLE_HTML_BOUNDARY_TAG_NAMES, MARKDOWN_ESCAPE_PATTERN, ESCAPED_LESS_THAN_PATTERN, REDUNDANT_PAIRED_MARKER_ESCAPES, LIST_GAP_SENTINEL, USER_BR_SENTINEL, LEAKED_USER_BR_SENTINEL_PATTERN, LEAKED_LIST_GAP_SENTINEL_WITH_NEWLINES_PATTERN, MARKDOWN_SPACE_ENTITY_PATTERN, LEADING_MARKDOWN_SPACE_ENTITY_RUN_PATTERN, MARKDOWN_SPACE_ENTITY_REPLACEMENT_PATTERN, BLOCKQUOTE_CONTAINER_PREFIX_PATTERN, LIST_CONTAINER_PREFIX_PATTERN, INVISIBLE_EMPTY_LINE_PLACEHOLDER_PATTERN, INVISIBLE_LIST_GAP_PLACEHOLDER_PATTERN, EDITABLE_LIST_GAP_PLACEHOLDER_PATTERN, USER_BR_SENTINEL_LINE_PATTERN, MARKED_EMPTY_MARKDOWN_LINE_PLACEHOLDER_PATTERN, MARKED_EMPTY_LINE_PATTERN, MARKED_EMPTY_LINE_TOKEN_PATTERN, MARKED_USER_BR_PATTERN, MARKED_BLOCKQUOTE_USER_BR_PATTERN, MARKED_BLOCKQUOTE_USER_BR_WITH_DEPTH_PATTERN, MARKED_BLOCKQUOTE_USER_BR_TOKEN_PATTERN, MARKED_USER_BR_TOKEN_PATTERN, MARKED_LIST_GAP_TOKEN_PATTERN, EMPTY_LIST_ITEM_PLACEHOLDER_PATTERN, EDITABLE_LIST_GAP_MARKER_PLACEHOLDER_PATTERN, SERIALIZED_EDITABLE_LIST_GAP_PLACEHOLDER_PATTERN, STANDALONE_BR_LINE_PATTERN, BLOCKQUOTE_STANDALONE_BR_LINE_PATTERN, INLINE_TERMINAL_LIST_BR_PATTERN, EMPTY_FOOTNOTE_DEFINITION_PLACEHOLDER_PATTERN, EMPTY_TABLE_CELL_PLACEHOLDER_PATTERN, EMPTY_ATX_HEADING_MARKER_PATTERN, LIST_ITEM_LINE_PATTERN, NESTED_LIST_ITEM_LINE_PATTERN, MISSING_ORDERED_LIST_SPACE_LINE_PATTERN, MISSING_UNORDERED_LIST_SPACE_LINE_PATTERN, UNICODE_BULLET_LIST_LINE_PATTERN, CHINESE_ORDERED_LIST_MARKER_PATTERN, MALFORMED_TASK_LIST_MARKER_PATTERN, FULLWIDTH_MARKDOWN_LINE_MARKER_PATTERN, FULLWIDTH_ORDERED_LIST_DIGIT_PATTERN, FULLWIDTH_TABLE_PIPE_PATTERN, TABLE_ROW_PATTERN, TABLE_DELIMITER_ROW_PATTERN, MISSING_BLOCKQUOTE_SPACE_PATTERN, CJK_ATX_HEADING_WITHOUT_SPACE_PATTERN, GENERIC_HTML_BLOCK_OPEN_LINE_PATTERN, RAW_HTML_BLOCK_OPEN_LINE_PATTERN, MAX_CACHED_MARKDOWN_NORMALIZATION_LENGTH, FAST_NORMALIZATION_MIN_LENGTH, ESCAPED_HIGHLIGHT_PATTERN, ESCAPED_URL_SCHEME_PATTERN, MARKDOWN_AUTOLINK_LITERAL_PATTERN, MAILTO_EMAIL_MARKDOWN_LINK_PATTERN, FAST_NORMALIZATION_STRUCTURAL_LINE_PATTERN, ALTERNATIVE_MATH_BLOCK_OPEN_PATTERN, ALTERNATIVE_MATH_BLOCK_STANDARD_CLOSE_PATTERN, ALTERNATIVE_MATH_BLOCK_BRACKET_CLOSE_PATTERN, ALTERNATIVE_MATH_BLOCK_STANDARD_CLOSE_SUFFIX_PATTERN, ALTERNATIVE_MATH_BLOCK_BRACKET_CLOSE_SUFFIX_PATTERN, DOLLAR_MATH_BLOCK_FENCE_PATTERN, LATEX_LIKE_MATH_CONTENT_PATTERN, GENERIC_HTML_BLOCK_TAGS, MathBlockFenceStyle, MathBlockFenceReference, MathBlockFenceReferenceIndex, DollarMathFenceMatch, MarkdownFenceLine, GenericHtmlSpacingFenceState } from './markdownSerializationShared';

export function normalizeMissingOrderedListMarkerSpaces(text: string): string {
  return mapMarkdownOutsideProtectedSegments(text, (segment) => {
    const lines = segment.split('\n');
    const output = [...lines];

    for (let index = 0; index < lines.length; index += 1) {
      const firstMatch = MISSING_ORDERED_LIST_SPACE_LINE_PATTERN.exec(lines[index] ?? '');
      if (!firstMatch) continue;

      const run: number[] = [index];
      let previousNumber = Number(firstMatch[2]);

      let cursor = index + 1;
      for (; cursor < lines.length; cursor += 1) {
        if ((lines[cursor] ?? '').trim().length === 0) continue;

        const nextMatch = MISSING_ORDERED_LIST_SPACE_LINE_PATTERN.exec(lines[cursor] ?? '');
        if (!nextMatch) break;

        const nextNumber = Number(nextMatch[2]);
        if (nextNumber !== previousNumber + 1) break;

        run.push(cursor);
        previousNumber = nextNumber;
      }

      if (run.length >= 2) {
        for (const lineIndex of run) {
          output[lineIndex] = (lines[lineIndex] ?? '').replace(
            MISSING_ORDERED_LIST_SPACE_LINE_PATTERN,
            (_match: string, rawMarker: string, _number: string, content: string) =>
              `${normalizeBlockquotePrefixedMarker(rawMarker)} ${content}`
          );
        }
      }

      index = Math.max(index, cursor - 1);
    }

    return output.join('\n');
  });
}

export function normalizeChineseOrderedListMarkers(text: string): string {
  return normalizeConsecutiveOrderedMarkerRun(text, CHINESE_ORDERED_LIST_MARKER_PATTERN);
}

export function normalizeMissingUnorderedListMarkerSpaces(text: string): string {
  return mapMarkdownOutsideProtectedSegments(text, (segment) => {
    const lines = segment.split('\n');
    const output = [...lines];

    for (let index = 0; index < lines.length; index += 1) {
      const firstMatch = MISSING_UNORDERED_LIST_SPACE_LINE_PATTERN.exec(lines[index] ?? '');
      if (!firstMatch) continue;

      const run: number[] = [index];
      let cursor = index + 1;
      for (; cursor < lines.length; cursor += 1) {
        if ((lines[cursor] ?? '').trim().length === 0) continue;
        if (!MISSING_UNORDERED_LIST_SPACE_LINE_PATTERN.test(lines[cursor] ?? '')) break;
        run.push(cursor);
      }

      if (run.length >= 2) {
        for (const lineIndex of run) {
          output[lineIndex] = (lines[lineIndex] ?? '').replace(
            MISSING_UNORDERED_LIST_SPACE_LINE_PATTERN,
            (_match: string, rawMarker: string, _symbol: string, content: string) => {
              const normalizedMarker = normalizeMarkdownListMarkerSymbols(rawMarker);
              return `${normalizeBlockquotePrefixedMarker(normalizedMarker)} ${content}`;
            }
          );
        }
      }

      index = Math.max(index, cursor - 1);
    }

    return output.join('\n');
  });
}

export function normalizeUnicodeBulletListMarkers(text: string): string {
  return mapMarkdownOutsideProtectedSegments(text, (segment) => {
    const lines = segment.split('\n');
    const output = [...lines];

    for (let index = 0; index < lines.length; index += 1) {
      const firstMatch = UNICODE_BULLET_LIST_LINE_PATTERN.exec(lines[index] ?? '');
      if (!firstMatch) continue;

      const run: number[] = [index];
      let cursor = index + 1;
      for (; cursor < lines.length; cursor += 1) {
        if ((lines[cursor] ?? '').trim().length === 0) continue;
        if (!UNICODE_BULLET_LIST_LINE_PATTERN.test(lines[cursor] ?? '')) break;
        run.push(cursor);
      }

      if (run.length >= 2) {
        for (const lineIndex of run) {
          output[lineIndex] = (lines[lineIndex] ?? '').replace(
            UNICODE_BULLET_LIST_LINE_PATTERN,
            (_match: string, rawMarker: string, _symbol: string, content: string) =>
              `${normalizeBlockquotePrefixedMarker(rawMarker.replace(/[•‣◦]/u, '-'))} ${content}`
          );
        }
      }

      index = Math.max(index, cursor - 1);
    }

    return output.join('\n');
  });
}

export function normalizeMalformedTaskListMarkers(text: string): string {
  return mapMarkdownOutsideProtectedSegments(text, (segment) =>
    segment.split('\n').map((line) => {
      const match = MALFORMED_TASK_LIST_MARKER_PATTERN.exec(line);
      if (!match) return line;

      const marker = normalizeMarkdownListMarkerSymbols(match[1] ?? '');
      const checkedValue = match[2] ?? match[3] ?? match[4] ?? '';
      const checked = checkedValue ? 'x' : ' ';
      const content = match[5] ?? '';
      const taskMarker = `${normalizeBlockquotePrefixedMarker(marker)} [${checked}]`;
      return content.length > 0 ? `${taskMarker} ${content}` : taskMarker;
    }).join('\n')
  );
}

export function normalizeFullwidthMarkdownLineMarkers(text: string): string {
  return mapMarkdownOutsideProtectedSegments(text, (segment) =>
    segment.split('\n').map((line) =>
      line.replace(/^((?: {0,3}＞[ \t]?)+)/u, (prefix: string) =>
        prefix.replace(/＞/g, '>')
      ).replace(
        FULLWIDTH_MARKDOWN_LINE_MARKER_PATTERN,
        (_match, prefix: string, marker: string, rest: string) => {
          const normalizedMarker = marker
            .replace(/＃/g, '#')
            .replace('＞', '>');
          return `${prefix.replace(/＞/g, '>')}${normalizedMarker}${rest}`;
        }
      )
    ).join('\n')
  );
}

export function normalizeFullwidthDigitRun(value: string): string {
  return value.replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xfee0));
}

export function normalizeFullwidthOrderedListDigits(text: string): string {
  return mapMarkdownOutsideProtectedSegments(text, (segment) =>
    segment.split('\n').map((line) =>
      line.replace(
        FULLWIDTH_ORDERED_LIST_DIGIT_PATTERN,
        (_match: string, prefix: string, digits: string) => `${prefix}${normalizeFullwidthDigitRun(digits)}`
      )
    ).join('\n')
  );
}

export function normalizeFullwidthTableLine(line: string): string {
  return line.replace(FULLWIDTH_TABLE_PIPE_PATTERN, '|');
}

export function isFullwidthTableCandidateLine(line: string): boolean {
  return line.includes('｜') && TABLE_ROW_PATTERN.test(normalizeFullwidthTableLine(line));
}

export function isFullwidthTableDelimiterLine(line: string): boolean {
  return TABLE_DELIMITER_ROW_PATTERN.test(normalizeFullwidthTableLine(line));
}

export function normalizeFullwidthTablePipes(text: string): string {
  return mapMarkdownOutsideProtectedSegments(text, (segment) => {
    const lines = segment.split('\n');
    const output = [...lines];

    for (let index = 0; index < lines.length; index += 1) {
      if (!isFullwidthTableCandidateLine(lines[index] ?? '')) continue;

      let end = index;
      while (end < lines.length && isFullwidthTableCandidateLine(lines[end] ?? '')) {
        end += 1;
      }

      const hasDelimiter = lines.slice(index, end).some(isFullwidthTableDelimiterLine);
      if (hasDelimiter && end - index >= 2) {
        for (let lineIndex = index; lineIndex < end; lineIndex += 1) {
          output[lineIndex] = normalizeFullwidthTableLine(lines[lineIndex] ?? '');
        }
      }

      index = end - 1;
    }

    return output.join('\n');
  });
}

export function normalizeConsecutiveOrderedMarkerRun(text: string, pattern: RegExp): string {
  return mapMarkdownOutsideProtectedSegments(text, (segment) => {
    const lines = segment.split('\n');
    const output = [...lines];

    for (let index = 0; index < lines.length; index += 1) {
      const firstMatch = pattern.exec(lines[index] ?? '');
      if (!firstMatch) continue;

      const run: number[] = [index];
      let previousNumber = Number(firstMatch[2]);
      if (previousNumber > 1) continue;

      let cursor = index + 1;
      for (; cursor < lines.length; cursor += 1) {
        if ((lines[cursor] ?? '').trim().length === 0) continue;

        const nextMatch = pattern.exec(lines[cursor] ?? '');
        if (!nextMatch) break;

        const nextNumber = Number(nextMatch[2]);
        if (nextNumber !== previousNumber + 1) break;

        run.push(cursor);
        previousNumber = nextNumber;
      }

      if (run.length >= 2) {
        for (const lineIndex of run) {
          output[lineIndex] = (lines[lineIndex] ?? '').replace(
            pattern,
            (_match: string, rawMarker: string, number: string, content: string) => {
              const numberIndex = rawMarker.indexOf(number);
              const prefix = (numberIndex >= 0 ? rawMarker.slice(0, numberIndex) : '')
                .replace(/[（(][ \t]*$/, '');
              return `${normalizeBlockquotePrefixedMarker(`${prefix}${number}.`)} ${content}`;
            }
          );
        }
      }

      index = Math.max(index, cursor - 1);
    }

    return output.join('\n');
  });
}

export function normalizeBlockquotePrefixedMarker(marker: string): string {
  const match = /^((?: {0,3}>[ \t]?)*)(.*)$/.exec(marker);
  if (!match) return marker;

  const blockquotePrefix = match[1] ?? '';
  const markerBody = match[2] ?? '';
  if (!blockquotePrefix) return marker;

  const leadingIndent = /^( {0,3})/.exec(blockquotePrefix)?.[1] ?? '';
  const depth = blockquotePrefix.match(/>/g)?.length ?? 0;
  if (depth <= 0) return marker;

  return `${leadingIndent}${Array.from({ length: depth }, () => '>').join(' ')} ${markerBody}`;
}

export function normalizeMarkdownListMarkerSymbols(marker: string): string {
  return marker
    .replace(/－/g, '-')
    .replace(/＊/g, '*')
    .replace(/＋/g, '+');
}
