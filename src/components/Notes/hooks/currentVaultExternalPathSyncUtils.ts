import { getParentPath, getStorageAdapter } from '@/lib/storage/adapter';
import { normalizeFsPath } from './notesExternalSyncUtils';

export function isDirectChildPath(parentPath: string, absolutePath: string) {
  return getParentPath(absolutePath) === parentPath;
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
