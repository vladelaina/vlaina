import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { normalizeContainedAssetPath } from '../core/pathContainment';

const TEMP_EXTENSION = '.tmp';

function isSafeDirectoryEntryName(name: string): boolean {
  return Boolean(name) && name !== '.' && name !== '..' && !/[\\/]/.test(name) && !name.includes('\0');
}

function isSameNormalizedPath(leftPath: string, rightPath: string): boolean {
  return (
    normalizeContainedAssetPath(leftPath, rightPath) !== null &&
    normalizeContainedAssetPath(rightPath, leftPath) !== null
  );
}

async function normalizeTempDirectoryEntryPath(
  assetsDir: string,
  entry: { name: string; path: string; isFile: boolean },
): Promise<string | null> {
  if (!entry.isFile || !isSafeDirectoryEntryName(entry.name) || !entry.name.endsWith(TEMP_EXTENSION)) {
    return null;
  }

  const containedPath = normalizeContainedAssetPath(entry.path, assetsDir);
  const expectedPath = normalizeContainedAssetPath(await joinPath(assetsDir, entry.name), assetsDir);
  if (!containedPath || !expectedPath || !isSameNormalizedPath(containedPath, expectedPath)) {
    return null;
  }

  return containedPath;
}

export async function writeAssetAtomic(
  targetPath: string,
  data: Uint8Array
): Promise<void> {
  const storage = getStorageAdapter();
  const tempPath = `${targetPath}.${crypto.randomUUID()}${TEMP_EXTENSION}`;
  
  try {
    await storage.writeBinaryFile(tempPath, data);
    
    await storage.rename(tempPath, targetPath);
  } catch (error) {
    try {
      if (await storage.exists(tempPath)) {
        await storage.deleteFile(tempPath);
      }
    } catch {
    }
    throw error;
  }
}

export async function cleanupTempFiles(assetsDir: string): Promise<number> {
  const storage = getStorageAdapter();
  let cleanedCount = 0;
  
  try {
    const entries = await storage.listDir(assetsDir);
    
    for (const entry of entries) {
      const tempPath = await normalizeTempDirectoryEntryPath(assetsDir, entry);
      if (!tempPath) {
        continue;
      }

      try {
        await storage.deleteFile(tempPath);
        cleanedCount++;
      } catch {
      }
    }
  } catch {
  }
  
  return cleanedCount;
}

export function isTempFile(path: string): boolean {
  return path.endsWith(TEMP_EXTENSION);
}

export function getTempPath(finalPath: string): string {
  return finalPath + TEMP_EXTENSION;
}

export function getFinalPath(tempPath: string): string {
  if (!tempPath.endsWith(TEMP_EXTENSION)) {
    return tempPath;
  }
  return tempPath.slice(0, -TEMP_EXTENSION.length);
}
