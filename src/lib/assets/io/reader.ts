import { getStorageAdapter } from '@/lib/storage/adapter';
import { getMimeType } from '../core/naming';

const MAX_CACHE_SIZE = 500;

interface BlobUrlCacheEntry {
  url: string;
  modifiedAt: number | null;
  size: number | null;
}

const blobUrlCache = new Map<string, BlobUrlCacheEntry>();

function touchBlobUrlCacheEntry(fullPath: string, entry: BlobUrlCacheEntry) {
  blobUrlCache.delete(fullPath);
  blobUrlCache.set(fullPath, entry);
}

function revokeBlobUrlCacheEntry(entry: BlobUrlCacheEntry | undefined) {
  if (entry) {
    URL.revokeObjectURL(entry.url);
  }
}

export async function loadImageAsBlob(fullPath: string): Promise<string> {
  const storage = getStorageAdapter();
  const fileInfo = await storage.stat(fullPath).catch(() => null);
  const modifiedAt = fileInfo?.modifiedAt ?? null;
  const size = fileInfo?.size ?? null;
  const canValidateCache = modifiedAt !== null || size !== null;
  const cached = blobUrlCache.get(fullPath);
  if (cached && canValidateCache && cached.modifiedAt === modifiedAt && cached.size === size) {
    touchBlobUrlCacheEntry(fullPath, cached);
    return cached.url;
  }

  if (cached) {
    revokeBlobUrlCacheEntry(cached);
    blobUrlCache.delete(fullPath);
  }

  try {
    const data = await storage.readBinaryFile(fullPath);
    const mimeType = getMimeType(fullPath);
    const copy = new Uint8Array(data);
    const blob = new Blob([copy], { type: mimeType });
    const blobUrl = URL.createObjectURL(blob);

    if (blobUrlCache.size >= MAX_CACHE_SIZE) {
      const oldestKey = blobUrlCache.keys().next().value;
      if (oldestKey) {
        revokeBlobUrlCacheEntry(blobUrlCache.get(oldestKey));
        blobUrlCache.delete(oldestKey);
      }
    }

    blobUrlCache.set(fullPath, {
      url: blobUrl,
      modifiedAt,
      size,
    });

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
    revokeBlobUrlCacheEntry(cached);
    blobUrlCache.delete(fullPath);
  }
}

export function invalidateImageCache(fullPath: string): void {
  revokeImageBlob(fullPath);
}

export function clearImageCache(): void {
  for (const entry of blobUrlCache.values()) {
    revokeBlobUrlCacheEntry(entry);
  }
  blobUrlCache.clear();
}

export function getCachedBlobUrl(fullPath: string): string | undefined {
  const cached = blobUrlCache.get(fullPath);
  
  if (cached) {
    touchBlobUrlCacheEntry(fullPath, cached);
  }
  return cached?.url;
}
