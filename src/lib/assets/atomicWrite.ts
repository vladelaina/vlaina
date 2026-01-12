/**
 * Atomic Write Service
 * Safe file operations with temp file pattern for crash recovery
 */

import { getStorageAdapter } from '@/lib/storage/adapter';

const TEMP_EXTENSION = '.tmp';

/**
 * Write data to a file atomically using temp file + rename pattern
 * This ensures no partial files are left if the operation is interrupted
 */
export async function writeAssetAtomic(
  targetPath: string,
  data: Uint8Array
): Promise<void> {
  const storage = getStorageAdapter();
  const tempPath = targetPath + TEMP_EXTENSION;
  
  try {
    // Write to temp file first
    await storage.writeBinaryFile(tempPath, data);
    
    // Rename temp to final (atomic on most filesystems)
    await storage.rename(tempPath, targetPath);
  } catch (error) {
    // Clean up temp file if it exists
    try {
      if (await storage.exists(tempPath)) {
        await storage.deleteFile(tempPath);
      }
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}

/**
 * Clean up any orphaned .tmp files in a directory
 * Should be called on app startup
 */
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
          // Ignore individual file deletion errors
        }
      }
    }
  } catch {
    // Directory might not exist yet, that's fine
  }
  
  return cleanedCount;
}

/**
 * Check if a path is a temp file
 */
export function isTempFile(path: string): boolean {
  return path.endsWith(TEMP_EXTENSION);
}

/**
 * Get the final path from a temp path
 */
export function getTempPath(finalPath: string): string {
  return finalPath + TEMP_EXTENSION;
}

/**
 * Get the final path from a temp path
 */
export function getFinalPath(tempPath: string): string {
  if (!tempPath.endsWith(TEMP_EXTENSION)) {
    return tempPath;
  }
  return tempPath.slice(0, -TEMP_EXTENSION.length);
}
