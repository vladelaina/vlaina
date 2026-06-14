const ATTACHMENT_FILENAME_UNSAFE_PATTERN = /[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069\uFFFD]/;
export const MAX_ATTACHMENT_FILENAME_CHARS = 512;
export const MAX_ATTACHMENT_FILENAME_ENCODED_CHARS = 2048;
export const MAX_ATTACHMENT_SOURCE_CHARS = 4096;

function stripUrlSuffix(value: string): string {
  const queryIndex = value.indexOf('?');
  const hashIndex = value.indexOf('#');
  const suffixIndex = [queryIndex, hashIndex].filter((index) => index !== -1).sort((a, b) => a - b)[0];
  return suffixIndex === undefined ? value : value.slice(0, suffixIndex);
}

export function sanitizeAttachmentFilename(value: string): string | null {
  const normalized = value.trim();
  if (
    !normalized ||
    normalized.length > MAX_ATTACHMENT_FILENAME_CHARS ||
    normalized === '.' ||
    normalized === '..' ||
    /[\\/]/.test(normalized) ||
    ATTACHMENT_FILENAME_UNSAFE_PATTERN.test(normalized)
  ) {
    return null;
  }
  return normalized;
}

export function decodeAttachmentFilename(value: string): string | null {
  if (value.length > MAX_ATTACHMENT_FILENAME_ENCODED_CHARS) {
    return null;
  }
  try {
    return sanitizeAttachmentFilename(decodeURIComponent(value));
  } catch {
    return sanitizeAttachmentFilename(value);
  }
}

export function isAppFileAttachmentUrl(url: URL): boolean {
  if (url.protocol !== 'app-file:' || url.hostname !== 'attachment') {
    return false;
  }
  return decodeAttachmentFilename(url.pathname.replace(/^\/+/, '')) !== null;
}

export function isStoredAttachmentSrc(src: unknown): boolean {
  return extractStoredAttachmentFilename(src) !== null;
}

export function extractStoredAttachmentFilename(src: unknown): string | null {
  if (typeof src !== 'string') return null;
  const trimmed = src.trim();
  if (!trimmed) return null;
  if (trimmed.length > MAX_ATTACHMENT_SOURCE_CHARS) return null;
  if (trimmed.includes('\\')) return null;
  const lower = trimmed.toLowerCase();

  if (lower.startsWith('attachment://')) {
    return decodeAttachmentFilename(stripUrlSuffix(trimmed.slice('attachment://'.length)));
  }

  if (lower.startsWith('app-file://attachment/')) {
    return decodeAttachmentFilename(stripUrlSuffix(trimmed.slice('app-file://attachment/'.length)));
  }

  return null;
}

export function inferAttachmentMimeTypeFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'bmp') return 'image/bmp';
  if (ext === 'avif') return 'image/avif';
  if (ext === 'svg') return 'image/svg+xml';
  return 'application/octet-stream';
}
