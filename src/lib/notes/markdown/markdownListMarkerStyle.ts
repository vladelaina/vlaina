interface ParsedListMarkerLine {
  delimiter?: '.' | ')';
  key: string;
  marker: string;
}

interface MarkdownLine {
  protected: boolean;
  text: string;
}

const LIST_MARKER_LINE_PATTERN =
  /^((?: {0,3}>[ \t]?)*[ \t]*)([-+*]|\d{1,9}[.)])([ \t]+(?:\[(?: |x|X)\][ \t]+)?)(.*)$/;
const FRONTMATTER_DELIMITER_PATTERN = /^---[ \t]*$/;

export function restoreListMarkerStyleFromReference(
  markdown: string,
  referenceMarkdown?: string,
): string {
  if (!referenceMarkdown) return markdown;

  const referenceLines = collectMarkdownLines(referenceMarkdown);
  const referenceStyles = new Map<string, ParsedListMarkerLine[]>();
  for (const line of referenceLines) {
    if (line.protected) continue;
    const parsed = parseListMarkerLine(line.text);
    if (!parsed) continue;
    const styles = referenceStyles.get(parsed.key) ?? [];
    styles.push(parsed);
    referenceStyles.set(parsed.key, styles);
  }
  if (referenceStyles.size === 0) return markdown;

  const lines = collectMarkdownLines(markdown);
  let changed = false;
  const output = lines.map((line) => {
    if (line.protected) return line.text;

    const parsed = parseListMarkerLine(line.text);
    if (!parsed) return line.text;

    const reference = referenceStyles.get(parsed.key)?.shift();
    if (!reference || reference.marker === parsed.marker) return line.text;

    changed = true;
    return line.text.replace(LIST_MARKER_LINE_PATTERN, (_match, prefix: string, marker: string, spacing: string, content: string) => {
      if (isOrderedMarker(marker) && isOrderedMarker(reference.marker)) {
        return `${prefix}${reference.marker}${spacing}${content}`;
      }
      if (!isOrderedMarker(marker) && !isOrderedMarker(reference.marker)) {
        return `${prefix}${reference.marker}${spacing}${content}`;
      }
      return line.text;
    });
  });

  return changed ? output.join('\n') : markdown;
}

function collectMarkdownLines(markdown: string): MarkdownLine[] {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  let activeFence: { marker: string; length: number } | null = null;
  let inLeadingFrontmatter = FRONTMATTER_DELIMITER_PATTERN.test(lines[0] ?? '');

  return lines.map((text, index) => {
    if (inLeadingFrontmatter) {
      const isClosingDelimiter = index > 0 && FRONTMATTER_DELIMITER_PATTERN.test(text);
      if (isClosingDelimiter) {
        inLeadingFrontmatter = false;
      }
      return { protected: true, text };
    }

    const fence = parseFenceLine(text);
    if (activeFence) {
      const isClosingFence = fence
        && fence.marker === activeFence.marker
        && fence.length >= activeFence.length
        && text.slice(fence.infoStart).trim() === '';
      if (isClosingFence) {
        activeFence = null;
      }
      return { protected: true, text };
    }

    if (fence) {
      activeFence = { marker: fence.marker, length: fence.length };
      return { protected: true, text };
    }

    return { protected: false, text };
  });
}

function parseListMarkerLine(line: string): ParsedListMarkerLine | null {
  const match = LIST_MARKER_LINE_PATTERN.exec(line);
  if (!match) return null;

  const marker = match[2] ?? '';
  const spacing = match[3] ?? '';
  const content = match[4] ?? '';
  const listType = isOrderedMarker(marker) ? 'ordered' : 'bullet';
  const container = (match[1] ?? '').replace(/[ \t]+$/g, '');
  const task = /^\[(?: |x|X)\]/.exec(spacing.trimStart())?.[0]?.toLowerCase() ?? '';
  const normalizedContent = content.trim();
  const key = `${container}\u0000${listType}\u0000${task}\u0000${normalizedContent}`;

  return {
    delimiter: isOrderedMarker(marker) ? marker.at(-1) as '.' | ')' : undefined,
    key,
    marker,
  };
}

function isOrderedMarker(marker: string): boolean {
  return /\d[.)]$/.test(marker);
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
