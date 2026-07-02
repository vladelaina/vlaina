import { isAbsolutePath, joinPath } from '@/lib/storage/adapter';

export const MAX_NOTES_ROOT_RELATIVE_PATH_CHARS = 64 * 1024;
const UNSAFE_NOTES_ROOT_PATH_CHARS = /[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069\uFFFD]/;
const EXPLICIT_URL_SCHEME_PATTERN = /^[A-Za-z][A-Za-z0-9+.-]*:/;
const BACKSLASH_ESCAPED_SCHEME_PATTERN = /^[A-Za-z][A-Za-z0-9+.-]*\\+:/;
const WINDOWS_ABSOLUTE_PATH_PATTERN = /^[A-Za-z]:[\\/]/;

function hasExplicitNonPathScheme(path: string): boolean {
  const trimmedPath = path.trim();
  return (
    (EXPLICIT_URL_SCHEME_PATTERN.test(trimmedPath) && !WINDOWS_ABSOLUTE_PATH_PATTERN.test(trimmedPath)) ||
    BACKSLASH_ESCAPED_SCHEME_PATTERN.test(trimmedPath)
  );
}

export function isSafeNotesRootPathSegment(segment: string | undefined): segment is string {
  return (
    !!segment &&
    segment.length <= MAX_NOTES_ROOT_RELATIVE_PATH_CHARS &&
    segment !== '.' &&
    segment !== '..' &&
    !UNSAFE_NOTES_ROOT_PATH_CHARS.test(segment) &&
    !/[\\/]/.test(segment)
  );
}

export function hasUnsafeNotesRootPathSegment(
  path: string,
  options: { allowNavigationSegments?: boolean } = {},
): boolean {
  if (path.length > MAX_NOTES_ROOT_RELATIVE_PATH_CHARS) {
    return true;
  }

  const segments = path.replace(/\\/g, '/').split('/').filter(Boolean);

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    if (options.allowNavigationSegments && (segment === '.' || segment === '..')) {
      continue;
    }
    if (!isSafeNotesRootPathSegment(segment)) {
      return true;
    }
  }

  return false;
}

export function normalizeNotesRootRelativePath(
  path: string | undefined,
  options: { allowEmpty?: boolean } = {},
): string | null {
  if (path == null) {
    return options.allowEmpty ? '' : null;
  }

  if (path.length > MAX_NOTES_ROOT_RELATIVE_PATH_CHARS) {
    return null;
  }

  if (hasExplicitNonPathScheme(path)) {
    return null;
  }

  const normalized = path.replace(/\\/g, '/').replace(/\/{2,}/g, '/');
  if (isAbsolutePath(normalized) || normalized.startsWith('/')) {
    return null;
  }

  const parts: string[] = [];
  for (const part of normalized.split('/')) {
    if (!part || part === '.') {
      continue;
    }
    if (part === '..' || UNSAFE_NOTES_ROOT_PATH_CHARS.test(part)) {
      return null;
    }
    parts.push(part);
  }

  if (parts.length === 0) {
    return options.allowEmpty ? '' : null;
  }

  return parts.join('/');
}

export async function resolveNotesRootRelativeFullPath(
  notesRootPath: string,
  path: string,
  options: { allowEmpty?: boolean; errorMessage?: string } = {},
): Promise<{ relativePath: string; fullPath: string }> {
  const relativePath = normalizeNotesRootRelativePath(path, options);
  if (relativePath == null) {
    throw new Error(options.errorMessage ?? 'Path must stay inside the opened folder.');
  }

  return {
    relativePath,
    fullPath: relativePath ? await joinPath(notesRootPath, relativePath) : notesRootPath,
  };
}
