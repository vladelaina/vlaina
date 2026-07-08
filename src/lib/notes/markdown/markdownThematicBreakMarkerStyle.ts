interface ThematicBreakLine {
  index: number;
  raw: string;
}

const THEMATIC_BREAK_LINE_PATTERN = /^(?: {0,3})(?:[-*_][ \t]*){3,}$/;
const FRONTMATTER_DELIMITER_PATTERN = /^---[ \t]*$/;

export function restoreThematicBreakMarkerStyleFromReference(
  markdown: string,
  referenceMarkdown?: string,
): string {
  if (!referenceMarkdown || !markdown.includes('---')) return markdown;

  const referenceLines = referenceMarkdown.replace(/\r\n?/g, '\n').split('\n');
  const referenceBreaks = collectThematicBreakLines(referenceLines)
    .filter((line) => line.raw.trim() !== '---');
  if (referenceBreaks.length === 0) return markdown;

  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const breaks = collectThematicBreakLines(lines);
  if (breaks.length !== referenceBreaks.length) return markdown;

  let changed = false;
  for (let index = 0; index < breaks.length; index += 1) {
    const line = breaks[index];
    const referenceLine = referenceBreaks[index];
    if (!line || !referenceLine || line.raw === referenceLine.raw) continue;
    lines[line.index] = referenceLine.raw;
    changed = true;
  }

  return changed ? lines.join('\n') : markdown;
}

function collectThematicBreakLines(lines: readonly string[]): ThematicBreakLine[] {
  const breaks: ThematicBreakLine[] = [];
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

    if (THEMATIC_BREAK_LINE_PATTERN.test(line)) {
      breaks.push({ index, raw: line });
    }
  }

  return breaks;
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
