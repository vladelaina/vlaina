import { getParentPath, getStorageAdapter } from '@/lib/storage/adapter';
import { getFsPathComparisonKey, normalizeFsPath } from './notesExternalSyncUtils';

export function isDirectChildPath(parentPath: string, absolutePath: string) {
  const normalizedParentPath = normalizeFsPath(parentPath);
  const normalizedAbsoluteParentPath = normalizeFsPath(getParentPath(absolutePath) ?? '');
  return getFsPathComparisonKey(normalizedAbsoluteParentPath) === getFsPathComparisonKey(normalizedParentPath);
}

export async function looksLikeVaultRoot(path: string) {
  const storage = getStorageAdapter();
  if (!(await storage.exists(path))) {
    return false;
  }
  const info = await storage.stat(path);
  return info?.isDirectory !== false;
}

export function getVaultExternalWatchPaths(vaultPath: string): {
  normalizedVaultPath: string;
  watchParentPath: string;
  normalizedParentPath: string;
} | null {
  const normalizedVaultPath = normalizeFsPath(vaultPath);
  const watchParentPath = getParentPath(vaultPath);
  const normalizedParentPath = watchParentPath ? normalizeFsPath(watchParentPath) : null;
  if (!watchParentPath || !normalizedParentPath) {
    return null;
  }

  return {
    normalizedVaultPath,
    watchParentPath,
    normalizedParentPath,
  };
}
