import {
  mapMarkdownOutsideProtectedBlocks,
  mapMarkdownOutsideProtectedSegments,
} from './markdownProtectedBlocks';
import {
  collapseSyntheticBlankLinesAroundEmptyPlaceholders,
  collapseSyntheticBlankLinesBetweenAdjacentHeadings,
} from './markdownHeadingSpacing';
import { normalizeCanonicalMarkdownSpacingForPersistence } from './markdownCanonicalSpacing';
import { isMarkdownImageOnlyLine } from './markdownImageLine';
import { preserveParagraphSoftBreaksAsHardBreaks } from './markdownSoftBreaks';
export {
  preserveMarkdownBlankLinesForEditor,
  preserveMarkdownBlankLinesForPaste,
} from './markdownEditorBlankLines';
export { joinSerializedBlocks } from './markdownBlockJoin';

const BR_ONLY_PATTERN = /^<br\b[^>]*\/?>\s*(?:<\/br>)?$/i;
const LEGACY_EMPTY_LINE_ATTR_PATTERN = '\\bdat[ae]-vlaina-?(?:empty|empt)-line';
const LEGACY_LIST_GAP_ATTR_PATTERN = '\\bdat[ae]-vlaina-?list-gap';
const LEGACY_USER_BR_ATTR_PATTERN = '\\bdat[ae]-vlaina-?user-br';
const LEGACY_BLOCKQUOTE_DEPTH_ATTR_PATTERN = '\\bdat[ae]-vlaina-?blockquote-depth';
const TRUE_ATTR_VALUE_PATTERN = '(?:"true"|\'true\'|true\\b)';
const DEPTH_ATTR_VALUE_PATTERN = '(?:"(\\d+)"|\'(\\d+)\'|(\\d+)\\b)';
const MARKED_BR_ONLY_PATTERN =
  new RegExp(`^<br\\b(?=[^>]*${LEGACY_EMPTY_LINE_ATTR_PATTERN}=${TRUE_ATTR_VALUE_PATTERN})[^>]*\\/?>\\s*(?:<\\/br>)?$`, 'i');
const INTERNAL_MARKDOWN_BLANK_LINE_COMMENT_PATTERN = /^\s*<!--\s*vlaina-markdown-blank-line\s*-->\s*$/i;
const INTERNAL_TIGHT_HEADING_COMMENT_PATTERN = /^\s*<!--\s*vlaina-markdown-tight-heading\s*-->\s*$/i;
const HTML_IMAGE_LINE_PATTERN = /^(?: {0,3})<img(?:\s|\/?>|$)/i;
const MARKDOWN_ESCAPE_PATTERN = /\\([\\`*_{}[\]()#+\-.!])/g;
const LIST_GAP_SENTINEL = '\u0000VLAINA_LIST_GAP_SENTINEL\u0000';
const USER_BR_SENTINEL = '\u0000VLAINA_USER_BR_SENTINEL\u0000';
const LEAKED_LIST_GAP_SENTINEL_PATTERN =
  /(?:�+VLAINA_LIST_GAP_SENTINEL�*|�*VLAINA_LIST_GAP_SENTINEL�+)/g;
const LEAKED_USER_BR_SENTINEL_PATTERN =
  /(?:�+VLAINA_USER_BR_SENTINEL�*|�*VLAINA_USER_BR_SENTINEL�+)/g;
const LEAKED_LIST_GAP_SENTINEL_WITH_NEWLINES_PATTERN =
  new RegExp(`\\n*${LEAKED_LIST_GAP_SENTINEL_PATTERN.source}\\n*`, 'g');
const MARKDOWN_SPACE_ENTITY_PATTERN = /&#(?:x0*20|0*32)(?:;|(?=$|[ \t]))/i;
const LEADING_MARKDOWN_SPACE_ENTITY_RUN_PATTERN =
  /^(?:(?:[ \t]+)|(?:&#(?:x0*20|0*32);|&#(?:x0*20|0*32)(?=$|[ \t])))+/i;
const MARKDOWN_SPACE_ENTITY_REPLACEMENT_PATTERN =
  /&#(?:x0*20|0*32);|&#(?:x0*20|0*32)(?:[ \t]|$)/gi;
const BLOCKQUOTE_CONTAINER_PREFIX_PATTERN = /^(?: {0,3}>[ \t]?)/;
const LIST_CONTAINER_PREFIX_PATTERN =
  /^(?: {0,3}(?:[-+*]|\d{1,9}[.)])[ \t]+(?:\[(?: |x|X)\][ \t]+)?)/;
const INVISIBLE_EMPTY_LINE_PLACEHOLDER_PATTERN = /^[\t ]*\\?\u200B[\t ]*$/;
const INVISIBLE_LIST_GAP_PLACEHOLDER_PATTERN = /^[\t ]*\\?\u200B\\?\u200C[\t ]*$/;
const EDITABLE_LIST_GAP_PLACEHOLDER_PATTERN = /^[\t ]*\u2800[\t ]*$/;
const USER_BR_SENTINEL_LINE_PATTERN =
  new RegExp(`^(\\s*(?:>\\s*)*)${USER_BR_SENTINEL}$`);
const MARKED_EMPTY_MARKDOWN_LINE_PLACEHOLDER_PATTERN =
  new RegExp(`^(\\s*(?:>\\s*)*(?:(?:[-+*]|\\d+[.)])\\s+(?:\\[(?: |x|X)\\]\\s+)?)?)<br\\b(?=[^>]*${LEGACY_EMPTY_LINE_ATTR_PATTERN}=${TRUE_ATTR_VALUE_PATTERN})[^>]*\\/?>\\s*(?:<\\/br>)?$`, 'gim');
const MARKED_EMPTY_LINE_PATTERN =
  new RegExp(`^<br\\b(?=[^>]*${LEGACY_EMPTY_LINE_ATTR_PATTERN}=${TRUE_ATTR_VALUE_PATTERN})[^>]*\\/?>\\s*(?:<\\/br>)?$`, 'i');
const MARKED_EMPTY_LINE_TOKEN_PATTERN =
  new RegExp(`[ \\t]*<br\\b(?=[^>]*${LEGACY_EMPTY_LINE_ATTR_PATTERN}=${TRUE_ATTR_VALUE_PATTERN})[^>]*\\/?>[ \\t]*(?:<\\/br>)?`, 'gi');
const MARKED_USER_BR_PATTERN =
  new RegExp(`^<br\\b(?=[^>]*${LEGACY_USER_BR_ATTR_PATTERN}=${TRUE_ATTR_VALUE_PATTERN})[^>]*\\/?>\\s*(?:<\\/br>)?$`, 'i');
const MARKED_BLOCKQUOTE_USER_BR_PATTERN =
  new RegExp(`^(\\s*(?:>\\s*)+)<br\\b(?=[^>]*${LEGACY_USER_BR_ATTR_PATTERN}=${TRUE_ATTR_VALUE_PATTERN})[^>]*\\/?>\\s*(?:<\\/br>)?$`, 'i');
const MARKED_BLOCKQUOTE_USER_BR_WITH_DEPTH_PATTERN =
  new RegExp(`^(\\s*(?:>\\s*)*)<br\\b(?=[^>]*${LEGACY_USER_BR_ATTR_PATTERN}=${TRUE_ATTR_VALUE_PATTERN})(?=[^>]*${LEGACY_BLOCKQUOTE_DEPTH_ATTR_PATTERN}=${DEPTH_ATTR_VALUE_PATTERN})[^>]*\\/?>\\s*(?:<\\/br>)?$`, 'i');
const MARKED_BLOCKQUOTE_USER_BR_TOKEN_PATTERN =
  new RegExp(`[ \\t]*(?:\\\\?\\u200B[ \\t]*)?<br\\b(?=[^>]*${LEGACY_USER_BR_ATTR_PATTERN}=${TRUE_ATTR_VALUE_PATTERN})(?=[^>]*${LEGACY_BLOCKQUOTE_DEPTH_ATTR_PATTERN}=${DEPTH_ATTR_VALUE_PATTERN})[^>]*\\/?>[ \\t]*(?:<\\/br>)?`, 'gi');
const MARKED_USER_BR_TOKEN_PATTERN =
  new RegExp(`[ \\t]*(?:\\\\?\\u200B[ \\t]*)?<br\\b(?=[^>]*${LEGACY_USER_BR_ATTR_PATTERN}=${TRUE_ATTR_VALUE_PATTERN})[^>]*\\/?>[ \\t]*(?:<\\/br>)?`, 'gi');
const MARKED_LIST_GAP_TOKEN_PATTERN = new RegExp(`[ \\t]*<br\\b(?=[^>]*${LEGACY_LIST_GAP_ATTR_PATTERN}=${TRUE_ATTR_VALUE_PATTERN})[^>]*\\/?>[ \\t]*(?:<\\/br>)?`, 'gi');
const EMPTY_LIST_ITEM_PLACEHOLDER_PATTERN =
  /^(\s*(?:>\s*)*(?:[-+*]|\d+[.)])(?:\s+\[(?: |x|X)\])?)\s+<br\b[^>]*\/?>\s*(?:<\/br>)?$/gim;
const EDITABLE_LIST_GAP_MARKER_PLACEHOLDER_PATTERN =
  /^(\s*(?:>\s*)*(?:[-+*]|\d+[.)])(?:\s+\[(?: |x|X)\])?)\s+\u2800\s*$/;
const SERIALIZED_EDITABLE_LIST_GAP_PLACEHOLDER_PATTERN =
  /^\s*(?:>\s*)*(?:[-+*]|\d+[.)])\s+\u2800\s*$/;
const STANDALONE_BR_LINE_PATTERN = /^(\s*)<br\b[^>]*\/?>\s*(?:<\/br>)?$/i;
const BLOCKQUOTE_STANDALONE_BR_LINE_PATTERN = /^(\s*(?:>\s*)+)<br\b[^>]*\/?>\s*(?:<\/br>)?$/i;
const INLINE_TERMINAL_LIST_BR_PATTERN =
  /^(\s*(?:>\s*)*(?:[-+*]|\d+[.)])\s+(?:\[(?: |x|X)\]\s+)?(?:.+?))<br\b[^>]*\/?>\s*(?:<\/br>)?$/i;
const EMPTY_FOOTNOTE_DEFINITION_PLACEHOLDER_PATTERN =
  /^(\s*\[\^[^\]]+\]:)\s*<br\s*\/?>$/gim;
const EMPTY_TABLE_CELL_PLACEHOLDER_PATTERN = /(\|\s*)<br\s*\/?>(\s*\|)/g;
const EMPTY_ATX_HEADING_MARKER_PATTERN = /^( {0,3})(#{1,6})[ \t]*$/gm;
const LIST_ITEM_LINE_PATTERN = /^(?: {0,3})(?:[-+*]|\d+[.)])(?:\s+|$)/;
const MISSING_ORDERED_LIST_SPACE_LINE_PATTERN =
  /^((?:(?: {0,3}>[ \t]?)* {0,3})(\d{1,3})\.)(\S.*)$/;
const MISSING_UNORDERED_LIST_SPACE_LINE_PATTERN =
  /^((?:(?: {0,3}>[ \t]?)* {0,3})([-+*－＊＋]))([^\s\d\-+*－＊＋[\]].*)$/u;
const UNICODE_BULLET_LIST_LINE_PATTERN =
  /^((?:(?: {0,3}>[ \t]?)* {0,3})([•‣◦]))[ \t]+(.+)$/u;
const CHINESE_ORDERED_LIST_MARKER_PATTERN =
  /^((?:(?: {0,3}>[ \t]?)* {0,3})(?:[（(]\s*)?(\d{1,3})(?:\s*[）)]|[、．]))[ \t]*(\S.*)$/u;
const MALFORMED_TASK_LIST_MARKER_PATTERN =
  /^((?:(?: {0,3}>[ \t]?)* {0,3})(?:[-+*－＊＋]|\d+[.)]))[ \t]*(?:\[\s*([xXｘＸ✓✔√]?)\s*\]|［\s*([xXｘＸ✓✔√]?)\s*］|【\s*([xXｘＸ✓✔√]?)\s*】)[ \t]*(.*)$/u;
const FULLWIDTH_MARKDOWN_LINE_MARKER_PATTERN =
  /^((?:(?: {0,3}＞[ \t]?| {0,3}>[ \t]?)* {0,3}))(＃{1,6}|＞)(.*)$/u;
const FULLWIDTH_ORDERED_LIST_DIGIT_PATTERN =
  /^((?:(?: {0,3}>[ \t]?)* {0,3})(?:[（(][ \t]*)?)([０-９]{1,3})(?=[ \t]*(?:[）)]|[、．.]))/u;
const FULLWIDTH_TABLE_PIPE_PATTERN = /｜/g;
const TABLE_ROW_PATTERN = /^\s*\|.*\|\s*$/;
const TABLE_DELIMITER_ROW_PATTERN = /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/;
const MISSING_BLOCKQUOTE_SPACE_PATTERN =
  /^((?:(?: {0,3}>[ \t]?)* {0,3})>)(\S.*)$/;
const CJK_ATX_HEADING_WITHOUT_SPACE_PATTERN =
  /^((?:(?: {0,3}>[ \t]?)* {0,3})#{1,6})([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}].*)$/u;
const MAX_CACHED_MARKDOWN_NORMALIZATION_LENGTH = 1_000_000;
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

interface MathBlockFenceReferenceIndex {
  byLatex: Map<string, number[]>;
  normalizedLatexes: string[];
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

function normalizeFullwidthDigitRun(value: string): string {
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

function normalizeFullwidthTableLine(line: string): string {
  return line.replace(FULLWIDTH_TABLE_PIPE_PATTERN, '|');
}

function isFullwidthTableCandidateLine(line: string): boolean {
  return line.includes('｜') && TABLE_ROW_PATTERN.test(normalizeFullwidthTableLine(line));
}

function isFullwidthTableDelimiterLine(line: string): boolean {
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

export function normalizeMissingBlockquoteMarkerSpaces(text: string): string {
  return mapMarkdownOutsideProtectedSegments(text, (segment) =>
    segment.split('\n').map((line) =>
      line.replace(MISSING_BLOCKQUOTE_SPACE_PATTERN, '$1 $2')
    ).join('\n')
  );
}

export function normalizeCjkAtxHeadingMarkerSpaces(text: string): string {
  return mapMarkdownOutsideProtectedSegments(text, (segment) =>
    segment.split('\n').map((line) =>
      line.replace(CJK_ATX_HEADING_WITHOUT_SPACE_PATTERN, '$1 $2')
    ).join('\n')
  );
}

export function normalizeLenientMarkdownLineMarkers(text: string): string {
  const afterFullwidthMarkers = normalizeFullwidthMarkdownLineMarkers(text);
  const afterBlockquoteSpaces = normalizeMissingBlockquoteMarkerSpaces(afterFullwidthMarkers);
  const afterHeadingSpaces = normalizeCjkAtxHeadingMarkerSpaces(afterBlockquoteSpaces);
  const afterFullwidthTables = normalizeFullwidthTablePipes(afterHeadingSpaces);
  const afterFullwidthOrderedDigits = normalizeFullwidthOrderedListDigits(afterFullwidthTables);
  const afterChineseOrderedLists = normalizeChineseOrderedListMarkers(afterFullwidthOrderedDigits);
  const afterTaskListMarkers = normalizeMalformedTaskListMarkers(afterChineseOrderedLists);
  const afterUnicodeBulletLists = normalizeUnicodeBulletListMarkers(afterTaskListMarkers);
  const afterMissingUnorderedListSpaces =
    normalizeMissingUnorderedListMarkerSpaces(afterUnicodeBulletLists);
  return normalizeMissingOrderedListMarkerSpaces(afterMissingUnorderedListSpaces);
}

function normalizeConsecutiveOrderedMarkerRun(text: string, pattern: RegExp): string {
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

function normalizeBlockquotePrefixedMarker(marker: string): string {
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

function normalizeMarkdownListMarkerSymbols(marker: string): string {
  return marker
    .replace(/－/g, '-')
    .replace(/＊/g, '*')
    .replace(/＋/g, '+');
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

  const referenceIndex = createMathBlockFenceReferenceIndex(references);
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
        referenceIndex,
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

function createMathBlockFenceReferenceIndex(
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

function findNextMathBlockFenceReferenceIndex(
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

function normalizeMarkdownSpaceEntityArtifacts(text: string): string {
  if (!MARKDOWN_SPACE_ENTITY_PATTERN.test(text)) return text;

  return mapMarkdownOutsideProtectedSegments(text, (segment) =>
    segment.split('\n').map(normalizeMarkdownSpaceEntityLine).join('\n')
  );
}

function normalizeMarkdownSpaceEntityLine(line: string): string {
  const contentStart = getMarkdownContainerContentStart(line);
  const leadingContent = line.slice(contentStart);
  const match = LEADING_MARKDOWN_SPACE_ENTITY_RUN_PATTERN.exec(leadingContent);
  if (!match) return line;

  return `${line.slice(0, contentStart)}${leadingContent.replace(
    LEADING_MARKDOWN_SPACE_ENTITY_RUN_PATTERN,
    (prefix) => prefix.replace(MARKDOWN_SPACE_ENTITY_REPLACEMENT_PATTERN, ' ')
  )}`;
}

function getMarkdownContainerContentStart(line: string): number {
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
  const afterTableCellBreaks = normalizeTableCellBreakPlaceholders(afterLeakedInternalArtifacts);
  const afterStandaloneBreakHtml = normalizeStandaloneBreakHtmlToMarkdown(afterTableCellBreaks);
  const afterMarkdownSpaceEntities = normalizeMarkdownSpaceEntityArtifacts(afterStandaloneBreakHtml);

  return preserveParagraphSoftBreaksAsHardBreaks(afterMarkdownSpaceEntities);
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
  const afterInternalTightHeadingComments = normalizeInternalTightHeadingComments(text);
  const afterHeadingSpacing = collapseSyntheticBlankLinesBetweenAdjacentHeadings(afterInternalTightHeadingComments);
  const afterInternalMarkdownBlankLineComments =
    normalizeInternalMarkdownBlankLineComments(afterHeadingSpacing);
  const afterSyntheticBlankLines =
    collapseSyntheticBlankLinesAroundEmptyPlaceholders(afterInternalMarkdownBlankLineComments);
  const afterCanonicalSpacing = normalizeCanonicalMarkdownSpacingForPersistence(afterSyntheticBlankLines);
  const afterLenientLineMarkers = normalizeLenientMarkdownLineMarkers(afterCanonicalSpacing);
  const afterStripPlaceholders = stripEmptyMarkdownPlaceholders(afterLenientLineMarkers);
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
  const output = normalizeUrlSerializationArtifacts(
    preserveParagraphSoftBreaksAsHardBreaks(afterMarkdownSpaceEntities)
  );

  return {
    input: text,
    afterInternalTightHeadingComments,
    afterHeadingSpacing,
    afterInternalMarkdownBlankLineComments,
    afterSyntheticBlankLines,
    afterCanonicalSpacing,
    afterLenientLineMarkers,
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

function normalizeStandaloneBreakHtmlToMarkdown(text: string): string {
  return mapMarkdownOutsideProtectedSegments(text, (segment) => {
    const lines = segment.split('\n');
    const output: string[] = [];

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index] ?? '';
      const inlineListBreakMatch = INLINE_TERMINAL_LIST_BR_PATTERN.exec(line);
      if (inlineListBreakMatch) {
        output.push((inlineListBreakMatch[1] ?? '').replace(/[ \t]*$/, ''));
        continue;
      }

      const blockquoteBreakMatch = BLOCKQUOTE_STANDALONE_BR_LINE_PATTERN.exec(line);
      if (blockquoteBreakMatch) {
        const prefix = (blockquoteBreakMatch[1] ?? '').trimEnd();
        const previousIndex = output.length - 1;
        const previousLine = previousIndex >= 0 ? output[previousIndex] : null;
        const nextLine = lines[index + 1] ?? '';
        if (
          previousLine !== null
          && previousLine.trim() !== ''
          && nextLine.trim() !== ''
          && nextLine.trimStart().startsWith('>')
        ) {
          output[previousIndex] = previousLine.replace(/[ \t]*$/, '\\');
        } else {
          output.push(prefix);
        }
        continue;
      }

      if (STANDALONE_BR_LINE_PATTERN.test(line)) {
        const previousIndex = output.length - 1;
        const previousLine = previousIndex >= 0 ? output[previousIndex] : null;
        const nextLine = lines[index + 1] ?? '';
        if (previousLine !== null && previousLine.trim() !== '' && nextLine.trim() !== '') {
          output[previousIndex] = previousLine.replace(/[ \t]*$/, '\\');
        } else if (previousLine === null || nextLine.trim() !== '') {
          output.push('');
        }
        continue;
      }

      output.push(line);
    }

    return output.join('\n');
  });
}

function normalizeEditorEmptyParagraphBreaks(text: string): string {
  return mapMarkdownOutsideProtectedSegments(text, (segment) => {
    const lines = segment.split('\n');
    return lines.map((line, index) => {
      if (!BR_ONLY_PATTERN.test(line.trim())) {
        return line;
      }

      if (shouldPreserveEditorBreakLineInListContext(lines, index)) {
        return LIST_GAP_SENTINEL;
      }

      if (index <= 0 || index >= lines.length - 1) {
        return line;
      }

      const previousLine = index > 0 ? lines[index - 1] ?? '' : '';
      const nextLine = index < lines.length - 1 ? lines[index + 1] ?? '' : '';
      return previousLine.trim() !== '' && nextLine.trim() !== '' ? line : null;
    }).filter((line) => line !== null).join('\n');
  });
}

function shouldPreserveEditorBreakLineInListContext(lines: readonly string[], index: number): boolean {
  const line = lines[index] ?? '';
  const match = STANDALONE_BR_LINE_PATTERN.exec(line);
  if (!match) return false;

  const indent = match[1] ?? '';
  if (indent.length === 0) {
    return isBetweenListContextLines(lines, index);
  }

  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const previousLine = lines[cursor] ?? '';
    if (previousLine.trim() === '') continue;
    if (LIST_ITEM_LINE_PATTERN.test(previousLine)) return true;
    if (!previousLine.startsWith(indent)) return false;
  }

  return false;
}

function isBetweenListContextLines(lines: readonly string[], index: number): boolean {
  let previousIsListItem = false;

  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const previousLine = lines[cursor] ?? '';
    if (isListContextSpacerLine(previousLine)) continue;
    previousIsListItem = LIST_ITEM_LINE_PATTERN.test(previousLine);
    break;
  }

  if (!previousIsListItem) return false;

  for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
    const nextLine = lines[cursor] ?? '';
    if (isListContextSpacerLine(nextLine)) continue;
    return LIST_ITEM_LINE_PATTERN.test(nextLine);
  }

  return true;
}

function isListContextSpacerLine(line: string): boolean {
  return line.trim() === '' || STANDALONE_BR_LINE_PATTERN.test(line);
}

function normalizeEditorBreakPlaceholders(text: string): string {
  return mapMarkdownOutsideProtectedBlocks(
    text,
    (line) => {
      const trimmed = line.trim();
      if (INVISIBLE_LIST_GAP_PLACEHOLDER_PATTERN.test(line)) {
        return LIST_GAP_SENTINEL;
      }
      if (EDITABLE_LIST_GAP_PLACEHOLDER_PATTERN.test(line)) {
        return LIST_GAP_SENTINEL;
      }
      if (EDITABLE_LIST_GAP_MARKER_PLACEHOLDER_PATTERN.test(line)) {
        return LIST_GAP_SENTINEL;
      }
      if (INVISIBLE_EMPTY_LINE_PLACEHOLDER_PATTERN.test(line)) {
        return '';
      }
      if (MARKED_EMPTY_LINE_PATTERN.test(trimmed)) {
        return '';
      }
      if (INTERNAL_MARKDOWN_BLANK_LINE_COMMENT_PATTERN.test(line)) {
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
        .replace(MARKED_LIST_GAP_TOKEN_PATTERN, LIST_GAP_SENTINEL)
        .replace(MARKED_EMPTY_LINE_TOKEN_PATTERN, '\n')
        .replace(
          MARKED_BLOCKQUOTE_USER_BR_TOKEN_PATTERN,
          (_match, doubleQuotedDepth: string, singleQuotedDepth: string, unquotedDepth: string) =>
            `\n${getBlockquotePrefix(Number(
              doubleQuotedDepth ?? singleQuotedDepth ?? unquotedDepth
            ))}${USER_BR_SENTINEL}`
        )
        .replace(MARKED_USER_BR_TOKEN_PATTERN, `\n${USER_BR_SENTINEL}\n`);
    },
  );
}

function normalizeInternalMarkdownBlankLineComments(text: string): string {
  if (!text.includes('vlaina-markdown-blank-line')) return text;

  return mapMarkdownOutsideProtectedSegments(
    text,
    (segment) => normalizeInternalMarkdownBlankLineCommentSegment(segment),
    { protectHtmlComments: false },
  );
}

function normalizeInternalMarkdownBlankLineCommentSegment(segment: string): string {
  const lines = segment.split('\n');
  const output: string[] = [];
  let previousWasInternalBlankLine = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (!INTERNAL_MARKDOWN_BLANK_LINE_COMMENT_PATTERN.test(line)) {
      output.push(line);
      if (line.trim() !== '') {
        previousWasInternalBlankLine = false;
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

function hasStructuralBlankAfterImage(lines: readonly string[]): boolean {
  if ((lines[lines.length - 1] ?? '').trim() !== '') return false;

  for (let index = lines.length - 2; index >= 0; index -= 1) {
    const line = lines[index] ?? '';
    if (line.trim() === '') continue;
    return HTML_IMAGE_LINE_PATTERN.test(line) || isMarkdownImageOnlyLine(line);
  }

  return false;
}

function normalizeInternalTightHeadingComments(text: string): string {
  if (!text.includes('vlaina-markdown-tight-heading')) return text;

  return mapMarkdownOutsideProtectedSegments(
    text,
    (segment) => normalizeInternalTightHeadingCommentSegment(segment),
    { protectHtmlComments: false },
  );
}

function normalizeInternalTightHeadingCommentSegment(segment: string): string {
  const lines = segment.split('\n');
  const output: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (!INTERNAL_TIGHT_HEADING_COMMENT_PATTERN.test(line)) {
      output.push(line);
      continue;
    }

    while (output.length > 0 && output[output.length - 1]?.trim() === '') {
      output.pop();
    }

    while (index + 1 < lines.length && (lines[index + 1] ?? '').trim() === '') {
      index += 1;
    }
  }

  return output.join('\n');
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
  if (!text.includes(LIST_GAP_SENTINEL) && !text.includes('\u2800')) {
    return text;
  }

  const normalizedSentinels = text.includes(LIST_GAP_SENTINEL)
    ? mapMarkdownOutsideProtectedSegments(
      text,
      replaceListGapSentinelsWithBlankLines,
    )
    : text;

  return normalizedSentinels.includes('\u2800')
    ? replaceListGapSentinelsWithBlankLines(normalizedSentinels)
    : normalizedSentinels;
}

function replaceListGapSentinelsWithBlankLines(text: string): string {
  const lines = text.split('\n');
  const output: string[] = [];
  let previousWasListGapSentinel = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (line !== LIST_GAP_SENTINEL && !SERIALIZED_EDITABLE_LIST_GAP_PLACEHOLDER_PATTERN.test(line)) {
      output.push(line);
      previousWasListGapSentinel = false;
      continue;
    }

    while (
      !previousWasListGapSentinel
      && output.length > 0
      && output[output.length - 1]?.trim() === ''
    ) {
      output.pop();
    }
    output.push('');
    previousWasListGapSentinel = true;

    while (index + 1 < lines.length && (lines[index + 1] ?? '').trim() === '') {
      index += 1;
    }
  }

  return output.join('\n');
}

function normalizeInternalClipboardArtifacts(text: string): string {
  return normalizeLeakedInternalArtifacts(
    normalizeListItemBlankLines(
      normalizeInternalMarkdownBlankLineComments(normalizeEditorBreakPlaceholders(text))
    )
  )
    .replace(/\n{3,}/g, '\n\n');
}

function normalizeLeakedInternalArtifacts(text: string): string {
  if (!text.includes('VLAINA_') || !text.includes('�')) {
    return text;
  }

  return mapMarkdownOutsideProtectedSegments(text, (segment) =>
    segment
      .replace(LEAKED_LIST_GAP_SENTINEL_WITH_NEWLINES_PATTERN, '\n\n')
      .replace(LEAKED_USER_BR_SENTINEL_PATTERN, USER_BR_SENTINEL)
  );
}

function getBlockquotePrefix(depth: number): string {
  return Array.from({ length: Math.max(0, depth) }, () => '>').join(' ') + (depth > 0 ? ' ' : '');
}

export function normalizeSerializedMarkdownSelection(text: string): string {
  const trimmedText = stripTrailingNewlines(text).trim();
  const isStandaloneBreak =
    isPlainStandaloneBreakLine(trimmedText) || MARKED_BR_ONLY_PATTERN.test(trimmedText);
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

function isPlainStandaloneBreakLine(text: string): boolean {
  if (!BR_ONLY_PATTERN.test(text)) return false;
  return !MARKED_USER_BR_PATTERN.test(text)
    && !MARKED_BLOCKQUOTE_USER_BR_PATTERN.test(text)
    && !MARKED_BLOCKQUOTE_USER_BR_WITH_DEPTH_PATTERN.test(text);
}
