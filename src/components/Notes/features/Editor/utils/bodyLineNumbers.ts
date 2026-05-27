const LINE_ENDING_PATTERN = /\r\n?/g;
const FENCE_START_PATTERN = /^(\s*)(`{3,}|~{3,})(.*)$/;
const LIST_ITEM_PATTERN = /^\s*(?:[-+*]|\d+[.)])\s+(?:\[[ xX]\]\s+)?\S?/;
const THEMATIC_BREAK_PATTERN = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/;
const TABLE_SEPARATOR_PATTERN = /^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*:?-{3,}:?\s*\|?\s*$/;
const FRONTMATTER_BOUNDARY_PATTERN = /^---[ \t]*$/;

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

function isFenceStart(line: string): boolean {
  return FENCE_START_PATTERN.test(line);
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
    if (isBlank(lines[index] ?? '')) {
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
    if (isBlank(line) || !/^\s{0,3}>/.test(line)) {
      return index - 1;
    }
  }

  return lines.length - 1;
}

function findTableEnd(lines: readonly string[], startIndex: number): number {
  for (let index = startIndex + 2; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (isBlank(line) || !line.includes('|')) {
      return index - 1;
    }
  }

  return lines.length - 1;
}

export function getMarkdownBodySourceLineNumbers(markdown: string): number[] {
  const lines = normalizeLineEndings(markdown).split('\n');
  const lineNumbers: number[] = [];
  const frontmatterEnd = findLeadingFrontmatterEnd(lines);
  let index = frontmatterEnd >= 0 ? frontmatterEnd + 1 : 0;

  while (index < lines.length) {
    const line = lines[index] ?? '';
    const nextLine = lines[index + 1];

    if (isBlank(line)) {
      index += 1;
      continue;
    }

    if (isFenceStart(line)) {
      index = findFenceEnd(lines, index) + 1;
      continue;
    }

    if (LIST_ITEM_PATTERN.test(line)) {
      lineNumbers.push(index + 1);
      index += 1;
      continue;
    }

    if (/^\s{2,}\S/.test(line)) {
      index += 1;
      continue;
    }

    if (/^\s{0,3}>/.test(line)) {
      lineNumbers.push(index + 1);
      index = findQuoteEnd(lines, index) + 1;
      continue;
    }

    if (line.includes('|') && nextLine && TABLE_SEPARATOR_PATTERN.test(nextLine)) {
      lineNumbers.push(index + 1);
      index = findTableEnd(lines, index) + 1;
      continue;
    }

    lineNumbers.push(index + 1);

    if (/^\s{0,3}#{1,6}(?:\s|$)/.test(line) || THEMATIC_BREAK_PATTERN.test(line)) {
      index += 1;
      continue;
    }

    index = findParagraphEnd(lines, index) + 1;
  }

  return lineNumbers;
}
