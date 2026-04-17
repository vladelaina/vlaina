import type { Attachment } from '@/lib/storage/attachmentStorage';
import {
  extractMarkdownImageSources,
  stripMarkdownImageTokens,
} from '@/components/Chat/common/messageClipboard';

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
  if (src.startsWith('data:image/')) {
    const match = /^data:(image\/[^;,]+)/.exec(src);
    return match?.[1] ?? 'image/*';
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
  if (src.startsWith('data:image/')) {
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
    imageSources: extractMarkdownImageSources(content),
    text: stripMarkdownImageTokens(content).trim(),
  };
}

export function composeUserMessageContent(text: string, attachments: Attachment[]): string {
  const normalizedText = text.replace(/\r\n?/g, '\n');
  const imageMarkdown = attachments
    .map((attachment) => attachment.assetUrl?.trim())
    .filter((src): src is string => !!src)
    .map((src) => `![image](<${src}>)`)
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
