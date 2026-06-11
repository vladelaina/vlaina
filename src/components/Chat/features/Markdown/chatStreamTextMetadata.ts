import {
  MAX_CHAT_MESSAGE_IMAGE_SOURCE_ENTRIES,
  MAX_CHAT_MESSAGE_IMAGE_SOURCES,
} from '@/components/Chat/common/messageClipboard';
import { extractChatMessageImageSources } from '@/lib/ai/chatImageSourcePolicy';
import {
  getMarkdownFenceState,
  isMarkdownFenceClose,
  type MarkdownFenceState,
} from '@/components/Chat/features/Layout/chatAssistantMarkdownBlockParser';

export function countFencedCodeBlocks(markdown: string): number {
  let count = 0;
  let activeFence: MarkdownFenceState | null = null;
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
      const fence = getMarkdownFenceState(line);
      if (fence) {
        count += 1;
        activeFence = fence;
      }
    }

    if (newlineIndex === -1) {
      break;
    }
    lineStart = newlineIndex + 1;
  }

  return count;
}

export function countRenderableImages(markdown: string): number {
  return extractChatMessageImageSources(markdown, {
    maxSources: MAX_CHAT_MESSAGE_IMAGE_SOURCES,
    maxTokens: MAX_CHAT_MESSAGE_IMAGE_SOURCE_ENTRIES,
  }).length;
}
