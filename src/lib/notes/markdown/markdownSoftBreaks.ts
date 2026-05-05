import { mapMarkdownOutsideProtectedSegments } from './markdownProtectedBlocks';

const HARD_BREAK_LINE_PATTERN = /(?:\\| {2,})$/;
const MARKDOWN_STRUCTURAL_LINE_PATTERN =
  /^(?:\s*(?:#{1,6}\s+|(?:[-+*]|\d+[.)])\s+|(?:[-*_][ \t]*){3,}|={2,}\s*$|-{2,}\s*$|\|.*\|\s*$|:?-+:?\s*(?:\|\s*:?-+:?\s*)+\|?\s*$))/;
const HTML_LINE_PATTERN = /^(?:\s*<\/?[A-Za-z][^>]*>|\s*<!--|\s*<![A-Za-z]|\s*<\?)/;
const BLOCKQUOTE_LINE_PATTERN = /^(?:\s*>)/;
const DISPLAY_MATH_FENCE_PATTERN = /^\s*\$\$\s*$/;

export function preserveParagraphSoftBreaksAsHardBreaks(text: string): string {
  return mapMarkdownOutsideProtectedSegments(text, (segment, startIndex, lines) => {
    const segmentLines = segment.split('\n');
    return segmentLines.map((line, offset) => {
      const absoluteIndex = startIndex + offset;
      const nextLine = lines[absoluteIndex + 1] ?? null;
      if (!shouldPreserveSoftBreakAfterLine(line, nextLine, lines, absoluteIndex)) {
        return line;
      }
      return line.replace(/[ \t]*$/, '\\');
    }).join('\n');
  });
}

function shouldPreserveSoftBreakAfterLine(
  line: string,
  nextLine: string | null,
  lines: readonly string[],
  index: number,
): boolean {
  if (nextLine === null) return false;
  if (isInsideLeadingFrontmatter(lines, index) || isInsideLeadingFrontmatter(lines, index + 1)) return false;
  if (isInsideDisplayMathBlock(lines, index) || isInsideDisplayMathBlock(lines, index + 1)) return false;
  if (line.trim() === '' || nextLine.trim() === '') return false;
  if (HARD_BREAK_LINE_PATTERN.test(line)) return false;
  if (!isPlainParagraphLine(line) || !isPlainParagraphLine(nextLine)) return false;
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

function isInsideLeadingFrontmatter(lines: readonly string[], index: number): boolean {
  if (index < 0 || lines[0]?.trim() !== '---') return false;

  for (let cursor = 1; cursor < lines.length; cursor += 1) {
    const trimmed = lines[cursor]?.trim();
    if (trimmed === '---' || trimmed === '...') {
      return index <= cursor;
    }
  }

  return false;
}

function isInsideDisplayMathBlock(lines: readonly string[], index: number): boolean {
  let openerIndex: number | null = null;
  for (let cursor = 0; cursor < lines.length; cursor += 1) {
    if (!DISPLAY_MATH_FENCE_PATTERN.test(lines[cursor] ?? '')) {
      continue;
    }

    if (openerIndex === null) {
      openerIndex = cursor;
      continue;
    }

    if (index >= openerIndex && index <= cursor) {
      return true;
    }
    openerIndex = null;
  }

  return openerIndex !== null && index >= openerIndex;
}
