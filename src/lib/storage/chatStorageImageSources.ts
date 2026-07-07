import type { ChatMessage } from '@/lib/ai/types';
import { normalizeChatMessageImageSources } from '@/lib/ai/chatImageSourcePolicy';
import { parseMarkdownAndHtmlImageTokens } from '@/lib/markdown/markdownImageTokens';
import {
  MAX_SESSION_IMAGE_SOURCE_ENTRIES,
  MAX_SESSION_IMAGE_SOURCES,
} from './chatStorageLimits';

function normalizeImageSourceCandidates(value: readonly unknown[]): string[] | undefined {
  const sources = normalizeChatMessageImageSources(
    value
      .slice(0, MAX_SESSION_IMAGE_SOURCE_ENTRIES)
      .filter((item): item is string => typeof item === 'string'),
    {
      maxEntries: MAX_SESSION_IMAGE_SOURCE_ENTRIES,
      maxSources: MAX_SESSION_IMAGE_SOURCES,
      persistable: true,
    },
  );

  return sources.length > 0 ? sources : undefined;
}

export function extractActiveVersionImageSources(role: ChatMessage['role'], content: string): string[] | undefined {
  if (role === 'user') {
    return normalizeImageSourceCandidates(
      parseMarkdownAndHtmlImageTokens(content, { maxTokens: MAX_SESSION_IMAGE_SOURCE_ENTRIES })
        .map((token) => token.src),
    );
  }
  if (role === 'assistant') {
    return normalizeImageSourceCandidates(
      parseMarkdownAndHtmlImageTokens(content, { maxTokens: MAX_SESSION_IMAGE_SOURCE_ENTRIES })
        .map((token) => token.src),
    );
  }
  return undefined;
}
