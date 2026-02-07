import { getStorageAdapter } from '@/lib/storage/adapter';
import { getMimeType } from '../core/naming';

const MAX_CACHE_SIZE = 500;
const blobUrlCache = new Map<string, string>();

export async function loadImageAsBlob(fullPath: string): Promise<string> {
  const cached = blobUrlCache.get(fullPath);
  if (cached) {
    blobUrlCache.delete(fullPath);
    blobUrlCache.set(fullPath, cached);
    return cached;
  }

  const storage = getStorageAdapter();

  try {
    const data = await storage.readBinaryFile(fullPath);
    const mimeType = getMimeType(fullPath);
    const copy = new Uint8Array(data);
    const blob = new Blob([copy], { type: mimeType });
    const blobUrl = URL.createObjectURL(blob);

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

export async function loadImageAsBase64(fullPath: string): Promise<string> {
  const storage = getStorageAdapter();

  try {
    const data = await storage.readBinaryFile(fullPath);
    const mimeType = getMimeType(fullPath);

    const copy = new Uint8Array(data);
    const blob = new Blob([copy], { type: mimeType });

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result;
        if (typeof result === 'string') {
          resolve(result);
        } else {
          reject(new Error('Failed to convert image to base64'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });


  } catch (error) {
    console.error('Failed to load image as base64:', fullPath, error);
    throw error;
  }
}

export function revokeImageBlob(fullPath: string): void {
  const cached = blobUrlCache.get(fullPath);
  if (cached) {
    URL.revokeObjectURL(cached);
    blobUrlCache.delete(fullPath);
  }
}

export function invalidateImageCache(fullPath: string): void {
  blobUrlCache.delete(fullPath);
}

export function clearImageCache(): void {
  for (const url of blobUrlCache.values()) {
    URL.revokeObjectURL(url);
  }
  blobUrlCache.clear();
}

export function getCachedBlobUrl(fullPath: string): string | undefined {
  const cached = blobUrlCache.get(fullPath);
  
  if (cached) {
    blobUrlCache.delete(fullPath);
    blobUrlCache.set(fullPath, cached);
  }
  return cached;
}
