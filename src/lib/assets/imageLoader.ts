/**
 * Image Loader - Load local images as blob URLs
 * 
 * This handles the case where convertFileSrc doesn't work in dev mode
 */

import { getStorageAdapter } from '@/lib/storage/adapter';
import { getMimeType } from './filenameService';

// Cache for blob URLs to avoid re-reading files
const blobUrlCache = new Map<string, string>();

/**
 * Load a local image file and return a blob URL
 * @param fullPath - Full absolute path to the image file
 * @returns Blob URL that can be used in img src
 */
export async function loadImageAsBlob(fullPath: string): Promise<string> {
  // Check cache first
  const cached = blobUrlCache.get(fullPath);
  if (cached) {
    return cached;
  }

  const storage = getStorageAdapter();

  try {
    const data = await storage.readBinaryFile(fullPath);
    const mimeType = getMimeType(fullPath);
    // Create a new Uint8Array copy to ensure it's a proper ArrayBuffer
    const copy = new Uint8Array(data);
    const blob = new Blob([copy], { type: mimeType });
    const blobUrl = URL.createObjectURL(blob);

    // Cache the URL
    blobUrlCache.set(fullPath, blobUrl);

    return blobUrl;
  } catch (error) {
    console.error('Failed to load image:', fullPath, error);
    throw error;
  }
}

/**
 * Revoke a blob URL and remove from cache
 */
export function revokeImageBlob(fullPath: string): void {
  const cached = blobUrlCache.get(fullPath);
  if (cached) {
    URL.revokeObjectURL(cached);
    blobUrlCache.delete(fullPath);
  }
}

/**
 * Clear all cached blob URLs
 */
export function clearImageCache(): void {
  for (const url of blobUrlCache.values()) {
    URL.revokeObjectURL(url);
  }
  blobUrlCache.clear();
}

/**
 * Synchronously get cached blob URL if available
 */
export function getCachedBlobUrl(fullPath: string): string | undefined {
  return blobUrlCache.get(fullPath);
}
