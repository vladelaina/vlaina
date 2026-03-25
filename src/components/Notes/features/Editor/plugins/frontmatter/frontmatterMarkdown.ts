const LINE_ENDING_PATTERN = /\r\n?/g;
const FRONTMATTER_OPEN_PATTERN = /^---[ \t]*$/;
const FRONTMATTER_CLOSE_PATTERN = /^---[ \t]*$/;
const FRONTMATTER_LANGUAGE = 'yaml-frontmatter';
function normalizeLineEndings(value: string): string {
  return value.replace(LINE_ENDING_PATTERN, '\n');
}

export function normalizeLeadingFrontmatterMarkdown(markdown: string): string {
  const normalized = normalizeLineEndings(markdown);
  const lines = normalized.split('\n');
  if (!FRONTMATTER_OPEN_PATTERN.test(lines[0] ?? '')) {
    return normalized;
  }

  let closingIndex = -1;
  for (let index = 1; index < lines.length; index += 1) {
    if (FRONTMATTER_CLOSE_PATTERN.test(lines[index])) {
      closingIndex = index;
      break;
    }
  }

  if (closingIndex < 0) {
    return normalized;
  }

  const frontmatterLines = lines.slice(1, closingIndex);
  const rest = lines.slice(closingIndex + 1);
  const normalizedFrontmatter = [
    `\`\`\`${FRONTMATTER_LANGUAGE}`,
    ...frontmatterLines,
    '```',
  ];

  return normalizedFrontmatter.concat(rest).join('\n');
}

export function serializeLeadingFrontmatterMarkdown(markdown: string): string {
  const normalized = normalizeLineEndings(markdown);
  const lines = normalized.split('\n');
  const openFence = `\`\`\`${FRONTMATTER_LANGUAGE}`;
  if ((lines[0] ?? '').trim() !== openFence) {
    return normalized;
  }

  let closingIndex = -1;
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index].trim() === '```') {
      closingIndex = index;
      break;
    }
  }

  if (closingIndex < 0) {
    return normalized;
  }

  const frontmatterLines = lines.slice(1, closingIndex);
  const rest = lines.slice(closingIndex + 1);
  const serializedFrontmatter = ['---', ...frontmatterLines, '---'];
  return serializedFrontmatter.concat(rest).join('\n');
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
