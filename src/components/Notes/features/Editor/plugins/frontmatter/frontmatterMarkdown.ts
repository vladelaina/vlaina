const LINE_ENDING_PATTERN = /\r\n?/g;
const FRONTMATTER_OPEN_PATTERN = /^---[ \t]*$/;
const FRONTMATTER_CLOSE_PATTERN = /^---[ \t]*$/;
const FRONTMATTER_LANGUAGE = 'yaml-frontmatter';
const VLAINA_PREFIX = 'vlaina_';

function normalizeLineEndings(value: string): string {
  return value.replace(LINE_ENDING_PATTERN, '\n');
}

interface FrontmatterSections {
  frontmatterLines: string[];
  bodyLines: string[];
}

function parseTopLevelKey(line: string): string | null {
  const match = /^([A-Za-z0-9_-]+)\s*:/.exec(line);
  return match?.[1] ?? null;
}

function isVlainaFrontmatterLine(line: string): boolean {
  const key = parseTopLevelKey(line);
  return Boolean(key && key.startsWith(VLAINA_PREFIX));
}

function splitLeadingFrontmatter(markdown: string): FrontmatterSections | null {
  const normalized = normalizeLineEndings(markdown);
  const lines = normalized.split('\n');
  if (!FRONTMATTER_OPEN_PATTERN.test(lines[0] ?? '')) {
    return null;
  }

  let closingIndex = -1;
  for (let index = 1; index < lines.length; index += 1) {
    if (FRONTMATTER_CLOSE_PATTERN.test(lines[index])) {
      closingIndex = index;
      break;
    }
  }

  if (closingIndex < 0) {
    return null;
  }

  return {
    frontmatterLines: lines.slice(1, closingIndex),
    bodyLines: lines.slice(closingIndex + 1),
  };
}

function buildFrontmatterBlock(frontmatterLines: string[], bodyLines: string[], fenced: boolean): string {
  if (frontmatterLines.length === 0) {
    return bodyLines.join('\n');
  }

  const opening = fenced ? `\`\`\`${FRONTMATTER_LANGUAGE}` : '---';
  const closing = fenced ? '```' : '---';

  return [opening, ...frontmatterLines, closing, ...bodyLines].join('\n');
}

export function normalizeLeadingFrontmatterMarkdown(markdown: string): string {
  const sections = splitLeadingFrontmatter(markdown);
  if (!sections) {
    return normalizeLineEndings(markdown);
  }

  const visibleFrontmatterLines = sections.frontmatterLines.filter((line) => !isVlainaFrontmatterLine(line));

  return buildFrontmatterBlock(visibleFrontmatterLines, sections.bodyLines, true);
}

export function serializeLeadingFrontmatterMarkdown(markdown: string, referenceMarkdown?: string): string {
  const normalized = normalizeLineEndings(markdown);
  const lines = normalized.split('\n');
  const openFence = `\`\`\`${FRONTMATTER_LANGUAGE}`;
  const referenceSections = referenceMarkdown ? splitLeadingFrontmatter(referenceMarkdown) : null;
  const hiddenFrontmatterLines = referenceSections
    ? referenceSections.frontmatterLines.filter((line) => isVlainaFrontmatterLine(line))
    : [];

  if ((lines[0] ?? '').trim() !== openFence) {
    return hiddenFrontmatterLines.length > 0
      ? buildFrontmatterBlock(hiddenFrontmatterLines, lines, false)
      : normalized;
  }

  let closingIndex = -1;
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index].trim() === '```') {
      closingIndex = index;
      break;
    }
  }

  if (closingIndex < 0) {
    return hiddenFrontmatterLines.length > 0
      ? buildFrontmatterBlock(hiddenFrontmatterLines, lines, false)
      : normalized;
  }

  const frontmatterLines = lines.slice(1, closingIndex);
  const visibleFrontmatterLines = frontmatterLines.filter((line) => !isVlainaFrontmatterLine(line));
  const mergedFrontmatterLines =
    visibleFrontmatterLines.length > 0 && hiddenFrontmatterLines.length > 0
      ? [...visibleFrontmatterLines, '', ...hiddenFrontmatterLines]
      : [...visibleFrontmatterLines, ...hiddenFrontmatterLines];

  return buildFrontmatterBlock(mergedFrontmatterLines, lines.slice(closingIndex + 1), false);
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
