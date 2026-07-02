import { normalizeNotePathKey } from '@/lib/notes/displayName';
import { isAbsolutePath, normalizeAbsolutePath } from '@/lib/storage/adapter';
import { normalizeContainedAssetPath } from '@/lib/assets/core/pathContainment';
import { hasInternalNotePathSegment } from '../utils/fs/internalNotePaths';
import { normalizeNotesRootRelativePath } from '../utils/fs/notesRootPathContainment';

const UNSAFE_STARRED_PATH_CHARS = /[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069\uFFFD]/;

function trimStarredNotesRootTrailingSlashes(path: string): string {
  if (path === '/' || /^[A-Za-z]:\/$/.test(path)) {
    return path;
  }

  return path.replace(/\/+$/, '');
}

export function normalizeStarredNotesRootPath(path: string): string {
  const normalized = trimStarredNotesRootTrailingSlashes(
    normalizeAbsolutePath(path).replace(/\\/g, '/'),
  );
  return normalized || path;
}

export function getStarredNotesRootPathComparisonKey(path: string): string {
  const normalized = normalizeStarredNotesRootPath(path);
  return /^[A-Za-z]:/.test(normalized) || normalized.startsWith('//')
    ? normalized.toLowerCase()
    : normalized;
}

export function isSameStarredNotesRootPath(left: string, right: string): boolean {
  return getStarredNotesRootPathComparisonKey(left) === getStarredNotesRootPathComparisonKey(right);
}

export function isValidStarredNotesRootPath(path: string): boolean {
  const normalized = normalizeStarredNotesRootPath(path);
  return (
    Boolean(normalized) &&
    !UNSAFE_STARRED_PATH_CHARS.test(normalized) &&
    isAbsolutePath(normalized) &&
    !hasInternalNotePathSegment(normalized)
  );
}

export function normalizeStarredRelativePath(path: string): string | null {
  const normalized = normalizeNotesRootRelativePath(path);
  if (!normalized || normalized === '/') {
    return null;
  }
  if (hasInternalNotePathSegment(normalized)) {
    return null;
  }
  return normalized;
}

export function isPathInsideStarredNotesRoot(path: string, notesRootPath: string): boolean {
  const normalizedPath = normalizeNotePathKey(path);
  if (!normalizedPath || !isAbsolutePath(normalizedPath)) {
    return false;
  }

  const normalizedNotesRootPath = normalizeStarredNotesRootPath(notesRootPath);
  if (!normalizedNotesRootPath || !isValidStarredNotesRootPath(normalizedNotesRootPath)) {
    return false;
  }

  return normalizeContainedAssetPath(normalizedPath, normalizedNotesRootPath) != null;
}

export function resolveStarredRelativePathForNotesRoot(
  path: string,
  notesRootPath: string,
): string | null {
  const normalizedPath = normalizeNotePathKey(path);
  if (!normalizedPath) {
    return null;
  }

  if (!isAbsolutePath(normalizedPath)) {
    return normalizeStarredRelativePath(normalizedPath);
  }

  const normalizedNotesRootPath = normalizeStarredNotesRootPath(notesRootPath);
  if (!normalizedNotesRootPath || !isValidStarredNotesRootPath(normalizedNotesRootPath)) {
    return null;
  }

  const containedPath = normalizeContainedAssetPath(normalizedPath, normalizedNotesRootPath);
  if (!containedPath) {
    return null;
  }

  const normalizedAbsolutePath = normalizeStarredNotesRootPath(containedPath);
  if (normalizedNotesRootPath === '/') {
    return normalizeStarredRelativePath(normalizedAbsolutePath.replace(/^\/+/, ''));
  }

  const relativeStart = normalizedNotesRootPath.endsWith('/')
    ? normalizedNotesRootPath.length
    : normalizedNotesRootPath.length + 1;
  return normalizeStarredRelativePath(normalizedAbsolutePath.slice(relativeStart));
}
