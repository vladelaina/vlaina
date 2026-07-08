interface MarkdownLineBlock {
  canonical: string;
  end: number;
  raw: string[];
  start: number;
}

interface MarkdownLine {
  protected: boolean;
  text: string;
}

interface ParsedBlockquoteLine {
  content: string;
  depth: number;
}

const FRONTMATTER_DELIMITER_PATTERN = /^---[ \t]*$/;

export function restoreBlockquoteMarkerSpacingFromReference(
  markdown: string,
  referenceMarkdown?: string,
): string {
  if (!referenceMarkdown || !markdown.includes('>') || !referenceMarkdown.includes('>')) {
    return markdown;
  }

  const referenceBlocks = collectBlockquoteBlocks(referenceMarkdown.replace(/\r\n?/g, '\n'));
  if (referenceBlocks.length === 0) return markdown;

  const referenceByCanonical = new Map<string, string[][]>();
  for (const block of referenceBlocks) {
    if (!block.raw.some(hasCompactBlockquoteMarker)) continue;
    const blocks = referenceByCanonical.get(block.canonical) ?? [];
    blocks.push(block.raw);
    referenceByCanonical.set(block.canonical, blocks);
  }
  if (referenceByCanonical.size === 0) return markdown;

  const lines = collectMarkdownLines(markdown);
  const blocks = collectBlockquoteBlocksFromLines(lines);
  if (blocks.length === 0) return markdown;

  let changed = false;
  const output: string[] = [];
  let cursor = 0;

  for (const block of blocks) {
    output.push(...lines.slice(cursor, block.start).map((line) => line.text));
    const referenceRaw = referenceByCanonical.get(block.canonical)?.shift();
    if (referenceRaw && referenceRaw.join('\n') !== block.raw.join('\n')) {
      output.push(...referenceRaw);
      changed = true;
    } else {
      output.push(...block.raw);
    }
    cursor = block.end;
  }

  output.push(...lines.slice(cursor).map((line) => line.text));
  return changed ? output.join('\n') : markdown;
}

function collectBlockquoteBlocks(markdown: string): MarkdownLineBlock[] {
  return collectBlockquoteBlocksFromLines(collectMarkdownLines(markdown));
}

function collectBlockquoteBlocksFromLines(lines: readonly MarkdownLine[]): MarkdownLineBlock[] {
  const blocks: MarkdownLineBlock[] = [];

  for (let index = 0; index < lines.length;) {
    const line = lines[index];
    if (!line || line.protected || !parseBlockquoteLine(line.text)) {
      index += 1;
      continue;
    }

    const start = index;
    while (
      index < lines.length
      && !lines[index]?.protected
      && parseBlockquoteLine(lines[index]?.text ?? '')
    ) {
      index += 1;
    }

    const raw = lines.slice(start, index).map((line) => line.text);
    const canonical = canonicalizeBlockquoteLines(raw);
    if (canonical) {
      blocks.push({ canonical, end: index, raw, start });
    }
  }

  return blocks;
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

function canonicalizeBlockquoteLines(lines: readonly string[]): string {
  return lines
    .map((line) => {
      const parsed = parseBlockquoteLine(line);
      if (!parsed || parsed.content.trim() === '') return null;
      return `${'>'.repeat(parsed.depth)}${parsed.content}`;
    })
    .filter((line): line is string => line !== null)
    .join('\n');
}

function parseBlockquoteLine(line: string): ParsedBlockquoteLine | null {
  let cursor = 0;
  while (cursor < line.length && cursor < 4 && line[cursor] === ' ') {
    cursor += 1;
  }
  if (cursor > 3 || line[cursor] !== '>') return null;

  let depth = 0;
  while (line[cursor] === '>') {
    depth += 1;
    cursor += 1;
    if (line[cursor] === ' ' || line[cursor] === '\t') {
      cursor += 1;
    }
  }

  return { content: line.slice(cursor), depth };
}

function hasCompactBlockquoteMarker(line: string): boolean {
  let cursor = 0;
  while (cursor < line.length && cursor < 4 && line[cursor] === ' ') {
    cursor += 1;
  }
  if (cursor > 3 || line[cursor] !== '>') return false;

  while (line[cursor] === '>') {
    cursor += 1;
    const next = line[cursor];
    if (next && next !== ' ' && next !== '\t') {
      return true;
    }
    if (next === ' ' || next === '\t') {
      cursor += 1;
    }
  }

  return false;
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
