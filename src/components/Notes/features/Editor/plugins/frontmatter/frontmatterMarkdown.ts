const LINE_ENDING_PATTERN = /\r\n?/g;
const FRONTMATTER_OPEN_PATTERN = /^---[ \t]*$/;
const FRONTMATTER_CLOSE_PATTERN = /^---[ \t]*$/;
const FRONTMATTER_LANGUAGE = 'yaml-frontmatter';
const MAX_FRONTMATTER_DELIMITER_LINE_CHARS = 1024;
const MAX_FRONTMATTER_CHARS = 256 * 1024;
const MAX_FRONTMATTER_LINES = 2048;
const MANAGED_FRONTMATTER_PREFIX = 'vlaina_';

function normalizeLineEndings(value: string): string {
  return value.replace(LINE_ENDING_PATTERN, '\n');
}

interface FrontmatterSections {
  frontmatterLines: string[];
  body: string;
  hasBodySeparator: boolean;
}

interface ReadLineResult {
  line: string;
  contentEnd: number;
  nextStart: number;
  truncated: boolean;
}

function parseTopLevelKey(line: string): string | null {
  const match = /^([A-Za-z0-9_-]+)\s*:/.exec(line);
  return match?.[1] ?? null;
}

function isManagedFrontmatterLine(line: string): boolean {
  const key = parseTopLevelKey(line);
  return Boolean(key && key.startsWith(MANAGED_FRONTMATTER_PREFIX));
}

function trimTrailingBlankLines(lines: string[]): string[] {
  let end = lines.length;
  while (end > 0 && lines[end - 1]?.trim() === '') {
    end -= 1;
  }
  return lines.slice(0, end);
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

function removeSerializedFrontmatterPadding(body: string): string {
  const newlineIndex = body.indexOf('\n');
  const firstLine = newlineIndex >= 0 ? body.slice(0, newlineIndex) : body;
  if (firstLine.trim() !== '') {
    return body;
  }
  return newlineIndex >= 0 ? body.slice(newlineIndex + 1) : '';
}

function splitLeadingDelimitedBlock(
  markdown: string,
  isOpeningLine: (line: string) => boolean,
  isClosingLine: (line: string) => boolean,
): FrontmatterSections | null {
  const firstLine = readLine(markdown, 0, MAX_FRONTMATTER_DELIMITER_LINE_CHARS + 1);
  if (firstLine.truncated || !isOpeningLine(firstLine.line)) {
    return null;
  }

  const frontmatterLines: string[] = [];
  let cursor = firstLine.nextStart;
  const frontmatterBudgetEnd = firstLine.nextStart + MAX_FRONTMATTER_CHARS + 1;

  while (cursor < markdown.length && frontmatterLines.length < MAX_FRONTMATTER_LINES) {
    const line = readLine(markdown, cursor, frontmatterBudgetEnd);
    if (line.truncated || line.contentEnd - firstLine.nextStart > MAX_FRONTMATTER_CHARS) {
      break;
    }

    if (isClosingLine(line.line)) {
      return {
        frontmatterLines,
        body: normalizeLineEndings(markdown.slice(line.nextStart)),
        hasBodySeparator: line.nextStart > line.contentEnd,
      };
    }

    frontmatterLines.push(line.line);
    cursor = line.nextStart;
  }

  return null;
}

function splitLeadingFrontmatter(markdown: string): FrontmatterSections | null {
  return splitLeadingDelimitedBlock(
    markdown,
    (line) => FRONTMATTER_OPEN_PATTERN.test(line),
    (line) => FRONTMATTER_CLOSE_PATTERN.test(line),
  );
}

function splitLeadingInternalFrontmatter(markdown: string): FrontmatterSections | null {
  const openFence = `\`\`\`${FRONTMATTER_LANGUAGE}`;
  return splitLeadingDelimitedBlock(
    markdown,
    (line) => line.trim() === openFence,
    (line) => line.trim() === '```',
  );
}

function buildFrontmatterBlock(
  frontmatterLines: string[],
  body: string,
  fenced: boolean,
  options?: { preserveEmpty?: boolean; preserveBodySeparator?: boolean }
): string {
  if (frontmatterLines.length === 0 && !options?.preserveEmpty) {
    return body;
  }

  const opening = fenced ? `\`\`\`${FRONTMATTER_LANGUAGE}` : '---';
  const closing = fenced ? '```' : '---';
  const frontmatter = [opening, ...frontmatterLines, closing].join('\n');

  return body || options?.preserveBodySeparator ? `${frontmatter}\n${body}` : frontmatter;
}

export function normalizeLeadingFrontmatterMarkdown(markdown: string): string {
  const sections = splitLeadingFrontmatter(markdown);
  if (!sections) {
    return normalizeLineEndings(markdown);
  }

  const hasHiddenFrontmatterLines = sections.frontmatterLines.some((line) => isManagedFrontmatterLine(line));
  const visibleFrontmatterLines = sections.frontmatterLines.filter((line) => !isManagedFrontmatterLine(line));
  const normalizedVisibleFrontmatterLines = hasHiddenFrontmatterLines
    ? trimTrailingBlankLines(visibleFrontmatterLines)
    : visibleFrontmatterLines;

  return buildFrontmatterBlock(normalizedVisibleFrontmatterLines, sections.body, true, {
    preserveEmpty: !hasHiddenFrontmatterLines,
    preserveBodySeparator: sections.hasBodySeparator,
  });
}

export function serializeLeadingFrontmatterMarkdown(markdown: string, referenceMarkdown?: string): string {
  const normalized = normalizeLineEndings(markdown);
  const referenceSections = referenceMarkdown ? splitLeadingFrontmatter(referenceMarkdown) : null;
  const hiddenFrontmatterLines = referenceSections
    ? referenceSections.frontmatterLines.filter((line) => isManagedFrontmatterLine(line))
    : [];
  const sections = splitLeadingInternalFrontmatter(markdown);

  if (!sections) {
    return hiddenFrontmatterLines.length > 0
      ? buildFrontmatterBlock(hiddenFrontmatterLines, normalized, false, { preserveBodySeparator: true })
      : normalized;
  }

  const visibleFrontmatterLines = sections.frontmatterLines.filter((line) => !isManagedFrontmatterLine(line));
  const mergedFrontmatterLines =
    visibleFrontmatterLines.length > 0 && hiddenFrontmatterLines.length > 0
      ? [...visibleFrontmatterLines, '', ...hiddenFrontmatterLines]
      : [...visibleFrontmatterLines, ...hiddenFrontmatterLines];

  return buildFrontmatterBlock(
    mergedFrontmatterLines,
    removeSerializedFrontmatterPadding(sections.body),
    false,
    { preserveEmpty: true, preserveBodySeparator: sections.hasBodySeparator }
  );
}

export function isFrontmatterShortcutText(text: string): boolean {
  return text.trim() === '---';
}

export function isFrontmatterFenceLanguage(language: unknown): boolean {
  return typeof language === 'string' && language.trim().toLowerCase() === FRONTMATTER_LANGUAGE;
}

export function getFrontmatterFenceLanguage(): string {
  return FRONTMATTER_LANGUAGE;
}
