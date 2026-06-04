import { extractRenderedMessageImageSources } from '@/components/Chat/common/messageClipboard';
import {
  getMarkdownFenceState,
  isMarkdownFenceClose,
  type MarkdownFenceState,
} from '@/components/Chat/features/Layout/chatAssistantMarkdownBlockParser';

export function countFencedCodeBlocks(markdown: string): number {
  let count = 0;
  let activeFence: MarkdownFenceState | null = null;
  for (const line of markdown.split('\n')) {
    if (activeFence) {
      if (isMarkdownFenceClose(line, activeFence)) {
        activeFence = null;
      }
      continue;
    }

    const fence = getMarkdownFenceState(line);
    if (fence) {
      count += 1;
      activeFence = fence;
    }
  }
  return count;
}

export function countRenderableImages(markdown: string): number {
  return extractRenderedMessageImageSources(markdown).length;
}
