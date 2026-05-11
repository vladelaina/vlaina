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

const THINK_TAG_RE = /<think>([\s\S]*?)(<\/think>|$)/gi;
const THINK_OPEN_TAG = '<think>';
const THINK_CLOSE_TAG = '</think>';
const PARSED_ASSISTANT_MARKDOWN_CACHE_LIMIT = 200;
const STREAMING_ASSISTANT_MARKDOWN_CACHE_LIMIT = 80;

export type ThinkingSections = {
  body: string;
  isComplete: boolean;
  markdown: string;
};

function stripTrailingTagPrefix(content: string, tag: string): { content: string; stripped: boolean } {
  const lowerContent = content.toLowerCase();
  const lowerTag = tag.toLowerCase();

  for (let length = lowerTag.length - 1; length > 0; length -= 1) {
    if (lowerContent.endsWith(lowerTag.slice(0, length))) {
      return {
        content: content.slice(0, -length),
        stripped: true,
      };
    }
  }

  return { content, stripped: false };
}

const parsedAssistantMarkdownCache = new Map<string, ParsedAssistantMarkdown>();
const streamingAssistantMarkdownCache = new Map<string, ParsedAssistantMarkdown>();

function getStreamingAssistantMarkdownCacheKey(message: ChatMessage): string {
  return `${message.id}\u0000${message.currentVersionIndex}`;
}

export function extractThinkingSections(content: string): ThinkingSections {
  const thinkingParts: string[] = [];
  let markdown = '';
  let cursor = 0;
  let isComplete = true;
  THINK_TAG_RE.lastIndex = 0;

  for (const match of content.matchAll(THINK_TAG_RE)) {
    const start = match.index ?? 0;
    markdown += content.slice(cursor, start);
    const rawThinking = match[1] ?? '';
    const thinking = match[2] === '</think>'
      ? rawThinking
      : stripTrailingTagPrefix(rawThinking, THINK_CLOSE_TAG).content;
    thinkingParts.push(thinking);
    cursor = start + match[0].length;
    if (match[2] !== '</think>') {
      isComplete = false;
      break;
    }
  }

  if (thinkingParts.length === 0) {
    const stripped = stripTrailingTagPrefix(content, THINK_OPEN_TAG);
    if (stripped.stripped) {
      return {
        body: '',
        isComplete: false,
        markdown: stripped.content,
      };
    }

    return {
      body: '',
      isComplete: true,
      markdown: content,
    };
  }

  if (isComplete) {
    markdown += content.slice(cursor);
  }

  return {
    body: thinkingParts.join('\n\n'),
    isComplete,
    markdown,
  };
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
