import type { Attachment } from '@/lib/storage/attachmentStorage';
import { isRenderableDataImageSrc } from '@/components/common/markdown/imagePolicy';
import {
  extractRenderedMessageImageSources,
  MAX_CHAT_MESSAGE_IMAGE_SOURCE_ENTRIES,
  normalizeRenderedMessageImageSources,
  stripMessageImageTokens,
} from '@/components/Chat/common/messageClipboard';
import { formatMarkdownImage } from '@/lib/markdown/markdownImageMarkdown';

export interface ParsedUserMessageContent {
  text: string;
  imageSources: string[];
}

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
  if (isRenderableDataImageSrc(src)) {
    const mime = inferImageMimeType(src);
    const ext = mime.split('/')[1]?.replace('svg+xml', 'svg') || 'png';
    return `image-${index + 1}.${ext}`;
  }

  const base = src.split('?')[0]?.split('/').pop()?.trim();
  return base || `image-${index + 1}.png`;
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
    imageSources: normalizeRenderedMessageImageSources(
      extractRenderedMessageImageSources(content, {
        maxTokens: MAX_CHAT_MESSAGE_IMAGE_SOURCE_ENTRIES,
      }),
    ),
    text: stripMessageImageTokens(content, {
      maxTokens: MAX_CHAT_MESSAGE_IMAGE_SOURCE_ENTRIES,
    }).trim(),
  };
}

export function parseUserMessageContentWithKnownImages(
  content: string,
  imageSources: string[] | undefined,
): ParsedUserMessageContent {
  const safeImageSources = normalizeRenderedMessageImageSources(imageSources);

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
      return {
        imageSources: safeImageSources,
        text: stripMessageImageTokens(content, {
          maxTokens: MAX_CHAT_MESSAGE_IMAGE_SOURCE_ENTRIES,
        }).trim(),
      };
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
    .map((attachment) => attachment.assetUrl?.trim() || attachment.previewUrl?.trim())
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
