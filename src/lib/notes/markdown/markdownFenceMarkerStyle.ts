interface FenceBlock {
  close: string;
  closeIndex: number;
  key: string;
  open: string;
  openIndex: number;
}

export function restoreFenceMarkerStyleFromReference(
  markdown: string,
  referenceMarkdown?: string,
): string {
  if (!referenceMarkdown || !markdown.includes('```')) return markdown;

  const referenceBlocks = collectFenceBlocks(referenceMarkdown.replace(/\r\n?/g, '\n').split('\n'));
  if (referenceBlocks.length === 0) return markdown;

  const referenceByKey = new Map<string, FenceBlock[]>();
  for (const block of referenceBlocks) {
    const blocks = referenceByKey.get(block.key) ?? [];
    blocks.push(block);
    referenceByKey.set(block.key, blocks);
  }

  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const blocks = collectFenceBlocks(lines);
  let changed = false;

  for (const block of blocks) {
    const reference = referenceByKey.get(block.key)?.shift();
    if (!reference) continue;

    if (lines[block.openIndex] !== reference.open) {
      lines[block.openIndex] = reference.open;
      changed = true;
    }
    if (lines[block.closeIndex] !== reference.close) {
      lines[block.closeIndex] = reference.close;
      changed = true;
    }
  }

  return changed ? lines.join('\n') : markdown;
}

function collectFenceBlocks(lines: readonly string[]): FenceBlock[] {
  const blocks: FenceBlock[] = [];
  let active: { marker: string; length: number; open: string; openIndex: number } | null = null;
  let bodyStart = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const fence = parseFenceLine(line);

    if (active) {
      if (
        fence &&
        fence.marker === active.marker &&
        fence.length >= active.length &&
        line.slice(fence.infoStart).trim() === ''
      ) {
        blocks.push({
          close: line,
          closeIndex: index,
          key: lines.slice(bodyStart, index).join('\n'),
          open: active.open,
          openIndex: active.openIndex,
        });
        active = null;
      }
      continue;
    }

    if (fence) {
      active = {
        marker: fence.marker,
        length: fence.length,
        open: line,
        openIndex: index,
      };
      bodyStart = index + 1;
    }
  }

  return blocks;
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
