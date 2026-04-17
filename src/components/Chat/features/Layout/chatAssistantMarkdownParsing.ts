import type { ChatMessage } from '@/lib/ai/types';
import {
  buildParsedAssistantMarkdown,
  getStableMarkdownBlocksHeight,
  stripRenderableImageTokens,
  type ParsedAssistantMarkdown,
} from './chatAssistantMarkdownBlocks';
import {
  setCacheEntry,
  touchCacheEntry,
} from './chatLayoutCache';

const THINK_TAG_RE = /<think>([\s\S]*?)(?:<\/think>|$)/i;
const PARSED_ASSISTANT_MARKDOWN_CACHE_LIMIT = 200;
const STREAMING_ASSISTANT_MARKDOWN_CACHE_LIMIT = 80;

export type ThinkingSections = {
  body: string;
  isComplete: boolean;
  markdown: string;
};

const parsedAssistantMarkdownCache = new Map<string, ParsedAssistantMarkdown>();
const streamingAssistantMarkdownCache = new Map<string, ParsedAssistantMarkdown>();

function getStreamingAssistantMarkdownCacheKey(message: ChatMessage): string {
  return `${message.id}\u0000${message.currentVersionIndex}`;
}

export function extractThinkingSections(content: string): ThinkingSections {
  const match = THINK_TAG_RE.exec(content);
  if (!match) {
    return {
      body: '',
      isComplete: true,
      markdown: content,
    };
  }

  const body = match[1] ?? '';
  const isComplete = content.includes('</think>');
  const markdown = content.replace(match[0], '');
  return { body, isComplete, markdown };
}

export function getParsedAssistantMarkdown(
  message: ChatMessage,
  markdown: string,
): ParsedAssistantMarkdown {
  const cached = touchCacheEntry(parsedAssistantMarkdownCache, markdown);
  if (cached) {
    setCacheEntry(
      streamingAssistantMarkdownCache,
      getStreamingAssistantMarkdownCacheKey(message),
      cached,
      STREAMING_ASSISTANT_MARKDOWN_CACHE_LIMIT,
    );
    return cached;
  }

  const cacheKey = getStreamingAssistantMarkdownCacheKey(message);
  const incrementalSource = touchCacheEntry(streamingAssistantMarkdownCache, cacheKey);
  if (incrementalSource && markdown.startsWith(incrementalSource.rawMarkdown)) {
    const renderableMarkdown = stripRenderableImageTokens(markdown);
    if (!renderableMarkdown.startsWith(incrementalSource.renderableMarkdown)) {
      const parsed = buildParsedAssistantMarkdown(markdown, renderableMarkdown);
      setCacheEntry(parsedAssistantMarkdownCache, markdown, parsed, PARSED_ASSISTANT_MARKDOWN_CACHE_LIMIT);
      setCacheEntry(streamingAssistantMarkdownCache, cacheKey, parsed, STREAMING_ASSISTANT_MARKDOWN_CACHE_LIMIT);
      return parsed;
    }

    const tailSuffix = renderableMarkdown.slice(incrementalSource.renderableMarkdown.length);
    const tailParsed = buildParsedAssistantMarkdown(
      markdown,
      incrementalSource.tailRenderableMarkdown + tailSuffix,
    );
    const stableBlockHeightCache = new Map<number, number>();
    incrementalSource.stableBlockHeightCache.forEach((height, width) => {
      stableBlockHeightCache.set(
        width,
        height + getStableMarkdownBlocksHeight(tailParsed, width),
      );
    });
    const parsed = {
      ...tailParsed,
      blocks: [...incrementalSource.stableBlocks, ...tailParsed.blocks],
      renderableMarkdown,
      stableBlocks: [...incrementalSource.stableBlocks, ...tailParsed.stableBlocks],
      stableBlockHeightCache,
    };
    setCacheEntry(parsedAssistantMarkdownCache, markdown, parsed, PARSED_ASSISTANT_MARKDOWN_CACHE_LIMIT);
    setCacheEntry(streamingAssistantMarkdownCache, cacheKey, parsed, STREAMING_ASSISTANT_MARKDOWN_CACHE_LIMIT);
    return parsed;
  }

  const parsed = buildParsedAssistantMarkdown(
    markdown,
    stripRenderableImageTokens(markdown),
  );
  setCacheEntry(parsedAssistantMarkdownCache, markdown, parsed, PARSED_ASSISTANT_MARKDOWN_CACHE_LIMIT);
  setCacheEntry(streamingAssistantMarkdownCache, cacheKey, parsed, STREAMING_ASSISTANT_MARKDOWN_CACHE_LIMIT);
  return parsed;
}
