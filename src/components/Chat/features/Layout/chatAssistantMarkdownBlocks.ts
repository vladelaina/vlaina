import {
  estimateMarkdownBlockHeight,
  type MarkdownMeasurementBlock,
} from './chatAssistantMarkdownTypography';
import { extractMessageImageSources, stripMarkdownImageTokens } from '@/components/Chat/common/messageClipboard';
import { parseMarkdownMeasurementBlocks } from './chatAssistantMarkdownBlockParser';
const HTML_IMAGE_RE = /<img\b[^>]*>/gi;
const FENCE_START_RE = /^\s*```/;

const ASSISTANT_BLOCK_GAP = 20;

export type ParsedAssistantMarkdown = {
  blocks: MarkdownMeasurementBlock[];
  imageCount: number;
  rawMarkdown: string;
  renderableMarkdown: string;
  stableBlocks: MarkdownMeasurementBlock[];
  stableBlockHeightCache: Map<number, number>;
  tailBlocks: MarkdownMeasurementBlock[];
  tailRenderableMarkdown: string;
};

export function stripRenderableImageTokens(content: string): string {
  return stripMarkdownImageTokens(content).replace(HTML_IMAGE_RE, '');
}

function countRenderableImages(content: string): number {
  return extractMessageImageSources(content).length;
}

function findReusableMarkdownSplitIndex(markdown: string): number {
  const normalized = markdown.replace(/\r\n?/g, '\n');
  const lines = normalized.split('\n');
  let inFence = false;
  let splitIndex = 0;
  let offset = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    if (FENCE_START_RE.test(line)) {
      inFence = !inFence;
    }

    offset += line.length;
    if (index < lines.length - 1) {
      offset += 1;
    }

    if (!inFence && !line.trim()) {
      splitIndex = offset;
    }
  }

  return splitIndex;
}

function estimateMarkdownBlocksHeight(
  blocks: MarkdownMeasurementBlock[],
  contentWidth: number,
  hasLeadingGap: boolean,
): number {
  let height = 0;

  blocks.forEach((block, index) => {
    if (hasLeadingGap || index > 0) {
      height += ASSISTANT_BLOCK_GAP;
    }
    height += estimateMarkdownBlockHeight(block, contentWidth);
  });

  return height;
}

export function getStableMarkdownBlocksHeight(
  parsed: ParsedAssistantMarkdown,
  contentWidth: number,
): number {
  const cached = parsed.stableBlockHeightCache.get(contentWidth);
  if (cached !== undefined) {
    return cached;
  }

  const height = estimateMarkdownBlocksHeight(parsed.stableBlocks, contentWidth, false);
  parsed.stableBlockHeightCache.set(contentWidth, height);
  return height;
}

export function getMarkdownBlocksHeight(
  parsed: ParsedAssistantMarkdown,
  contentWidth: number,
): number {
  if (parsed.blocks.length === 0) {
    return 0;
  }

  return getStableMarkdownBlocksHeight(parsed, contentWidth)
    + estimateMarkdownBlocksHeight(parsed.tailBlocks, contentWidth, parsed.stableBlocks.length > 0);
}

export function buildParsedAssistantMarkdown(
  rawMarkdown: string,
  renderableMarkdown: string,
): ParsedAssistantMarkdown {
  const splitIndex = findReusableMarkdownSplitIndex(renderableMarkdown);
  const stableMarkdown = renderableMarkdown.slice(0, splitIndex);
  const tailRenderableMarkdown = renderableMarkdown.slice(splitIndex);
  const stableBlocks = stableMarkdown ? parseMarkdownMeasurementBlocks(stableMarkdown) : [];
  const tailBlocks = tailRenderableMarkdown ? parseMarkdownMeasurementBlocks(tailRenderableMarkdown) : [];

  return {
    blocks: [...stableBlocks, ...tailBlocks],
    imageCount: countRenderableImages(rawMarkdown),
    rawMarkdown,
    renderableMarkdown,
    stableBlocks,
    stableBlockHeightCache: new Map(),
    tailBlocks,
    tailRenderableMarkdown,
  };
}
