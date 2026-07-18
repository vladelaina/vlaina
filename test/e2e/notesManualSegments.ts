import path from 'node:path';

export const MANUAL_MARKDOWN_PATH = path.resolve(process.cwd(), 'test/e2e/notes-manual-performance.md');

const MANUAL_TABLE_BLOCK_PATTERN = /^\|.+\|\n\|[- :|]+\|/m;

function splitManualMarkdownBlocks(markdown: string): string[] {
  return markdown
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
}

function isManualTableBlock(block: string): boolean {
  return MANUAL_TABLE_BLOCK_PATTERN.test(block);
}

function appendUniqueSegment(
  segments: string[],
  seen: Set<string>,
  segment: string,
  keyLength: number,
): void {
  const key = segment.replace(/\s+/g, ' ').slice(0, keyLength);
  if (!key || seen.has(key)) {
    return;
  }

  seen.add(key);
  segments.push(`${segment}\n\n`);
}

export function createManualInputSegments(markdown: string, options: {
  maxSegments?: number;
  maxSegmentChars?: number;
  maxTableSegmentChars?: number;
  maxTableSegmentLines?: number;
} = {}): string[] {
  const {
    maxSegments = 18,
    maxSegmentChars = 420,
    maxTableSegmentChars = 320,
    maxTableSegmentLines = 3,
  } = options;
  const rawBlocks = splitManualMarkdownBlocks(markdown);
  const authoredBlocks = rawBlocks.filter((block) => !/^```/.test(block));
  const taskListBlock = authoredBlocks
    .find((block) => /^-\s+\[[ xX]\]\s+/m.test(block))
    ?.split('\n')
    .filter((line) => /^-\s+\[[ xX]\]\s+/.test(line))
    .slice(0, 3)
    .join('\n');
  const requiredBlocks = [
    authoredBlocks.find((block) => block.startsWith('# Markdown 编辑器测试手册')),
    authoredBlocks.find((block) => /^##\s+/.test(block)),
    authoredBlocks.find((block) => /^[^\n]+\n(?:=+|-+)$/.test(block)),
    authoredBlocks.find((block) => /^-\s+/.test(block)),
    authoredBlocks.find((block) => /^\d+[.)]\s+/.test(block)),
    taskListBlock,
    authoredBlocks.find((block) => /^>\s+/.test(block)),
    authoredBlocks.find((block) => /^(?:\*\s*){3,}$/.test(block)),
    authoredBlocks.find((block) => /^\[\^[^\]]+\]:/.test(block)),
    authoredBlocks.find((block) => isManualTableBlock(block)),
    rawBlocks.find((block) => /^```\s*\w*/m.test(block)),
  ].filter((block): block is string => Boolean(block));
  const stride = Math.max(1, Math.floor(rawBlocks.length / maxSegments));
  const candidates = [
    ...requiredBlocks,
    ...rawBlocks.filter((_block, index) => index % stride === 0),
  ];
  const segments: string[] = [];
  const seen = new Set<string>();

  for (const block of candidates) {
    const isTable = isManualTableBlock(block);
    const representativeBlock = isTable
      ? block.split('\n').slice(0, maxTableSegmentLines).join('\n')
      : block;
    const maxChars = isTable ? maxTableSegmentChars : maxSegmentChars;
    const segment = representativeBlock.length > maxChars
      ? `${representativeBlock.slice(0, maxChars).trimEnd()}\n`
      : representativeBlock;
    appendUniqueSegment(segments, seen, segment, 160);
    if (segments.length >= maxSegments) {
      break;
    }
  }

  return segments;
}

export function createManualInteractionSegments(markdown: string, options: {
  limit: number;
  maxSegmentChars?: number;
  maxTableSegmentLines?: number;
}): string[] {
  const {
    limit,
    maxSegmentChars = 520,
    maxTableSegmentLines = 4,
  } = options;
  const rawBlocks = splitManualMarkdownBlocks(markdown);
  const requiredBlocks = [
    rawBlocks.find((block) => block.startsWith('# Markdown 编辑器测试手册')),
    rawBlocks.find((block) => /^##\s+/.test(block)),
    rawBlocks.find((block) => /^-\s+/m.test(block)),
    rawBlocks.find((block) => /^\d+[).]/m.test(block)),
    rawBlocks.find((block) => isManualTableBlock(block)),
    rawBlocks.find((block) => /^```\s*\w*/m.test(block)),
    rawBlocks.find((block) => /\$\$|\\\[|\\\(/.test(block)),
    rawBlocks.find((block) => /!\[/.test(block)),
    rawBlocks.find((block) => /\[[^\]]+\]\([^)]+\)/.test(block)),
  ].filter((block): block is string => Boolean(block));
  const stride = Number.isFinite(limit)
    ? Math.max(1, Math.floor(rawBlocks.length / Math.max(1, limit)))
    : 1;
  const candidates = [
    ...requiredBlocks,
    ...rawBlocks.filter((_block, index) => index % stride === 0),
  ];
  const segments: string[] = [];
  const seen = new Set<string>();

  for (const block of candidates) {
    const representativeBlock = isManualTableBlock(block)
      ? block.split('\n').slice(0, maxTableSegmentLines).join('\n')
      : block;
    const segment = representativeBlock.length > maxSegmentChars
      ? `${representativeBlock.slice(0, maxSegmentChars).trimEnd()}\n`
      : representativeBlock;
    appendUniqueSegment(segments, seen, segment, 180);
    if (segments.length >= limit) {
      break;
    }
  }

  return segments;
}

export function createManualCorpus(markdown: string, options: {
  maxFragmentChars?: number;
} = {}): string[] {
  const { maxFragmentChars = 420 } = options;
  const seen = new Set<string>();
  const corpus: string[] = [];

  for (const block of splitManualMarkdownBlocks(markdown)) {
    if (block.length < 12) {
      continue;
    }
    if (/^```(?:mermaid|flow|sequence|gantt|pie|class|state|er)\b/i.test(block)) {
      continue;
    }
    if (/^\$\$/.test(block) || /^\\\[/.test(block)) {
      continue;
    }

    const fragment = block.length > maxFragmentChars
      ? `${block.slice(0, maxFragmentChars).trimEnd()}\n`
      : block;
    appendUniqueSegment(corpus, seen, fragment, 120);
  }

  return corpus;
}
