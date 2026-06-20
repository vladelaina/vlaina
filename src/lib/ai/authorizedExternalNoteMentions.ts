import { normalizeAbsolutePath } from '@/lib/storage/adapter';

const MAX_AUTHORIZED_EXTERNAL_NOTE_MENTION_PATHS = 100;
const authorizedExternalNoteMentionPaths: string[] = [];

function normalizeAuthorizedPath(path: string): string {
  const normalized = normalizeAbsolutePath(path.trim()).replace(/\\/g, '/');
  const withoutTrailingSlash = normalized === '/' || /^[A-Za-z]:\/$/i.test(normalized)
    ? normalized
    : normalized.replace(/\/+$/g, '');
  return /^[A-Za-z]:\//.test(withoutTrailingSlash) || withoutTrailingSlash.startsWith('//')
    ? withoutTrailingSlash.toLowerCase()
    : withoutTrailingSlash;
}

export function authorizeExternalNoteMentionPath(path: string): void {
  const normalized = normalizeAuthorizedPath(path);
  if (!normalized) {
    return;
  }

  const existingIndex = authorizedExternalNoteMentionPaths.indexOf(normalized);
  if (existingIndex >= 0) {
    authorizedExternalNoteMentionPaths.splice(existingIndex, 1);
  }
  authorizedExternalNoteMentionPaths.push(normalized);
  if (authorizedExternalNoteMentionPaths.length > MAX_AUTHORIZED_EXTERNAL_NOTE_MENTION_PATHS) {
    authorizedExternalNoteMentionPaths.splice(
      0,
      authorizedExternalNoteMentionPaths.length - MAX_AUTHORIZED_EXTERNAL_NOTE_MENTION_PATHS,
    );
  }
}

export function isAuthorizedExternalNoteMentionPath(path: string): boolean {
  const normalized = normalizeAuthorizedPath(path);
  return !!normalized && authorizedExternalNoteMentionPaths.includes(normalized);
}

export function clearAuthorizedExternalNoteMentionPaths(): void {
  authorizedExternalNoteMentionPaths.length = 0;
}
