const LINE_ENDING_PATTERN = /\r\n?/g;
const UTF8_BOM = '\uFEFF';
export const FRONTMATTER_DELIMITER = '---';
const MAX_FRONTMATTER_DELIMITER_LINE_CHARS = 1024;
const MAX_FRONTMATTER_CHARS = 256 * 1024;
const MAX_FRONTMATTER_LINES = 2048;
const FRONTMATTER_DELIMITER_PATTERN = /^---[ \t]*$/;

interface FrontmatterSections {
  lines: string[];
  body: string;
  hasFrontmatter: boolean;
}

interface ReadLineResult {
  line: string;
  contentEnd: number;
  nextStart: number;
  truncated: boolean;
}

export function normalizeLineEndings(value: string): string {
  return value.replace(LINE_ENDING_PATTERN, '\n');
}

function stripLeadingBom(value: string): string {
  return value.startsWith(UTF8_BOM) ? value.slice(1) : value;
}

function isFrontmatterDelimiterLine(line: string): boolean {
  return FRONTMATTER_DELIMITER_PATTERN.test(line);
}

function readLine(value: string, start: number, maxContentEnd = value.length): ReadLineResult {
  let index = start;
  while (
    index < value.length &&
    index < maxContentEnd &&
    value[index] !== '\n' &&
    value[index] !== '\r'
  ) {
    index += 1;
  }

  let nextStart = index;
  const truncated = index >= maxContentEnd && index < value.length && value[index] !== '\n' && value[index] !== '\r';
  if (!truncated && index < value.length) {
    nextStart = value[index] === '\r' && value[index + 1] === '\n'
      ? index + 2
      : index + 1;
  }

  return {
    line: value.slice(start, index),
    contentEnd: index,
    nextStart,
    truncated,
  };
}

export function hasTrailingLineEnding(value: string): boolean {
  return value.endsWith('\n') || value.endsWith('\r');
}

export function removeLeadingBlankLine(value: string): string {
  const newlineIndex = value.indexOf('\n');
  const firstLine = newlineIndex >= 0 ? value.slice(0, newlineIndex) : value;
  if (firstLine.trim() !== '') {
    return value;
  }
  return newlineIndex >= 0 ? value.slice(newlineIndex + 1) : '';
}

export function splitLeadingFrontmatter(markdown: string, options?: { includeBody?: boolean }): FrontmatterSections {
  const source = stripLeadingBom(markdown);
  const firstLine = readLine(source, 0, MAX_FRONTMATTER_DELIMITER_LINE_CHARS + 1);

  if (firstLine.truncated || !isFrontmatterDelimiterLine(firstLine.line)) {
    return {
      lines: [],
      body: options?.includeBody ? normalizeLineEndings(source) : '',
      hasFrontmatter: false,
    };
  }

  const lines: string[] = [];
  let cursor = firstLine.nextStart;
  const frontmatterBudgetEnd = firstLine.nextStart + MAX_FRONTMATTER_CHARS + 1;

  while (cursor < source.length && lines.length < MAX_FRONTMATTER_LINES) {
    const line = readLine(source, cursor, frontmatterBudgetEnd);
    if (line.truncated || line.contentEnd - firstLine.nextStart > MAX_FRONTMATTER_CHARS) {
      break;
    }

    if (isFrontmatterDelimiterLine(line.line)) {
      return {
        lines,
        body: options?.includeBody ? normalizeLineEndings(source.slice(line.nextStart)) : '',
        hasFrontmatter: true,
      };
    }

    lines.push(line.line);
    cursor = line.nextStart;
  }

  return {
    lines: [],
    body: options?.includeBody ? normalizeLineEndings(source) : '',
    hasFrontmatter: false,
  };
}

export function parseTopLevelKey(line: string): string | null {
  const match = /^([A-Za-z0-9_-]+)\s*:/.exec(line);
  return match?.[1] ?? null;
}

export function trimTrailingBlankLines(lines: string[]): string[] {
  let end = lines.length;
  while (end > 0 && lines[end - 1]?.trim() === '') {
    end -= 1;
  }
  return lines.slice(0, end);
}

export function parseYamlScalar(rawValue: string): string | number | null {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/\\(["\\])/g, '$1');
  }

  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replace(/''/g, "'");
  }

  const numeric = Number(trimmed);
  if (Number.isFinite(numeric) && trimmed === String(numeric)) {
    return numeric;
  }

  return trimmed;
}

export function quoteInlineFieldValue(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}
