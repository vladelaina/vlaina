import { normalizeRenderableImageSrc } from '@/lib/markdown/renderableImagePolicy';
import {
  parseMarkdownAndHtmlImageTokens,
  stripImageTokens,
  type ImageToken,
} from '@/lib/markdown/markdownImageTokens';
import { parseVideoUrl } from '@/lib/markdown/videoUrl';
import { createStoredAttachmentFromSource } from '@/lib/storage/attachmentStorage';

interface ChatMessageImageSourceOptions {
  maxEntries?: number;
  maxSources?: number;
  maxTokens?: number;
  persistable?: boolean;
}

function isImageAttachmentMimeType(type: string | null | undefined): boolean {
  return type?.trim().toLowerCase().startsWith('image/') ?? false;
}

export function normalizeChatMessageImageSource(src: string | null | undefined): string | null {
  const trimmed = src?.trim() ?? '';
  if (!trimmed) {
    return null;
  }

  const storedAttachment = createStoredAttachmentFromSource(trimmed, 'chat-message-image');
  if (storedAttachment && isImageAttachmentMimeType(storedAttachment.type) && !parseVideoUrl(trimmed)) {
    return storedAttachment.assetUrl;
  }

  const normalized = normalizeRenderableImageSrc(trimmed);
  if (!normalized || parseVideoUrl(normalized)) {
    return null;
  }

  const lower = normalized.toLowerCase();
  return lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower.startsWith('data:') ||
    lower.startsWith('blob:')
    ? normalized
    : null;
}

export function normalizePersistedChatMessageImageSource(src: string | null | undefined): string | null {
  const normalized = normalizeChatMessageImageSource(src);
  if (!normalized || normalized.toLowerCase().startsWith('blob:')) {
    return null;
  }
  return normalized;
}

function normalizeChatMessageImageSourceForMode(
  src: string | null | undefined,
  persistable: boolean,
): string | null {
  return persistable
    ? normalizePersistedChatMessageImageSource(src)
    : normalizeChatMessageImageSource(src);
}

export function normalizeChatMessageImageSources(
  sources: readonly string[] | undefined,
  options: ChatMessageImageSourceOptions = {},
): string[] {
  if (!sources || sources.length === 0) {
    return [];
  }

  const normalizedSources: string[] = [];
  const entryLimit = Math.min(sources.length, options.maxEntries ?? sources.length);
  const sourceLimit = options.maxSources ?? Number.POSITIVE_INFINITY;
  for (let index = 0; index < entryLimit && normalizedSources.length < sourceLimit; index += 1) {
    const source = normalizeChatMessageImageSourceForMode(sources[index], options.persistable === true);
    if (source) {
      normalizedSources.push(source);
    }
  }
  return normalizedSources;
}

export function getChatMessageImageTokens(
  content: string,
  options: ChatMessageImageSourceOptions = {},
): ImageToken[] {
  return parseMarkdownAndHtmlImageTokens(content, { maxTokens: options.maxTokens })
    .map((token) => {
      const src = normalizeChatMessageImageSourceForMode(token.src, options.persistable === true);
      return src ? { ...token, src } : null;
    })
    .filter((token): token is ImageToken => token !== null);
}

export function extractChatMessageImageSources(
  content: string,
  options: ChatMessageImageSourceOptions = {},
): string[] {
  const tokens = getChatMessageImageTokens(content, options);
  const sourceLimit = options.maxSources ?? Number.POSITIVE_INFINITY;
  return tokens
    .slice(0, sourceLimit)
    .map((token) => token.src)
    .filter((src): src is string => !!src);
}

export function stripChatMessageImageTokens(
  content: string,
  options: ChatMessageImageSourceOptions = {},
): string {
  return stripImageTokens(content, getChatMessageImageTokens(content, options));
}
