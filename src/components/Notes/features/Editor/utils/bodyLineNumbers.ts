import { preserveMarkdownBlankLinesForEditor } from '@/lib/notes/markdown/markdownEditorBlankLines';
import { parseMermaidFenceLanguage } from '@/components/common/markdown/mermaidLanguage';
import {
  canStartIndentedCodeBlock,
  findFenceEnd,
  findLeadingFrontmatterEnd,
  isAtxHeadingLine,
  isBlank,
  isBlockStart,
  isBodyLineBoundary,
  isFenceClosingLine,
  isFenceStart,
  isHiddenDefinitionLine,
  isIndentedCodeLine,
  isListItemLine,
  isNonNumberedMarkdownBodyLinePlaceholder,
  isNumberedMarkdownBodyLinePlaceholder,
  isSetextHeadingStart,
  isTableSeparatorLine,
  isThematicBreakLine,
  isUnsupportedSelfClosingRawMediaLine,
  normalizeLineEndings,
} from './bodyLineNumberSyntax';
export {
  isInternalMarkdownBodyLinePlaceholder,
  isNonNumberedMarkdownBodyLinePlaceholder,
  isNumberedMarkdownBodyLinePlaceholder,
} from './bodyLineNumberSyntax';

function isBlankAdjacentToUnsupportedSelfClosingRawMedia(lines: readonly string[], index: number): boolean {
  const line = lines[index] ?? '';
  if (!isBlank(line) && !isNumberedMarkdownBodyLinePlaceholder(line)) return false;

  return isUnsupportedSelfClosingRawMediaLine(lines[index - 1] ?? '')
    || isUnsupportedSelfClosingRawMediaLine(lines[index + 1] ?? '');
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

function buildBodySourceLineNumbers(lines: readonly string[], bodyStartIndex: number): Array<number | null> {
  const sourceLineNumbers = new Array<number | null>(lines.length).fill(null);
  let sourceLineNumber = 1;

  for (let index = bodyStartIndex; index < lines.length; index += 1) {
    if (isNonNumberedMarkdownBodyLinePlaceholder(lines[index] ?? '')) {
      continue;
    }

    sourceLineNumbers[index] = sourceLineNumber;
    sourceLineNumber += 1;
  }

  return sourceLineNumbers;
}

function parseTopLevelKey(line: string): string | null {
  const match = /^([A-Za-z0-9_-]+)\s*:/.exec(line);
  return match?.[1] ?? null;
}

function hasOnlyHiddenManagedFrontmatter(lines: readonly string[], frontmatterEnd: number): boolean {
  let hasManagedLine = false;
  for (let index = 1; index < frontmatterEnd; index += 1) {
    const line = lines[index] ?? '';
    if (line.trim() === '') {
      continue;
    }

    const key = parseTopLevelKey(line);
    if (!key?.startsWith('vlaina_')) {
      return false;
    }
    hasManagedLine = true;
  }
  return hasManagedLine;
}

function getBodyStartIndex(lines: readonly string[], frontmatterEnd: number): number {
  if (frontmatterEnd < 0) {
    return 0;
  }

  let bodyStartIndex = frontmatterEnd + 1;
  if (
    hasOnlyHiddenManagedFrontmatter(lines, frontmatterEnd)
    && isBodyLineBoundary(lines[bodyStartIndex] ?? '')
  ) {
    bodyStartIndex += 1;
  }
  return bodyStartIndex;
}

export function getMarkdownBodyLineNumbers(markdown: string): number[] {
  const lines = normalizeLineEndings(preserveMarkdownBlankLinesForEditor(markdown)).split('\n');
  const lineNumbers: number[] = [];
  const frontmatterEnd = findLeadingFrontmatterEnd(lines);
  let index = getBodyStartIndex(lines, frontmatterEnd);
  const sourceLineNumbers = buildBodySourceLineNumbers(lines, index);
  const pushLineNumber = (lineIndex: number) => {
    const sourceLineNumber = sourceLineNumbers[lineIndex];
    if (sourceLineNumber !== null && sourceLineNumber !== undefined) {
      lineNumbers.push(sourceLineNumber);
    }
  };
  const pushLineNumberRange = (startIndex: number, endExclusive: number) => {
    for (let lineIndex = startIndex; lineIndex < endExclusive; lineIndex += 1) {
      pushLineNumber(lineIndex);
    }
  };

  while (index < lines.length) {
    const line = lines[index] ?? '';
    const nextLine = lines[index + 1];

    if (isNumberedMarkdownBodyLinePlaceholder(line)) {
      if (isBlankAdjacentToUnsupportedSelfClosingRawMedia(lines, index)) {
        index += 1;
        continue;
      }
      pushLineNumber(index);
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

    if (isUnsupportedSelfClosingRawMediaLine(line)) {
      index += 1;
      continue;
    }

    if (isHiddenDefinitionLine(line)) {
      index += 1;
      continue;
    }

    if (isFenceStart(line)) {
      const fenceEndIndex = findFenceEnd(lines, index);
      if (parseMermaidFenceLanguage(line) !== null) {
        pushLineNumber(index);
      } else {
        const contentStartIndex = index + 1;
        const contentEndExclusive = isFenceClosingLine(lines, index, fenceEndIndex)
          ? fenceEndIndex
          : fenceEndIndex + 1;
        if (contentEndExclusive > contentStartIndex) {
          pushLineNumberRange(contentStartIndex, contentEndExclusive);
        } else {
          pushLineNumber(index);
        }
      }
      index = fenceEndIndex + 1;
      continue;
    }

    if (isListItemLine(line)) {
      pushLineNumber(index);
      index += 1;
      continue;
    }

    if (isSetextHeadingStart(line, nextLine)) {
      pushLineNumber(index);
      index += 2;
      continue;
    }

    if (canStartIndentedCodeBlock(lines, index)) {
      const codeEndIndex = findIndentedCodeEnd(lines, index);
      pushLineNumberRange(index, codeEndIndex + 1);
      index = codeEndIndex + 1;
      continue;
    }

    if (/^\s{2,}\S/.test(line)) {
      index += 1;
      continue;
    }

    if (/^\s{0,3}>/.test(line)) {
      pushLineNumber(index);
      index = findQuoteEnd(lines, index) + 1;
      continue;
    }

    if (line.includes('|') && nextLine && isTableSeparatorLine(nextLine)) {
      const tableEndIndex = findTableEnd(lines, index);
      pushLineNumber(index);
      pushLineNumberRange(index + 2, tableEndIndex + 1);
      index = tableEndIndex + 1;
      continue;
    }

    pushLineNumber(index);

    if (isAtxHeadingLine(line) || isThematicBreakLine(line)) {
      index += 1;
      continue;
    }

    index = findParagraphEnd(lines, index) + 1;
  }

  return lineNumbers;
}
