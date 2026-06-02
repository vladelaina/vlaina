const ATTACHMENT_DIR_MARKER = '/attachments/';
const ATTACHMENT_FILENAME_UNSAFE_PATTERN = /[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069\uFFFD]/;

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

export function isStoredAttachmentSrc(src: string | null | undefined): boolean {
  const trimmed = src?.trim() ?? '';
  return trimmed.startsWith('attachment://') || trimmed.startsWith('app-file://attachment/');
}

export function extractStoredAttachmentFilename(src: string | null | undefined): string | null {
  const trimmed = src?.trim() ?? '';
  if (!trimmed) return null;

  if (trimmed.startsWith('attachment://')) {
    return decodeAttachmentFilename(stripUrlSuffix(trimmed.slice('attachment://'.length)));
  }

  if (trimmed.startsWith('app-file://attachment/')) {
    return decodeAttachmentFilename(stripUrlSuffix(trimmed.slice('app-file://attachment/'.length)));
  }

  if (/^[^/\\]+\.[a-z0-9]+$/i.test(trimmed)) {
    return sanitizeAttachmentFilename(trimmed);
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'file:') return null;
    const markerIndex = url.pathname.lastIndexOf(ATTACHMENT_DIR_MARKER);
    if (markerIndex === -1) return null;
    return decodeAttachmentFilename(url.pathname.slice(markerIndex + ATTACHMENT_DIR_MARKER.length));
  } catch {
    return null;
  }
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
