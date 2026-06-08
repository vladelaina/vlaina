import { normalizeNotePathKey } from '@/lib/notes/displayName';
import { isAbsolutePath } from '@/lib/storage/adapter';
import { normalizeContainedAssetPath } from '@/lib/assets/core/pathContainment';
import { hasInternalNotePathSegment } from '../utils/fs/internalNotePaths';
import { normalizeVaultRelativePath } from '../utils/fs/vaultPathContainment';

export function normalizeStarredVaultPath(path: string): string {
  const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '');
  return normalized || path;
}

export function isValidStarredVaultPath(path: string): boolean {
  const normalized = normalizeStarredVaultPath(path);
  return (
    Boolean(normalized) &&
    !normalized.includes('\0') &&
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

  return normalizeStarredRelativePath(normalizedAbsolutePath.slice(normalizedVaultPath.length + 1));
}
