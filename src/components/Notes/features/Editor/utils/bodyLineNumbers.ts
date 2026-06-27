import { preserveMarkdownBlankLinesForEditor } from '@/lib/notes/markdown/markdownEditorBlankLines';
import { parseMermaidFenceLanguage } from '@/components/common/markdown/mermaidLanguage';
const LINE_ENDING_PATTERN = /\r\n?/g;
const FENCE_START_PATTERN = /^(\s*)(`{3,}|~{3,})(.*)$/;
const INDENTED_CODE_LINE_PATTERN = /^(?: {4,}|\t)\S/;
const LIST_ITEM_PATTERN = /^\s*(?:[-+*]|\d+[.)])\s+(?:\[[ xX]\]\s+)?\S?/;
const THEMATIC_BREAK_PATTERN = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/;
const TABLE_SEPARATOR_PATTERN = /^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*:?-{3,}:?\s*\|?\s*$/;
const FRONTMATTER_BOUNDARY_PATTERN = /^---[ \t]*$/;
const INTERNAL_MARKDOWN_BODY_LINE_PLACEHOLDER_PATTERN =
  /^\s*<!--\s*(?:vlaina-markdown-blank-line|vlaina-rendered-html-boundary-blank-line|vlaina-markdown-tight-heading)\s*-->\s*$/i;
const NUMBERED_MARKDOWN_BODY_LINE_PLACEHOLDER_PATTERN =
  /^\s*<!--\s*(?:vlaina-markdown-blank-line|vlaina-rendered-html-boundary-blank-line)\s*-->\s*$/i;
const NON_NUMBERED_MARKDOWN_BODY_LINE_PLACEHOLDER_PATTERN =
  /^\s*<!--\s*vlaina-markdown-tight-heading\s*-->\s*$/i;

function normalizeLineEndings(value: string): string {
  return value.replace(LINE_ENDING_PATTERN, '\n');
}

function findLeadingFrontmatterEnd(lines: readonly string[]): number {
  if (!FRONTMATTER_BOUNDARY_PATTERN.test(lines[0] ?? '')) {
    return -1;
  }

  for (let index = 1; index < lines.length; index += 1) {
    if (FRONTMATTER_BOUNDARY_PATTERN.test(lines[index] ?? '')) {
      return index;
    }
  }

  return -1;
}

function isBlank(line: string): boolean {
  return line.trim().length === 0;
}

export function isInternalMarkdownBodyLinePlaceholder(line: string): boolean {
  return INTERNAL_MARKDOWN_BODY_LINE_PLACEHOLDER_PATTERN.test(line);
}

export function isNumberedMarkdownBodyLinePlaceholder(line: string): boolean {
  return NUMBERED_MARKDOWN_BODY_LINE_PLACEHOLDER_PATTERN.test(line);
}

export function isNonNumberedMarkdownBodyLinePlaceholder(line: string): boolean {
  return NON_NUMBERED_MARKDOWN_BODY_LINE_PLACEHOLDER_PATTERN.test(line);
}

function isBodyLineBoundary(line: string): boolean {
  return isBlank(line) || isInternalMarkdownBodyLinePlaceholder(line);
}

function isFenceStart(line: string): boolean {
  return FENCE_START_PATTERN.test(line);
}

function isIndentedCodeLine(line: string): boolean {
  return INDENTED_CODE_LINE_PATTERN.test(line);
}

function canStartIndentedCodeBlock(lines: readonly string[], index: number): boolean {
  if (!isIndentedCodeLine(lines[index] ?? '')) return false;
  if (index === 0) return true;

  const previousLine = lines[index - 1] ?? '';
  return isBodyLineBoundary(previousLine) || isIndentedCodeLine(previousLine);
}

function findFenceEnd(lines: readonly string[], startIndex: number): number {
  const match = FENCE_START_PATTERN.exec(lines[startIndex] ?? '');
  if (!match) return startIndex;

  const marker = match[2];
  const markerChar = marker[0];
  const closingPattern = new RegExp(`^\\s{0,3}${markerChar}{${marker.length},}\\s*$`);

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    if (closingPattern.test(lines[index] ?? '')) {
      return index;
    }
  }

  return lines.length - 1;
}

function isFenceClosingLine(lines: readonly string[], startIndex: number, endIndex: number): boolean {
  const match = FENCE_START_PATTERN.exec(lines[startIndex] ?? '');
  if (!match || endIndex <= startIndex) return false;

  const marker = match[2];
  const markerChar = marker[0];
  const closingPattern = new RegExp(`^\\s{0,3}${markerChar}{${marker.length},}\\s*$`);
  return closingPattern.test(lines[endIndex] ?? '');
}

function countFenceContentLines(lines: readonly string[], startIndex: number, endIndex: number): number {
  const contentStartIndex = startIndex + 1;
  const contentEndExclusive = isFenceClosingLine(lines, startIndex, endIndex)
    ? endIndex
    : endIndex + 1;
  return Math.max(1, contentEndExclusive - contentStartIndex);
}

function isBlockStart(line: string, nextLine?: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (isFenceStart(line)) return true;
  if (LIST_ITEM_PATTERN.test(line)) return true;
  if (/^\s{0,3}#{1,6}(?:\s|$)/.test(line)) return true;
  if (/^\s{0,3}>/.test(line)) return true;
  if (THEMATIC_BREAK_PATTERN.test(line)) return true;
  if (line.includes('|') && nextLine && TABLE_SEPARATOR_PATTERN.test(nextLine)) return true;
  return false;
}

function findParagraphEnd(lines: readonly string[], startIndex: number): number {
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    if (isBodyLineBoundary(lines[index] ?? '')) {
      return index - 1;
    }

    if (isBlockStart(lines[index] ?? '', lines[index + 1])) {
      return index - 1;
    }
  }

  return lines.length - 1;
}

function findQuoteEnd(lines: readonly string[], startIndex: number): number {
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (isBodyLineBoundary(line) || !/^\s{0,3}>/.test(line)) {
      return index - 1;
    }
  }

  return lines.length - 1;
}

function findIndentedCodeEnd(lines: readonly string[], startIndex: number): number {
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (isBodyLineBoundary(line) || !isIndentedCodeLine(line)) {
      return index - 1;
    }
  }

  return lines.length - 1;
}

function findTableEnd(lines: readonly string[], startIndex: number): number {
  for (let index = startIndex + 2; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (isBodyLineBoundary(line) || !line.includes('|')) {
      return index - 1;
    }
  }

  return lines.length - 1;
}

export function getMarkdownBodyLineNumbers(markdown: string): number[] {
  const lines = normalizeLineEndings(preserveMarkdownBlankLinesForEditor(markdown)).split('\n');
  const lineNumbers: number[] = [];
  const frontmatterEnd = findLeadingFrontmatterEnd(lines);
  let index = frontmatterEnd >= 0 ? frontmatterEnd + 1 : 0;
  const pushNextLineNumber = () => {
    lineNumbers.push(lineNumbers.length + 1);
  };
  const pushBodyLineNumbers = (count: number) => {
    for (let offset = 0; offset < count; offset += 1) {
      pushNextLineNumber();
    }
  };

  while (index < lines.length) {
    const line = lines[index] ?? '';
    const nextLine = lines[index + 1];

    if (isNumberedMarkdownBodyLinePlaceholder(line)) {
      pushNextLineNumber();
      index += 1;
      continue;
    }

    if (isNonNumberedMarkdownBodyLinePlaceholder(line)) {
      index += 1;
      continue;
    }

    if (isBodyLineBoundary(line)) {
      index += 1;
      continue;
    }

    if (isFenceStart(line)) {
      const fenceEndIndex = findFenceEnd(lines, index);
      if (parseMermaidFenceLanguage(line) !== null) {
        pushNextLineNumber();
      } else {
        pushBodyLineNumbers(countFenceContentLines(lines, index, fenceEndIndex));
      }
      index = fenceEndIndex + 1;
      continue;
    }

    if (LIST_ITEM_PATTERN.test(line)) {
      pushNextLineNumber();
      index += 1;
      continue;
    }

    if (canStartIndentedCodeBlock(lines, index)) {
      const codeEndIndex = findIndentedCodeEnd(lines, index);
      pushBodyLineNumbers(codeEndIndex - index + 1);
      index = codeEndIndex + 1;
      continue;
    }

    if (/^\s{2,}\S/.test(line)) {
      index += 1;
      continue;
    }

    if (/^\s{0,3}>/.test(line)) {
      pushNextLineNumber();
      index = findQuoteEnd(lines, index) + 1;
      continue;
    }

    if (line.includes('|') && nextLine && TABLE_SEPARATOR_PATTERN.test(nextLine)) {
      pushNextLineNumber();
      index = findTableEnd(lines, index) + 1;
      continue;
    }

    pushNextLineNumber();

    if (/^\s{0,3}#{1,6}(?:\s|$)/.test(line) || THEMATIC_BREAK_PATTERN.test(line)) {
      index += 1;
      continue;
    }

    index = findParagraphEnd(lines, index) + 1;
  }

  return lineNumbers;
}
