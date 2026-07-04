import type { Attachment } from '@/lib/storage/attachmentStorage';
import {
  extractStoredAttachmentFilename,
  sanitizeAttachmentFilename,
} from '@/lib/storage/attachmentUrl';
import { formatMarkdownImage } from '@/lib/markdown/markdownImageMarkdown';
import { trimString } from './helperCore';

export const IMAGE_NAME_REGEX = /\.(png|jpe?g|webp|gif|bmp|avif|svg)(?:$|[?#])/i;
const TEXT_ATTACHMENT_NAME_REGEX = /\.(?:bash|c|cc|conf|cpp|cs|css|csv|env|fish|go|h|hpp|html|ini|java|js|json|jsonl|jsx|kt|kts|log|md|markdown|php|ps1|py|rb|rs|sh|sql|swift|toml|ts|tsx|txt|xml|ya?ml|zsh)(?:$|[?#])/i;

export const MAX_CHAT_MESSAGE_IMAGE_ATTACHMENTS = 64;
export const MAX_CHAT_MESSAGE_FILE_ATTACHMENTS = 16;
export const MAX_CHAT_MESSAGE_IMAGE_SOURCE_CHARS = 32 * 1024 * 1024;
export const MAX_CHAT_MESSAGE_FILE_CONTEXT_CHARS = 120_000;

export function isImageAttachment(attachment: Attachment): boolean {
  const mimeType = trimString(attachment.type).toLowerCase();
  if (mimeType.startsWith('image/')) {
    return true;
  }

  const previewUrl = trimString(attachment.previewUrl);
  if (/^data:image\//i.test(previewUrl)) {
    return true;
  }

  const assetUrl = trimString(attachment.assetUrl);
  if (IMAGE_NAME_REGEX.test(assetUrl)) {
    return true;
  }

  const name = trimString(attachment.name);
  return IMAGE_NAME_REGEX.test(name);
}

export function isTextAttachment(attachment: Attachment): boolean {
  if (isImageAttachment(attachment)) {
    return false;
  }

  if (typeof attachment.textContent === 'string') {
    return true;
  }

  const mimeType = trimString(attachment.type).toLowerCase();
  if (
    mimeType.startsWith('text/') ||
    mimeType === 'application/json' ||
    mimeType === 'application/ld+json' ||
    mimeType === 'application/toml' ||
    mimeType === 'application/x-ndjson' ||
    mimeType === 'application/xml' ||
    mimeType === 'application/yaml' ||
    mimeType === 'application/x-yaml'
  ) {
    return true;
  }

  const name = trimString(attachment.name);
  return TEXT_ATTACHMENT_NAME_REGEX.test(name);
}

export function limitChatMessageImageAttachments(attachments: readonly Attachment[]): Attachment[] {
  return attachments.slice(0, MAX_CHAT_MESSAGE_IMAGE_ATTACHMENTS);
}

export function limitChatMessageAttachments(attachments: readonly Attachment[]): Attachment[] {
  return attachments.slice(0, MAX_CHAT_MESSAGE_IMAGE_ATTACHMENTS);
}

export function extractTrustedManagedAttachmentPathFilename(path: unknown): string | null {
  const normalizedPath = trimString(path).replace(/\\/g, '/');
  if (!normalizedPath) {
    return null;
  }

  const segments = normalizedPath.split('/').filter(Boolean);
  const filename = sanitizeAttachmentFilename(segments.at(-1) ?? '');
  if (
    !filename ||
    segments.at(-2)?.toLowerCase() !== 'attachments' ||
    segments.at(-3)?.toLowerCase() !== 'chat' ||
    segments.at(-4)?.toLowerCase() !== '.vlaina'
  ) {
    return null;
  }

  return filename;
}

export function getAttachmentMessageImageSrc(attachment: Attachment): string {
  const mimeType = trimString(attachment.type).toLowerCase();
  const previewUrl = trimString(attachment.previewUrl);
  const assetUrl = trimString(attachment.assetUrl);
  if (assetUrl) {
    const storedFilename = extractStoredAttachmentFilename(assetUrl);
    if (storedFilename) {
      return `attachment://${encodeURIComponent(storedFilename)}`;
    }
  }

  const trustedPathFilename = extractTrustedManagedAttachmentPathFilename(attachment.path);
  if (trustedPathFilename) {
    return `attachment://${encodeURIComponent(trustedPathFilename)}`;
  }

  if (assetUrl) {
    return assetUrl;
  }
  if (mimeType === 'image/svg+xml' && /^data:image\//i.test(previewUrl)) {
    return previewUrl;
  }
  return previewUrl;
}

export function toImageMarkdown(src: string): string {
  return formatMarkdownImage(src);
}
