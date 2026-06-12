import { mapMarkdownOutsideProtectedSegments } from './markdownProtectedBlocks';

const HARD_BREAK_LINE_PATTERN = /(?:\\| {2,})$/;
const UTF8_BOM = '\uFEFF';
const FRONTMATTER_OPEN_DELIMITER_PATTERN = /^---[ \t]*$/;
const FRONTMATTER_CLOSE_DELIMITER_PATTERN = /^(?:---|\.\.\.)[ \t]*$/;
const MARKDOWN_STRUCTURAL_LINE_PATTERN =
  /^(?:\s*(?:#{1,6}\s+|(?:[-+*]|\d+[.)])\s+|(?:[-*_][ \t]*){3,}|={2,}\s*$|-{2,}\s*$|\|.*\|\s*$|:?-+:?\s*(?:\|\s*:?-+:?\s*)+\|?\s*$))/;
const HTML_LINE_PATTERN = /^(?:\s*<\/?[A-Za-z][^>]*>|\s*<!--|\s*<![A-Za-z]|\s*<\?)/;
const BLOCKQUOTE_LINE_PATTERN = /^(?:\s*>)/;
const LIST_ITEM_CONTENT_LINE_PATTERN =
  /^\s*(?:>\s*)*(?:[-+*]|\d+[.)])\s+(?:\[(?: |x|X)\]\s+)?\S/;
const LIST_CONTINUATION_LINE_PATTERN = /^\s*(?:>\s*)+(?: {2,}|\t)\S|^(?: {2,}|\t)\S/;
const LIST_MARKER_ONLY_LINE_PATTERN =
  /^\s*(?:>\s*)*(?:[-+*]|\d+[.)])\s*(?:\[(?: |x|X)\]\s*)?$/;
const DISPLAY_MATH_FENCE_PATTERN = /^\s*\$\$\s*$/;
const ALTERNATIVE_MATH_BLOCK_OPEN_PATTERN = /^(\s*(?:>\s*)*)((?:\\+\[\\?)|\[\\?|\[)\s*$/;
const ALTERNATIVE_MATH_BLOCK_STANDARD_CLOSE_PATTERN = /^(\s*(?:>\s*)*)\\\]\s*$/;
const ALTERNATIVE_MATH_BLOCK_BRACKET_CLOSE_PATTERN = /^(\s*(?:>\s*)*)]\s*$/;
const ALTERNATIVE_MATH_BLOCK_STANDARD_CLOSE_SUFFIX_PATTERN = /^(.*)\\\]\s*$/;
const ALTERNATIVE_MATH_BLOCK_BRACKET_CLOSE_SUFFIX_PATTERN = /^(.*)]\s*$/;
const LATEX_LIKE_MATH_CONTENT_PATTERN = /\\[A-Za-z]+|(?:^|[^\w])(?:\\?[A-Za-z]\w*)\s*(?:[=^_]|\\(?:le|ge|neq|approx|times|cdot|frac|sqrt|mu|alpha|beta|gamma|theta)\b)|[{}^_]/;

export function preserveParagraphSoftBreaksAsHardBreaks(text: string): string {
  const allLines = text.replace(/\r\n?/g, '\n').split('\n');
  const protectedLines = getSoftBreakProtectedLines(allLines);

  return mapMarkdownOutsideProtectedSegments(text, (segment, startIndex, lines) => {
    const segmentLines = segment.split('\n');
    return segmentLines.map((line, offset) => {
      const absoluteIndex = startIndex + offset;
      const nextLine = lines[absoluteIndex + 1] ?? null;
      if (!shouldPreserveSoftBreakAfterLine(line, nextLine, protectedLines, absoluteIndex)) {
        return line;
      }
      return line.replace(/[ \t]*$/, '\\');
    }).join('\n');
  });
}

function getSoftBreakProtectedLines(lines: readonly string[]): Set<number> {
  const protectedLines = new Set<number>();
  markLeadingFrontmatterLines(lines, protectedLines);
  markDisplayMathBlockLines(lines, protectedLines);
  return protectedLines;
}

function markLeadingFrontmatterLines(lines: readonly string[], protectedLines: Set<number>) {
  const firstLine = lines[0]?.startsWith(UTF8_BOM) ? lines[0].slice(1) : lines[0];
  if (!FRONTMATTER_OPEN_DELIMITER_PATTERN.test(firstLine ?? '')) return;

  for (let cursor = 1; cursor < lines.length; cursor += 1) {
    if (!FRONTMATTER_CLOSE_DELIMITER_PATTERN.test(lines[cursor] ?? '')) continue;

    for (let index = 0; index <= cursor; index += 1) {
      protectedLines.add(index);
    }
    return;
  }
}

function markDisplayMathBlockLines(lines: readonly string[], protectedLines: Set<number>) {
  let openerIndex: number | null = null;

  for (let cursor = 0; cursor < lines.length; cursor += 1) {
    if (!DISPLAY_MATH_FENCE_PATTERN.test(lines[cursor] ?? '')) {
      continue;
    }

    if (openerIndex === null) {
      openerIndex = cursor;
      continue;
    }

    for (let index = openerIndex; index <= cursor; index += 1) {
      protectedLines.add(index);
    }
    openerIndex = null;
  }

  if (openerIndex === null) {
    markAlternativeDisplayMathBlockLines(lines, protectedLines);
    return;
  }

  for (let index = openerIndex; index < lines.length; index += 1) {
    protectedLines.add(index);
  }

  markAlternativeDisplayMathBlockLines(lines, protectedLines);
}

function markAlternativeDisplayMathBlockLines(lines: readonly string[], protectedLines: Set<number>) {
  let pendingFence: {
    openerIndex: number;
    prefix: string;
    bracketCloseFence: boolean;
    bracketOnlyFence: boolean;
    hasLatexLikeContent: boolean;
  } | null = null;

  for (let cursor = 0; cursor < lines.length; cursor += 1) {
    const line = lines[cursor] ?? '';
    if (pendingFence) {
      const close = getAlternativeMathBlockClose(line, pendingFence);
      if (
        close
        && (!pendingFence.bracketOnlyFence
          || pendingFence.hasLatexLikeContent
          || (close.contentLine !== null && isLatexLikeMathLine(close.contentLine)))
      ) {
        for (let index = pendingFence.openerIndex; index <= cursor; index += 1) {
          protectedLines.add(index);
        }
        pendingFence = null;
        continue;
      }

      if (!pendingFence.hasLatexLikeContent && isLatexLikeMathLine(line)) {
        pendingFence.hasLatexLikeContent = true;
      }
      continue;
    }

    const open = ALTERNATIVE_MATH_BLOCK_OPEN_PATTERN.exec(line);
    if (!open) continue;

    pendingFence = {
      openerIndex: cursor,
      prefix: open[1] ?? '',
      bracketCloseFence: isAlternativeMathBlockBracketCloseFence(open[2] ?? ''),
      bracketOnlyFence: line.trim() === '[',
      hasLatexLikeContent: false,
    };
  }
}

function getAlternativeMathBlockClose(
  line: string,
  pendingFence: { prefix: string; bracketCloseFence: boolean; bracketOnlyFence: boolean }
): { contentLine: string | null } | null {
  const standardClose = ALTERNATIVE_MATH_BLOCK_STANDARD_CLOSE_PATTERN.exec(line);
  if (standardClose && (standardClose[1] ?? '') === pendingFence.prefix) {
    return { contentLine: null };
  }

  const canUseBracketClose = pendingFence.bracketCloseFence || pendingFence.bracketOnlyFence;
  const bracketClose = canUseBracketClose
    ? ALTERNATIVE_MATH_BLOCK_BRACKET_CLOSE_PATTERN.exec(line)
    : null;
  if (bracketClose && (bracketClose[1] ?? '') === pendingFence.prefix) {
    return { contentLine: null };
  }

  const standardSuffix = ALTERNATIVE_MATH_BLOCK_STANDARD_CLOSE_SUFFIX_PATTERN.exec(line);
  if (standardSuffix && hasAlternativeMathInlineCloseContent(standardSuffix[1] ?? '', pendingFence.prefix)) {
    return { contentLine: standardSuffix[1] ?? '' };
  }

  const bracketSuffix = canUseBracketClose
    ? ALTERNATIVE_MATH_BLOCK_BRACKET_CLOSE_SUFFIX_PATTERN.exec(line)
    : null;
  if (bracketSuffix && hasAlternativeMathInlineCloseContent(bracketSuffix[1] ?? '', pendingFence.prefix)) {
    return { contentLine: bracketSuffix[1] ?? '' };
  }

  return null;
}

function hasAlternativeMathInlineCloseContent(contentLine: string, prefix: string): boolean {
  if (prefix && !contentLine.startsWith(prefix)) return false;
  return contentLine.slice(prefix.length).trim().length > 0;
}

function isLatexLikeMathLine(line: string): boolean {
  return LATEX_LIKE_MATH_CONTENT_PATTERN.test(line);
}

function isAlternativeMathBlockBracketCloseFence(marker: string): boolean {
  return marker === '[' || marker.endsWith('\\');
}

function shouldPreserveSoftBreakAfterLine(
  line: string,
  nextLine: string | null,
  protectedLines: Set<number>,
  index: number,
): boolean {
  if (nextLine === null) return false;
  if (protectedLines.has(index) || protectedLines.has(index + 1)) return false;
  if (line.trim() === '' || nextLine.trim() === '') return false;
  if (HARD_BREAK_LINE_PATTERN.test(line)) return false;
  if (isListItemSoftBreakLine(line, nextLine)) return true;
  if (!isPlainParagraphLine(line) || !isPlainParagraphLine(nextLine)) return false;
  return true;
}

function isListItemSoftBreakLine(line: string, nextLine: string): boolean {
  if (!LIST_ITEM_CONTENT_LINE_PATTERN.test(line)) return false;
  if (!LIST_CONTINUATION_LINE_PATTERN.test(nextLine)) return false;
  if (LIST_MARKER_ONLY_LINE_PATTERN.test(nextLine)) return false;
  if (!isPlainParagraphLine(nextLine)) return false;
  return true;
}

function isPlainParagraphLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0) return false;
  if (BLOCKQUOTE_LINE_PATTERN.test(line)) return false;
  if (MARKDOWN_STRUCTURAL_LINE_PATTERN.test(line)) return false;
  if (HTML_LINE_PATTERN.test(line)) return false;
  return true;
}
