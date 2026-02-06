import { getStorageAdapter } from '@/lib/storage/adapter';

const TEMP_EXTENSION = '.tmp';

export async function writeAssetAtomic(
  targetPath: string,
  data: Uint8Array
): Promise<void> {
  const storage = getStorageAdapter();
  const tempPath = targetPath + TEMP_EXTENSION;
  
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
      if (entry.name.endsWith(TEMP_EXTENSION)) {
        try {
          const fullPath = `${assetsDir}/${entry.name}`;
          await storage.deleteFile(fullPath);
          cleanedCount++;
        } catch {
        }
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
