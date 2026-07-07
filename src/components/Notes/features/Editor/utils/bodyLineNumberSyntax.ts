const LINE_ENDING_PATTERN = /\r\n?/g;
const FENCE_START_PATTERN = /^(\s*)(`{3,}|~{3,})(.*)$/;
const INDENTED_CODE_LINE_PATTERN = /^(?: {4,}|\t)\S/;
const LIST_ITEM_PATTERN = /^\s*(?:[-+*]|\d+[.)])\s+(?:\[[ xX]\]\s+)?\S?/;
const THEMATIC_BREAK_PATTERN = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/;
const SETEXT_HEADING_UNDERLINE_PATTERN = /^\s{0,3}(?:=+|-+)\s*$/;
const TABLE_SEPARATOR_PATTERN = /^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*:?-{3,}:?\s*\|?\s*$/;
const FRONTMATTER_BOUNDARY_PATTERN = /^---[ \t]*$/;
const LINK_REFERENCE_DEFINITION_PATTERN = /^\s{0,3}\[[^\]\n]+]:\s+\S/;
const ABBREVIATION_DEFINITION_PATTERN = /^\s{0,3}\*\[[^\]\n]+]:\s+\S/;
const SELF_CLOSING_RAW_MEDIA_HTML_PATTERN = /^\s{0,3}<(?:video|audio)\b[^>]*\/>\s*$/i;
const INTERNAL_MARKDOWN_BODY_LINE_PLACEHOLDER_PATTERN =
  /^\s*<!--\s*(?:vlaina-markdown-blank-line|vlaina-rendered-html-boundary-blank-line|vlaina-markdown-tight-heading)\s*-->\s*$/i;
const NUMBERED_MARKDOWN_BODY_LINE_PLACEHOLDER_PATTERN =
  /^\s*<!--\s*vlaina-markdown-blank-line\s*-->\s*$/i;
const NON_NUMBERED_MARKDOWN_BODY_LINE_PLACEHOLDER_PATTERN =
  /^\s*<!--\s*(?:vlaina-rendered-html-boundary-blank-line|vlaina-markdown-tight-heading)\s*-->\s*$/i;

export function normalizeLineEndings(value: string): string {
  return value.replace(LINE_ENDING_PATTERN, '\n');
}

export function findLeadingFrontmatterEnd(lines: readonly string[]): number {
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

export function isBlank(line: string): boolean {
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

export function isBodyLineBoundary(line: string): boolean {
  return isBlank(line) || isInternalMarkdownBodyLinePlaceholder(line);
}

export function isFenceStart(line: string): boolean {
  return FENCE_START_PATTERN.test(line);
}

export function isIndentedCodeLine(line: string): boolean {
  return INDENTED_CODE_LINE_PATTERN.test(line);
}

export function isListItemLine(line: string): boolean {
  return LIST_ITEM_PATTERN.test(line);
}

export function isAtxHeadingLine(line: string): boolean {
  return /^\s{0,3}#{1,6}(?:\s|$)/.test(line);
}

export function isThematicBreakLine(line: string): boolean {
  return THEMATIC_BREAK_PATTERN.test(line);
}

export function isTableSeparatorLine(line: string): boolean {
  return TABLE_SEPARATOR_PATTERN.test(line);
}

export function canStartIndentedCodeBlock(lines: readonly string[], index: number): boolean {
  if (!isIndentedCodeLine(lines[index] ?? '')) return false;
  if (index === 0) return true;

  const previousLine = lines[index - 1] ?? '';
  return isBodyLineBoundary(previousLine) || isIndentedCodeLine(previousLine);
}

export function findFenceEnd(lines: readonly string[], startIndex: number): number {
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

export function isFenceClosingLine(lines: readonly string[], startIndex: number, endIndex: number): boolean {
  const match = FENCE_START_PATTERN.exec(lines[startIndex] ?? '');
  if (!match || endIndex <= startIndex) return false;

  const marker = match[2];
  const markerChar = marker[0];
  const closingPattern = new RegExp(`^\\s{0,3}${markerChar}{${marker.length},}\\s*$`);
  return closingPattern.test(lines[endIndex] ?? '');
}

export function isBlockStart(line: string, nextLine?: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (isFenceStart(line)) return true;
  if (isListItemLine(line)) return true;
  if (isAtxHeadingLine(line)) return true;
  if (/^\s{0,3}>/.test(line)) return true;
  if (isThematicBreakLine(line)) return true;
  if (line.includes('|') && nextLine && isTableSeparatorLine(nextLine)) return true;
  return false;
}

export function isSetextHeadingStart(line: string, nextLine?: string): boolean {
  return line.trim().length > 0
    && nextLine !== undefined
    && SETEXT_HEADING_UNDERLINE_PATTERN.test(nextLine);
}

export function isHiddenDefinitionLine(line: string): boolean {
  return LINK_REFERENCE_DEFINITION_PATTERN.test(line)
    || ABBREVIATION_DEFINITION_PATTERN.test(line);
}

export function isUnsupportedSelfClosingRawMediaLine(line: string): boolean {
  return SELF_CLOSING_RAW_MEDIA_HTML_PATTERN.test(line);
}
