import { mapMarkdownOutsideProtectedSegments } from './markdownProtectedBlocks';

const HARD_BREAK_LINE_PATTERN = /(?:\\| {2,})$/;
const MARKDOWN_STRUCTURAL_LINE_PATTERN =
  /^(?:\s*(?:#{1,6}\s+|(?:[-+*]|\d+[.)])\s+|(?:[-*_][ \t]*){3,}|={2,}\s*$|-{2,}\s*$|\|.*\|\s*$|:?-+:?\s*(?:\|\s*:?-+:?\s*)+\|?\s*$))/;
const HTML_LINE_PATTERN = /^(?:\s*<\/?[A-Za-z][^>]*>|\s*<!--|\s*<![A-Za-z]|\s*<\?)/;
const BLOCKQUOTE_LINE_PATTERN = /^(?:\s*>)/;
const DISPLAY_MATH_FENCE_PATTERN = /^\s*\$\$\s*$/;

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
  if (lines[0]?.trim() !== '---') return;

  for (let cursor = 1; cursor < lines.length; cursor += 1) {
    const trimmed = lines[cursor]?.trim();
    if (trimmed !== '---' && trimmed !== '...') continue;

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

  if (openerIndex === null) return;

  for (let index = openerIndex; index < lines.length; index += 1) {
    protectedLines.add(index);
  }
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
