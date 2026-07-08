interface SetextHeading {
  key: string;
  raw: [string, string];
}

const SETEXT_HEADING_UNDERLINE_PATTERN = /^(?: {0,3})(=+|-+)[ \t]*$/;
const ATX_HEADING_PATTERN = /^( {0,3})(#{1,6})[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*$/;
const CLOSED_ATX_HEADING_PATTERN = /^(?: {0,3})(#{1,6})[ \t]+(.+?)[ \t]+#+[ \t]*$/;
const FRONTMATTER_DELIMITER_PATTERN = /^---[ \t]*$/;

export function restoreSetextHeadingStyleFromReference(
  markdown: string,
  referenceMarkdown?: string,
): string {
  if (!referenceMarkdown || !markdown.includes('#')) return markdown;

  const referenceHeadings = collectSetextHeadings(referenceMarkdown.replace(/\r\n?/g, '\n').split('\n'));
  const referenceClosedAtxHeadings = collectClosedAtxHeadings(referenceMarkdown.replace(/\r\n?/g, '\n').split('\n'));
  if (referenceHeadings.length === 0 && referenceClosedAtxHeadings.length === 0) return markdown;

  const referenceByKey = new Map<string, Array<[string, string]>>();
  for (const heading of referenceHeadings) {
    const headings = referenceByKey.get(heading.key) ?? [];
    headings.push(heading.raw);
    referenceByKey.set(heading.key, headings);
  }
  const closedAtxReferenceByKey = new Map<string, string[]>();
  for (const heading of referenceClosedAtxHeadings) {
    const headings = closedAtxReferenceByKey.get(heading.key) ?? [];
    headings.push(heading.raw);
    closedAtxReferenceByKey.set(heading.key, headings);
  }

  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const output: string[] = [];
  let changed = false;

  for (const line of lines) {
    const key = getAtxHeadingKey(line);
    const referenceRaw = key ? referenceByKey.get(key)?.shift() : undefined;
    if (referenceRaw) {
      output.push(...referenceRaw);
      changed = true;
      continue;
    }

    const closedAtxReferenceRaw = key ? closedAtxReferenceByKey.get(key)?.shift() : undefined;
    if (closedAtxReferenceRaw) {
      output.push(closedAtxReferenceRaw);
      changed = true;
    } else {
      output.push(line);
    }
  }

  return changed ? output.join('\n') : markdown;
}

function collectClosedAtxHeadings(lines: readonly string[]): Array<{ key: string; raw: string }> {
  const headings: Array<{ key: string; raw: string }> = [];
  let activeFence: { marker: string; length: number } | null = null;
  let inLeadingFrontmatter = FRONTMATTER_DELIMITER_PATTERN.test(lines[0] ?? '');

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';

    if (inLeadingFrontmatter) {
      if (index > 0 && FRONTMATTER_DELIMITER_PATTERN.test(line)) {
        inLeadingFrontmatter = false;
      }
      continue;
    }

    const fence = parseFenceLine(line);
    if (activeFence) {
      if (
        fence &&
        fence.marker === activeFence.marker &&
        fence.length >= activeFence.length &&
        line.slice(fence.infoStart).trim() === ''
      ) {
        activeFence = null;
      }
      continue;
    }
    if (fence) {
      activeFence = { marker: fence.marker, length: fence.length };
      continue;
    }

    const match = CLOSED_ATX_HEADING_PATTERN.exec(line);
    if (!match) continue;
    headings.push({
      key: `${(match[1] ?? '').length}\u0000${(match[2] ?? '').trim()}`,
      raw: line,
    });
  }

  return headings;
}

function collectSetextHeadings(lines: readonly string[]): SetextHeading[] {
  const headings: SetextHeading[] = [];
  let activeFence: { marker: string; length: number } | null = null;
  let inLeadingFrontmatter = FRONTMATTER_DELIMITER_PATTERN.test(lines[0] ?? '');

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';

    if (inLeadingFrontmatter) {
      if (index > 0 && FRONTMATTER_DELIMITER_PATTERN.test(line)) {
        inLeadingFrontmatter = false;
      }
      continue;
    }

    const fence = parseFenceLine(line);
    if (activeFence) {
      if (
        fence &&
        fence.marker === activeFence.marker &&
        fence.length >= activeFence.length &&
        line.slice(fence.infoStart).trim() === ''
      ) {
        activeFence = null;
      }
      continue;
    }
    if (fence) {
      activeFence = { marker: fence.marker, length: fence.length };
      continue;
    }

    const underlineMatch = SETEXT_HEADING_UNDERLINE_PATTERN.exec(line);
    const previousLine = lines[index - 1] ?? '';
    if (!underlineMatch || previousLine.trim() === '') continue;

    const level = (underlineMatch[1] ?? '').startsWith('=') ? 1 : 2;
    headings.push({
      key: `${level}\u0000${previousLine.trim()}`,
      raw: [previousLine, line],
    });
  }

  return headings;
}

function getAtxHeadingKey(line: string): string | null {
  const match = ATX_HEADING_PATTERN.exec(line);
  if (!match) return null;

  const level = (match[2] ?? '').length;
  return `${level}\u0000${(match[3] ?? '').trim()}`;
}

function parseFenceLine(line: string): { infoStart: number; length: number; marker: string } | null {
  let cursor = 0;
  while (cursor < line.length && cursor <= 3 && line[cursor] === ' ') {
    cursor += 1;
  }
  if (cursor > 3) return null;

  const marker = line[cursor];
  if (marker !== '`' && marker !== '~') return null;

  let length = 0;
  while (line[cursor + length] === marker) {
    length += 1;
  }
  if (length < 3) return null;

  return { infoStart: cursor + length, length, marker };
}
