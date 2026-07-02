import { getParentPath, getStorageAdapter, isAbsolutePath } from '@/lib/storage/adapter';
import { getFsPathComparisonKey, hasUnsafeFsPathSegment, normalizeFsPath } from './notesExternalSyncUtils';

export function isDirectChildPath(parentPath: string, absolutePath: string) {
  const normalizedParentPath = normalizeFsPath(parentPath);
  const normalizedAbsoluteParentPath = normalizeFsPath(getParentPath(absolutePath) ?? '');
  return getFsPathComparisonKey(normalizedAbsoluteParentPath) === getFsPathComparisonKey(normalizedParentPath);
}

export async function looksLikeNotesRootRoot(path: string) {
  const normalizedPath = normalizeFsPath(path);
  if (!isAbsolutePath(normalizedPath) || hasUnsafeFsPathSegment(normalizedPath)) {
    return false;
  }

  const storage = getStorageAdapter();
  if (!(await storage.exists(normalizedPath))) {
    return false;
  }
  const info = await storage.stat(normalizedPath);
  return info?.isDirectory !== false;
}

export function getNotesRootExternalWatchPaths(notesRootPath: string): {
  normalizedNotesRootPath: string;
  watchParentPath: string;
  normalizedParentPath: string;
} | null {
  const normalizedNotesRootPath = normalizeFsPath(notesRootPath);
  const watchParentPath = getParentPath(notesRootPath);
  const normalizedParentPath = watchParentPath ? normalizeFsPath(watchParentPath) : null;
  if (!watchParentPath || !normalizedParentPath) {
    return null;
  }

  return {
    normalizedNotesRootPath,
    watchParentPath,
    normalizedParentPath,
  };
}
