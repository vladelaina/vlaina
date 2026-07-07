const UTF8_BOM = '\uFEFF';
const FRONTMATTER_DELIMITER_PATTERN = /^---[ \t]*$/;
const MAX_FRONTMATTER_DELIMITER_LINE_CHARS = 1024;
const MAX_FRONTMATTER_CHARS = 256 * 1024;
const MAX_FRONTMATTER_LINES = 2048;

export function getLeadingFrontmatterEndIndex(lines: readonly string[]): number | null {
  if (!isFrontmatterDelimiterLine(lines[0] ?? '', { allowLeadingBom: true })) {
    return null;
  }

  let frontmatterChars = 0;
  let frontmatterLines = 0;

  for (let index = 1; index < lines.length; index += 1) {
    if (frontmatterLines >= MAX_FRONTMATTER_LINES) {
      return null;
    }

    const line = lines[index] ?? '';
    frontmatterChars += line.length + 1;
    if (frontmatterChars > MAX_FRONTMATTER_CHARS) {
      return null;
    }

    if (isFrontmatterDelimiterLine(line)) {
      return index;
    }

    frontmatterLines += 1;
  }

  return null;
}

function isFrontmatterDelimiterLine(
  line: string,
  options: { allowLeadingBom?: boolean } = {},
): boolean {
  const candidate = options.allowLeadingBom && line.startsWith(UTF8_BOM) ? line.slice(1) : line;
  return candidate.length <= MAX_FRONTMATTER_DELIMITER_LINE_CHARS && FRONTMATTER_DELIMITER_PATTERN.test(candidate);
}
