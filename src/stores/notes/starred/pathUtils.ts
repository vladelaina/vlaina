import { normalizeNotePathKey } from '@/lib/notes/displayName';
import { isAbsolutePath, normalizeAbsolutePath } from '@/lib/storage/adapter';
import { normalizeContainedAssetPath } from '@/lib/assets/core/pathContainment';
import { hasInternalNotePathSegment } from '../utils/fs/internalNotePaths';
import { normalizeVaultRelativePath } from '../utils/fs/vaultPathContainment';

const UNSAFE_STARRED_PATH_CHARS = /[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069\uFFFD]/;

function trimStarredVaultTrailingSlashes(path: string): string {
  if (path === '/' || /^[A-Za-z]:\/$/.test(path)) {
    return path;
  }

  return path.replace(/\/+$/, '');
}

export function normalizeStarredVaultPath(path: string): string {
  const normalized = trimStarredVaultTrailingSlashes(
    normalizeAbsolutePath(path).replace(/\\/g, '/'),
  );
  return normalized || path;
}

export function getStarredVaultPathComparisonKey(path: string): string {
  const normalized = normalizeStarredVaultPath(path);
  return /^[A-Za-z]:/.test(normalized) || normalized.startsWith('//')
    ? normalized.toLowerCase()
    : normalized;
}

export function isSameStarredVaultPath(left: string, right: string): boolean {
  return getStarredVaultPathComparisonKey(left) === getStarredVaultPathComparisonKey(right);
}

export function isValidStarredVaultPath(path: string): boolean {
  const normalized = normalizeStarredVaultPath(path);
  return (
    Boolean(normalized) &&
    !UNSAFE_STARRED_PATH_CHARS.test(normalized) &&
    isAbsolutePath(normalized) &&
    !hasInternalNotePathSegment(normalized)
  );
}

export function normalizeStarredRelativePath(path: string): string | null {
  const normalized = normalizeVaultRelativePath(path);
  if (!normalized || normalized === '/') {
    return null;
  }
  if (hasInternalNotePathSegment(normalized)) {
    return null;
  }
  return normalized;
}

export function isPathInsideStarredVault(path: string, vaultPath: string): boolean {
  const normalizedPath = normalizeNotePathKey(path);
  if (!normalizedPath || !isAbsolutePath(normalizedPath)) {
    return false;
  }

  const normalizedVaultPath = normalizeStarredVaultPath(vaultPath);
  if (!normalizedVaultPath || !isValidStarredVaultPath(normalizedVaultPath)) {
    return false;
  }

  return normalizeContainedAssetPath(normalizedPath, normalizedVaultPath) != null;
}

export function resolveStarredRelativePathForVault(
  path: string,
  vaultPath: string,
): string | null {
  const normalizedPath = normalizeNotePathKey(path);
  if (!normalizedPath) {
    return null;
  }

  if (!isAbsolutePath(normalizedPath)) {
    return normalizeStarredRelativePath(normalizedPath);
  }

  const normalizedVaultPath = normalizeStarredVaultPath(vaultPath);
  if (!normalizedVaultPath || !isValidStarredVaultPath(normalizedVaultPath)) {
    return null;
  }

  const containedPath = normalizeContainedAssetPath(normalizedPath, normalizedVaultPath);
  if (!containedPath) {
    return null;
  }

  const normalizedAbsolutePath = normalizeStarredVaultPath(containedPath);
  if (normalizedVaultPath === '/') {
    return normalizeStarredRelativePath(normalizedAbsolutePath.replace(/^\/+/, ''));
  }

  const relativeStart = normalizedVaultPath.endsWith('/')
    ? normalizedVaultPath.length
    : normalizedVaultPath.length + 1;
  return normalizeStarredRelativePath(normalizedAbsolutePath.slice(relativeStart));
}
