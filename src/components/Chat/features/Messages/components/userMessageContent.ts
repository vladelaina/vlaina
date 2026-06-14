import type { Attachment } from '@/lib/storage/attachmentStorage';
import { isRenderableDataImageSrc } from '@/components/common/markdown/imagePolicy';
import {
  MAX_CHAT_MESSAGE_IMAGE_SOURCES,
  MAX_CHAT_MESSAGE_IMAGE_SOURCE_ENTRIES,
} from '@/components/Chat/common/messageClipboard';
import {
  extractChatMessageImageSources,
  normalizeChatMessageImageSources,
  stripChatMessageImageTokens,
} from '@/lib/ai/chatImageSourcePolicy';
import { formatMarkdownImage } from '@/lib/markdown/markdownImageMarkdown';

export interface ParsedUserMessageContent {
  text: string;
  imageSources: string[];
}

const MAX_EDIT_ATTACHMENT_NAME_SOURCE_CHARS = 4096;

export function isSvgSource(src: string): boolean {
  const normalized = src.trim().toLowerCase();
  if (normalized.startsWith('data:image/svg+xml')) {
    return true;
  }
  const pathname = normalized.split('?')[0] ?? '';
  return pathname.endsWith('.svg');
}

function inferImageMimeType(src: string): string {
  if (isRenderableDataImageSrc(src)) {
    const match = /^data:(image\/[^;,]+)/i.exec(src.trim());
    return match?.[1]?.toLowerCase() ?? 'image/*';
  }

  const pathname = src.split('?')[0]?.toLowerCase() ?? '';
  if (pathname.endsWith('.png')) return 'image/png';
  if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) return 'image/jpeg';
  if (pathname.endsWith('.webp')) return 'image/webp';
  if (pathname.endsWith('.gif')) return 'image/gif';
  if (pathname.endsWith('.avif')) return 'image/avif';
  if (pathname.endsWith('.bmp')) return 'image/bmp';
  if (pathname.endsWith('.svg')) return 'image/svg+xml';
  return 'image/*';
}

function inferAttachmentName(src: string, index: number): string {
  const fallback = `image-${index + 1}.png`;
  if (isRenderableDataImageSrc(src)) {
    const mime = inferImageMimeType(src);
    const ext = mime.split('/')[1]?.replace('svg+xml', 'svg') || 'png';
    return `image-${index + 1}.${ext}`;
  }

  if (src.length > MAX_EDIT_ATTACHMENT_NAME_SOURCE_CHARS) {
    return fallback;
  }

  const base = src.split('?')[0]?.split('/').pop()?.trim();
  return base || fallback;
}

function trimString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function toEditAttachment(src: string, index: number): Attachment {
  return {
    id: `edit-attachment-${index}`,
    path: '',
    previewUrl: src,
    assetUrl: src,
    name: inferAttachmentName(src, index),
    type: inferImageMimeType(src),
    size: 0,
  };
}

export function parseUserMessageContent(content: string): ParsedUserMessageContent {
  return {
    imageSources: extractChatMessageImageSources(content, {
      maxSources: MAX_CHAT_MESSAGE_IMAGE_SOURCES,
      maxTokens: MAX_CHAT_MESSAGE_IMAGE_SOURCE_ENTRIES,
    }),
    text: stripChatMessageImageTokens(content, {
      maxTokens: MAX_CHAT_MESSAGE_IMAGE_SOURCE_ENTRIES,
    }).trim(),
  };
}

export function parseUserMessageContentWithKnownImages(
  content: string,
  imageSources: readonly unknown[] | undefined,
): ParsedUserMessageContent {
  const safeImageSources = normalizeChatMessageImageSources(imageSources, {
    maxEntries: MAX_CHAT_MESSAGE_IMAGE_SOURCE_ENTRIES,
    maxSources: MAX_CHAT_MESSAGE_IMAGE_SOURCES,
  });

  if (safeImageSources.length === 0) {
    return parseUserMessageContent(content);
  }

  let cursor = 0;
  for (const source of safeImageSources) {
    const wrappedToken = `![image](<${source}>)`;
    const plainToken = `![image](${source})`;
    if (content.startsWith(wrappedToken, cursor)) {
      cursor += wrappedToken.length;
    } else if (content.startsWith(plainToken, cursor)) {
      cursor += plainToken.length;
    } else {
      return parseUserMessageContent(content);
    }

    while (content[cursor] === '\n' || content[cursor] === '\r') {
      cursor += 1;
    }
  }

  return {
    imageSources: safeImageSources,
    text: content.slice(cursor).trim(),
  };
}

export function composeUserMessageContent(text: string, attachments: Attachment[]): string {
  const normalizedText = text.replace(/\r\n?/g, '\n');
  const imageMarkdown = attachments
    .map((attachment) => trimString(attachment.assetUrl) || trimString(attachment.previewUrl))
    .filter((src): src is string => !!src)
    .map((src) => formatMarkdownImage(src))
    .join('\n');
  const hasText = normalizedText.trim().length > 0;

  if (imageMarkdown && hasText) {
    return `${imageMarkdown}\n\n${normalizedText}`;
  }
  if (imageMarkdown) {
    return imageMarkdown;
  }
  return normalizedText;
}
