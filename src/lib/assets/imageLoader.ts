/**
 * Image Loader - Load local images as blob URLs
 * 
 * This handles the case where convertFileSrc doesn't work in dev mode
 */

import { getStorageAdapter } from '@/lib/storage/adapter';
import { getMimeType } from './filenameService';

// Cache for blob URLs to avoid re-reading files
// Using a Map as an LRU cache (insert order preservation)
const MAX_CACHE_SIZE = 50;
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
    // Refresh LRU position (delete and re-add)
    blobUrlCache.delete(fullPath);
    blobUrlCache.set(fullPath, cached);
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
    // If cache is full, remove oldest (first) item
    if (blobUrlCache.size >= MAX_CACHE_SIZE) {
      const oldestKey = blobUrlCache.keys().next().value;
      if (oldestKey) {
        const oldestUrl = blobUrlCache.get(oldestKey);
        if (oldestUrl) URL.revokeObjectURL(oldestUrl);
        blobUrlCache.delete(oldestKey);
      }
    }

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
  const cached = blobUrlCache.get(fullPath);
  // Optional: Refresh LRU on sync access? 
  // Probably yes, if we are viewing it, it's "used".
  if (cached) {
    blobUrlCache.delete(fullPath);
    blobUrlCache.set(fullPath, cached);
  }
  return cached;
}
