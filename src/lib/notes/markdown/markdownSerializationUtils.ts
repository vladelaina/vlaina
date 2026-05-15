import {
  mapMarkdownOutsideProtectedBlocks,
  mapMarkdownOutsideProtectedSegments,
} from './markdownProtectedBlocks';
import {
  collapseSyntheticBlankLinesAroundEmptyPlaceholders,
  collapseSyntheticBlankLinesBetweenAdjacentHeadings,
} from './markdownHeadingSpacing';
import { normalizeCanonicalMarkdownSpacing } from './markdownCanonicalSpacing';
import { preserveParagraphSoftBreaksAsHardBreaks } from './markdownSoftBreaks';
export { preserveMarkdownBlankLinesForEditor } from './markdownEditorBlankLines';
export { joinSerializedBlocks } from './markdownBlockJoin';

const BR_ONLY_PATTERN = /^<br\s*\/?>$/i;
const VLAINA_EMPTY_LINE_ATTR_PATTERN = '\\bdat[ae]-vla(?:ina|ian)-?(?:empty|empt)-line';
const VLAINA_LIST_GAP_ATTR_PATTERN = '\\bdat[ae]-vla(?:ina|ian)-?list-gap';
const VLAINA_USER_BR_ATTR_PATTERN = '\\bdat[ae]-vla(?:ina|ian)-?user-br';
const VLAINA_BLOCKQUOTE_DEPTH_ATTR_PATTERN = '\\bdat[ae]-vla(?:ina|ian)-?blockquote-depth';
const TRUE_ATTR_VALUE_PATTERN = '(?:"true"|\'true\'|true\\b)';
const DEPTH_ATTR_VALUE_PATTERN = '(?:"(\\d+)"|\'(\\d+)\'|(\\d+)\\b)';
const MARKED_BR_ONLY_PATTERN =
  new RegExp(`^<br\\b(?=[^>]*${VLAINA_EMPTY_LINE_ATTR_PATTERN}=${TRUE_ATTR_VALUE_PATTERN})[^>]*\\/?>\\s*(?:<\\/br>)?$`, 'i');
const MARKDOWN_ESCAPE_PATTERN = /\\([\\`*_{}[\]()#+\-.!])/g;
const LIST_GAP_SENTINEL = '\u0000VLAINA_LIST_GAP_SENTINEL\u0000';
const USER_BR_SENTINEL = '\u0000VLAINA_USER_BR_SENTINEL\u0000';
const LEAKED_LIST_GAP_SENTINEL_PATTERN =
  /(?:�+VLAINA_LIST_GAP_SENTINEL�*|�*VLAINA_LIST_GAP_SENTINEL�+)/g;
const LEAKED_USER_BR_SENTINEL_PATTERN =
  /(?:�+VLAINA_USER_BR_SENTINEL�*|�*VLAINA_USER_BR_SENTINEL�+)/g;
const LEAKED_LIST_GAP_SENTINEL_WITH_NEWLINES_PATTERN =
  new RegExp(`\\n*${LEAKED_LIST_GAP_SENTINEL_PATTERN.source}\\n*`, 'g');
const INVISIBLE_EMPTY_LINE_PLACEHOLDER_PATTERN = /^[\t ]*\\?\u200B[\t ]*$/;
const INVISIBLE_LIST_GAP_PLACEHOLDER_PATTERN = /^[\t ]*\\?\u200B\\?\u200C[\t ]*$/;
const USER_BR_SENTINEL_LINE_PATTERN =
  new RegExp(`^(\\s*(?:>\\s*)*)${USER_BR_SENTINEL}$`);
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
const EMPTY_FOOTNOTE_DEFINITION_PLACEHOLDER_PATTERN =
  /^(\s*\[\^[^\]]+\]:)\s*<br\s*\/?>$/gim;
const EMPTY_TABLE_CELL_PLACEHOLDER_PATTERN = /(\|\s*)<br\s*\/?>(\s*\|)/g;
const EMPTY_ATX_HEADING_MARKER_PATTERN = /^( {0,3})(#{1,6})[ \t]*$/gm;
const LIST_ITEM_LINE_PATTERN = /^(?: {0,3})(?:[-+*]|\d+[.)])\s+/;
const MAX_CACHED_MARKDOWN_NORMALIZATION_LENGTH = 1_000_000;
const ESCAPED_ABBR_DEFINITION_PATTERN = /^([ \t]*)\\\*(?:\\)?\[([^\]]+)]:/gm;
const ESCAPED_HIGHLIGHT_PATTERN = /\\==([^=\n]+)==/g;
const ESCAPED_URL_SCHEME_PATTERN = /\b([A-Za-z][A-Za-z0-9+.-]*)\\:(?=\/\/)/g;
const MARKDOWN_AUTOLINK_LITERAL_PATTERN =
  /<((?:https?:\/\/|mailto:)[^\s<>"']+|[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+)>/g;
const EMAIL_ADDRESS_SOURCE = String.raw`[A-Za-z0-9.!#$%&'*+/=?^_{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+`;
const MAILTO_EMAIL_MARKDOWN_LINK_PATTERN = new RegExp(
  String.raw`(^|[^!])\[(${EMAIL_ADDRESS_SOURCE})\]\(mailto:(${EMAIL_ADDRESS_SOURCE})\)`,
  'g'
);
const ALTERNATIVE_MATH_BLOCK_OPEN_PATTERN = /^(\s*(?:>\s*)*)((?:\\+\[\\?)|\[\\?|\[)\s*$/;
const ALTERNATIVE_MATH_BLOCK_STANDARD_CLOSE_PATTERN = /^(\s*(?:>\s*)*)\\\]\s*$/;
const ALTERNATIVE_MATH_BLOCK_BRACKET_CLOSE_PATTERN = /^(\s*(?:>\s*)*)]\s*$/;
const ALTERNATIVE_MATH_BLOCK_STANDARD_CLOSE_SUFFIX_PATTERN = /^(.*)\\\]\s*$/;
const ALTERNATIVE_MATH_BLOCK_BRACKET_CLOSE_SUFFIX_PATTERN = /^(.*)]\s*$/;
const DOLLAR_MATH_BLOCK_FENCE_PATTERN = /^(\s*(?:>\s*)*)\$\$\s*$/;
const LATEX_LIKE_MATH_CONTENT_PATTERN = /\\[A-Za-z]+|(?:^|[^\w])(?:\\?[A-Za-z]\w*)\s*(?:[=^_]|\\(?:le|ge|neq|approx|times|cdot|frac|sqrt|mu|alpha|beta|gamma|theta)\b)|[{}^_]/;

type MathBlockFenceStyle = 'dollar' | 'bracket';

interface MathBlockFenceReference {
  latex: string;
  style: MathBlockFenceStyle;
}

let lastNormalizedMarkdownInput: string | null = null;
let lastNormalizedMarkdownOutput: string | null = null;

function unescapeMarkdownPunctuation(text: string): string {
  return mapMarkdownOutsideProtectedBlocks(text, (line) => line.replace(MARKDOWN_ESCAPE_PATTERN, '$1'));
}

export function normalizeEscapedUrlSchemes(text: string): string {
  return mapMarkdownOutsideProtectedSegments(text, (segment) =>
    segment.replace(ESCAPED_URL_SCHEME_PATTERN, '$1:')
  );
}

export function normalizeMarkdownAutolinkLiterals(text: string): string {
  return mapMarkdownOutsideProtectedSegments(text, (segment) =>
    segment.replace(MARKDOWN_AUTOLINK_LITERAL_PATTERN, '$1')
  );
}

function normalizeMailtoEmailMarkdownLinks(text: string): string {
  return mapMarkdownOutsideProtectedSegments(text, (segment) =>
    segment.replace(
      MAILTO_EMAIL_MARKDOWN_LINK_PATTERN,
      (match, prefix: string, label: string, destination: string) =>
        label.toLowerCase() === destination.toLowerCase() ? `${prefix}${label}` : match
    )
  );
}

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
  });
}

function getAlternativeMathBlockClose(
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

function hasAlternativeMathInlineCloseContent(contentLine: string, prefix: string): boolean {
  if (prefix && !contentLine.startsWith(prefix)) return false;
  return contentLine.slice(prefix.length).trim().length > 0;
}

function isLatexLikeMathBlock(lines: readonly string[]): boolean {
  return LATEX_LIKE_MATH_CONTENT_PATTERN.test(lines.join('\n'));
}

function isAlternativeMathBlockBracketCloseFence(marker: string): boolean {
  return marker === '[' || marker.endsWith('\\');
}

function stripSingleTrailingBackslash(line: string): string {
  const withoutTrailingWhitespace = line.replace(/[ \t]+$/, '');
  return withoutTrailingWhitespace.endsWith('\\') && !withoutTrailingWhitespace.endsWith('\\\\')
    ? withoutTrailingWhitespace.slice(0, -1)
    : line;
}

export function restoreMathBlockFenceStylesFromReference(markdown: string, reference: string): string {
  const references = collectMathBlockFenceReferences(reference);
  if (!references.some((item) => item.style === 'bracket')) {
    return markdown;
  }

  let nextReferenceIndex = 0;
  return mapMarkdownOutsideProtectedSegments(markdown, (segment) => {
    const lines = segment.split('\n');
    const output: string[] = [];

    for (let index = 0; index < lines.length; index += 1) {
      const open = DOLLAR_MATH_BLOCK_FENCE_PATTERN.exec(lines[index]);
      if (!open) {
        output.push(lines[index]);
        continue;
      }

      const prefix = open[1] ?? '';
      const content: string[] = [];
      let closeIndex = -1;
      for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
        const close = DOLLAR_MATH_BLOCK_FENCE_PATTERN.exec(lines[cursor]);
        if (close && (close[1] ?? '') === prefix) {
          closeIndex = cursor;
          break;
        }
        content.push(lines[cursor]);
      }

      if (closeIndex < 0) {
        output.push(lines[index]);
        continue;
      }

      const referenceMatch = takeMatchingMathBlockFenceReference(
        references,
        normalizeMathBlockLatex(content.join('\n')),
        nextReferenceIndex
      );
      nextReferenceIndex = referenceMatch.nextIndex;

      if (referenceMatch.style === 'bracket') {
        output.push(`${prefix}\\[`, ...content, `${prefix}\\]`);
      } else {
        output.push(lines[index], ...content, lines[closeIndex]);
      }
      index = closeIndex;
    }

    return output.join('\n');
  });
}

function takeMatchingMathBlockFenceReference(
  references: readonly MathBlockFenceReference[],
  latex: string,
  startIndex: number
): { style: MathBlockFenceStyle | null; nextIndex: number } {
  const direct = references[startIndex];
  if (direct && normalizeMathBlockLatex(direct.latex) === latex) {
    return { style: direct.style, nextIndex: startIndex + 1 };
  }

  for (let index = startIndex + 1; index < references.length; index += 1) {
    const candidate = references[index];
    if (normalizeMathBlockLatex(candidate.latex) === latex) {
      return { style: candidate.style, nextIndex: index + 1 };
    }
  }

  return { style: null, nextIndex: startIndex };
}

function collectMathBlockFenceReferences(markdown: string): MathBlockFenceReference[] {
  const references: MathBlockFenceReference[] = [];
  mapMarkdownOutsideProtectedSegments(markdown, (segment) => {
    collectMathBlockFenceReferencesFromSegment(segment, references);
    return segment;
  });
  return references;
}

function collectMathBlockFenceReferencesFromSegment(
  segment: string,
  references: MathBlockFenceReference[]
): void {
  const lines = segment.split('\n');

  for (let index = 0; index < lines.length; index += 1) {
    const dollarOpen = DOLLAR_MATH_BLOCK_FENCE_PATTERN.exec(lines[index]);
    if (dollarOpen) {
      const prefix = dollarOpen[1] ?? '';
      const content: string[] = [];
      let closeIndex = -1;
      for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
        const close = DOLLAR_MATH_BLOCK_FENCE_PATTERN.exec(lines[cursor]);
        if (close && (close[1] ?? '') === prefix) {
          closeIndex = cursor;
          break;
        }
        content.push(lines[cursor]);
      }
      if (closeIndex >= 0) {
        references.push({ latex: content.join('\n'), style: 'dollar' });
        index = closeIndex;
      }
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

function normalizeMathBlockLatex(latex: string): string {
  return latex.replace(/\r\n?/g, '\n').trim();
}

function normalizeUrlSerializationArtifacts(text: string): string {
  return normalizeMailtoEmailMarkdownLinks(
    normalizeMarkdownAutolinkLiterals(normalizeEscapedUrlSchemes(text))
  );
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
    normalizeEscapedHighlightSyntax(unescapeMarkdownPunctuation(withoutTrailingNewlines))
  );
}

export function normalizeSerializedMarkdownDocument(text: string): string {
  if (text === lastNormalizedMarkdownInput && lastNormalizedMarkdownOutput !== null) {
    return lastNormalizedMarkdownOutput;
  }

  const output = runMarkdownDocumentNormalizationPipeline(text).output;
  if (text.length <= MAX_CACHED_MARKDOWN_NORMALIZATION_LENGTH) {
    lastNormalizedMarkdownInput = text;
    lastNormalizedMarkdownOutput = output;
  } else {
    lastNormalizedMarkdownInput = null;
    lastNormalizedMarkdownOutput = null;
  }
  return output;
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

function runMarkdownDocumentNormalizationPipeline(text: string) {
  const afterHeadingSpacing = collapseSyntheticBlankLinesBetweenAdjacentHeadings(text);
  const afterSyntheticBlankLines =
    collapseSyntheticBlankLinesAroundEmptyPlaceholders(afterHeadingSpacing);
  const afterCanonicalSpacing = normalizeCanonicalMarkdownSpacing(afterSyntheticBlankLines);
  const afterStripPlaceholders = stripEmptyMarkdownPlaceholders(afterCanonicalSpacing);
  const afterEmptyParagraphBreaks = normalizeEditorEmptyParagraphBreaks(afterStripPlaceholders);
  const afterUserBreaks = normalizeUserBreakSentinels(afterEmptyParagraphBreaks);
  const afterListItems = normalizeListItemBlankLines(afterUserBreaks);
  const afterLeakedInternalArtifacts = normalizeUserBreakSentinels(
    normalizeLeakedInternalArtifacts(afterListItems)
  );
  const afterEmptyAtxHeadings = normalizeEmptyAtxHeadingMarkers(afterLeakedInternalArtifacts);
  const afterEscapedHighlight = normalizeEscapedHighlightSyntax(afterEmptyAtxHeadings);
  const afterAbbreviationDefinitions = normalizeEscapedAbbreviationDefinitions(afterEscapedHighlight);
  const afterTableCellBreaks = normalizeTableCellBreakPlaceholders(afterAbbreviationDefinitions);
  const output = normalizeUrlSerializationArtifacts(
    preserveParagraphSoftBreaksAsHardBreaks(afterTableCellBreaks)
  );

  return {
    input: text,
    afterHeadingSpacing,
    afterSyntheticBlankLines,
    afterCanonicalSpacing,
    afterStripPlaceholders,
    afterEmptyParagraphBreaks,
    afterUserBreaks,
    afterListItems,
    afterLeakedInternalArtifacts,
    afterEmptyAtxHeadings,
    afterEscapedHighlight,
    afterAbbreviationDefinitions,
    afterTableCellBreaks,
    output,
  };
}

function normalizeEmptyAtxHeadingMarkers(text: string): string {
  return mapMarkdownOutsideProtectedSegments(text, (segment) =>
    segment.replace(EMPTY_ATX_HEADING_MARKER_PATTERN, (_match, indent: string, marker: string) =>
      `${indent}${marker} ${marker}`
    )
  );
}

function normalizeEscapedAbbreviationDefinitions(text: string): string {
  return mapMarkdownOutsideProtectedSegments(text, (segment) =>
    segment.replace(ESCAPED_ABBR_DEFINITION_PATTERN, '$1*[$2]:')
  );
}

function normalizeEscapedHighlightSyntax(text: string): string {
  return mapMarkdownOutsideProtectedSegments(text, (segment) =>
    segment.replace(ESCAPED_HIGHLIGHT_PATTERN, '==$1==')
  );
}

function normalizeTableCellBreakPlaceholders(text: string): string {
  return mapMarkdownOutsideProtectedSegments(text, (segment) =>
    segment.replace(EMPTY_TABLE_CELL_PLACEHOLDER_PATTERN, '$1 $2')
  );
}

function normalizeEditorEmptyParagraphBreaks(text: string): string {
  return mapMarkdownOutsideProtectedSegments(text, (segment) => {
    const lines = segment.split('\n');
    return lines.filter((line, index) => {
      if (!BR_ONLY_PATTERN.test(line.trim())) {
        return true;
      }

      if (index <= 0 || index >= lines.length - 1) {
        return true;
      }

      const previousLine = index > 0 ? lines[index - 1] ?? '' : '';
      const nextLine = index < lines.length - 1 ? lines[index + 1] ?? '' : '';
      return previousLine.trim() !== '' && nextLine.trim() !== '';
    }).join('\n');
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
        return USER_BR_SENTINEL;
      }
      const blockquoteUserBrMatch = MARKED_BLOCKQUOTE_USER_BR_PATTERN.exec(line);
      if (blockquoteUserBrMatch) {
        return `${blockquoteUserBrMatch[1] ?? ''}${USER_BR_SENTINEL}`;
      }
      return line
        .replace(MARKED_LIST_GAP_TOKEN_PATTERN, `\n${LIST_GAP_SENTINEL}\n`)
        .replace(MARKED_EMPTY_LINE_TOKEN_PATTERN, '\n')
        .replace(
          MARKED_BLOCKQUOTE_USER_BR_TOKEN_PATTERN,
          (_match, doubleQuotedDepth: string, singleQuotedDepth: string, unquotedDepth: string) =>
            `\n${getBlockquotePrefix(Number(
              doubleQuotedDepth ?? singleQuotedDepth ?? unquotedDepth
            ))}${USER_BR_SENTINEL}`
        )
        .replace(MARKED_USER_BR_TOKEN_PATTERN, `\n${USER_BR_SENTINEL}\n`);
    }
  );
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

function normalizeListItemBlankLines(text: string): string {
  const normalizedListSpacing = mapMarkdownOutsideProtectedSegments(
    text,
    collapseBlankLinesBetweenListItems,
  );

  if (!normalizedListSpacing.includes(LIST_GAP_SENTINEL)) {
    return normalizedListSpacing;
  }

  return normalizedListSpacing.replace(new RegExp(`\\n*${LIST_GAP_SENTINEL}\\n*`, 'g'), '\n\n');
}

function collapseBlankLinesBetweenListItems(segment: string): string {
  const lines = segment.split('\n');
  const output: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    output.push(line);

    if (!LIST_ITEM_LINE_PATTERN.test(line)) {
      continue;
    }

    let cursor = index + 1;
    while (cursor < lines.length && (lines[cursor] ?? '').trim() === '') {
      cursor += 1;
    }

    if (cursor > index + 1 && LIST_ITEM_LINE_PATTERN.test(lines[cursor] ?? '')) {
      index = cursor - 1;
    }
  }

  return output.join('\n');
}

function normalizeInternalClipboardArtifacts(text: string): string {
  return normalizeLeakedInternalArtifacts(normalizeListItemBlankLines(normalizeEditorBreakPlaceholders(text)))
    .replace(/\n{3,}/g, '\n\n');
}

function normalizeLeakedInternalArtifacts(text: string): string {
  if (!text.includes('VLAINA_') || !text.includes('�')) {
    return text;
  }

  return text
    .replace(LEAKED_LIST_GAP_SENTINEL_WITH_NEWLINES_PATTERN, '\n\n')
    .replace(LEAKED_USER_BR_SENTINEL_PATTERN, USER_BR_SENTINEL);
}

function getBlockquotePrefix(depth: number): string {
  return Array.from({ length: Math.max(0, depth) }, () => '>').join(' ') + (depth > 0 ? ' ' : '');
}

export function normalizeSerializedMarkdownSelection(text: string): string {
  const trimmedText = stripTrailingNewlines(text).trim();
  const isStandaloneBreak =
    BR_ONLY_PATTERN.test(trimmedText) || MARKED_BR_ONLY_PATTERN.test(trimmedText);
  const normalizedPlaceholders = normalizeInternalClipboardArtifacts(text);
  const withoutTrailingNewlines = stripTrailingNewlines(
    normalizeUserBreakSentinels(stripEmptyMarkdownPlaceholders(normalizedPlaceholders))
  );
  if (
    isStandaloneBreak
    || (text.length > 0 && withoutTrailingNewlines.length === 0)
    || BR_ONLY_PATTERN.test(withoutTrailingNewlines.trim())
  ) return '\n';
  return normalizeUrlSerializationArtifacts(
    normalizeEscapedHighlightSyntax(unescapeMarkdownPunctuation(withoutTrailingNewlines))
  );
}
