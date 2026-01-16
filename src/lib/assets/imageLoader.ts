/**
 * Image Loader - Load local images as blob URLs
 * 
 * This handles the case where convertFileSrc doesn't work in dev mode
 */

import { getStorageAdapter } from '@/lib/storage/adapter';
import { getMimeType } from './filenameService';

// Cache for blob URLs to avoid re-reading files
// Using a Map as an LRU cache (insert order preservation)
const MAX_CACHE_SIZE = 500;
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

/**
 * Create a cropped image blob from a source image URL and crop pixel data
 */
export async function getCroppedImg(
  imageSrc: string,
  pixelCrop: { x: number; y: number; width: number; height: number }
): Promise<Blob | null> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return null;
  }

  // Optimize: Resize to max 256x256 for icons
  // This drastically reduces memory usage and disk space
  const MAX_DIMENSION = 256;
  const scale = Math.min(1, MAX_DIMENSION / Math.max(pixelCrop.width, pixelCrop.height));

  canvas.width = pixelCrop.width * scale;
  canvas.height = pixelCrop.height * scale;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob);
    }, 'image/png');
  });
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous'); // needed to avoid CORS issues on some images
    image.src = url;
  });
}
