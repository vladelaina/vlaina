import {
  estimateMarkdownBlockHeight,
  type MarkdownMeasurementBlock,
} from './chatAssistantMarkdownTypography';
import { extractRenderedMessageImageSources, stripMessageImageTokens } from '@/components/Chat/common/messageClipboard';
import { MARKDOWN_BLOCK_GAP } from '@/components/common/markdown/markdownMetrics';
import {
  getMarkdownFenceState,
  isMarkdownFenceClose,
  parseMarkdownMeasurementBlocks,
  type MarkdownFenceState,
} from './chatAssistantMarkdownBlockParser';

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
  return stripMessageImageTokens(content);
}

function countRenderableImages(content: string): number {
  return extractRenderedMessageImageSources(content).length;
}

function findReusableMarkdownSplitIndex(markdown: string): number {
  let activeFence: MarkdownFenceState | null = null;
  let splitIndex = 0;
  let lineStart = 0;

  while (lineStart <= markdown.length) {
    const newlineIndex = markdown.indexOf('\n', lineStart);
    const lineEnd = newlineIndex === -1 ? markdown.length : newlineIndex;
    const rawLine = markdown.slice(lineStart, lineEnd);
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
    if (activeFence) {
      if (isMarkdownFenceClose(line, activeFence)) {
        activeFence = null;
      }
    } else {
      activeFence = getMarkdownFenceState(line);
    }

    if (!activeFence && !line.trim()) {
      splitIndex = newlineIndex === -1 ? lineEnd : newlineIndex + 1;
    }

    if (newlineIndex === -1) {
      break;
    }
    lineStart = newlineIndex + 1;
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
      height += MARKDOWN_BLOCK_GAP;
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
