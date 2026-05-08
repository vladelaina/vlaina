import { normalizeNotePathKey } from '@/lib/notes/displayName';
import { isAbsolutePath } from '@/lib/storage/adapter';
import { normalizeVaultRelativePath } from '../utils/fs/vaultPathContainment';

export function normalizeStarredVaultPath(path: string): string {
  const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '');
  return normalized || path;
}

export function isValidStarredVaultPath(path: string): boolean {
  const normalized = normalizeStarredVaultPath(path);
  return Boolean(normalized) && !normalized.includes('\0') && isAbsolutePath(normalized);
}

export function normalizeStarredRelativePath(path: string): string | null {
  const normalized = normalizeVaultRelativePath(path);
  return normalized && normalized !== '/' ? normalized : null;
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
  if (!normalizedVaultPath) {
    return null;
  }

  const normalizedAbsolutePath = normalizeStarredVaultPath(normalizedPath);
  const vaultPrefix = normalizedVaultPath === '/' ? '/' : `${normalizedVaultPath}/`;
  if (!normalizedAbsolutePath.startsWith(vaultPrefix)) {
    return null;
  }

  return normalizeStarredRelativePath(normalizedAbsolutePath.slice(vaultPrefix.length));
}
