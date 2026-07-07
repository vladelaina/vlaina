import { getStorageAdapter } from '@/lib/storage/adapter';
import { getMimeType } from '../core/naming';
import { toBlobPart } from '@/lib/blobPart';
import {
  assertCanStartPendingImageLoad,
  assertPreviewableImageInfo,
  assertPreviewableImagePath,
  assertPreviewableImageSize,
  bumpImagePathGeneration,
  clearImagePathGenerations,
  getCurrentImageCacheGeneration,
  getCurrentImagePathGeneration,
  getImageCacheKey,
  getKnownPreviewableImageSize,
  getKnownPreviewableModifiedAt,
  getUnvalidatedImageCacheKey,
  incrementImageCacheGeneration,
  MAX_LOCAL_IMAGE_BYTES,
  prepareImageBytes,
  revokeBlobUrlCacheEntry,
  revokeLoadedUrlIfInvalidated,
  touchBlobUrlCacheEntry,
  type BlobUrlCacheEntry,
} from './readerImageShared';
import {
  clearThumbnailImageCache,
  loadImageThumbnailBlobUrl,
  revokeThumbnailImageBlob,
} from './readerThumbnails';

const MAX_CACHE_SIZE = 500;
export const MAX_PENDING_BLOB_URL_LOADS = 100;
export { MAX_PENDING_THUMBNAIL_BLOB_URL_LOADS } from './readerThumbnails';

const blobUrlCache = new Map<string, BlobUrlCacheEntry>();
const blobUrlLoadPromises = new Map<string, Promise<string>>();

export async function loadImageAsBlob(fullPath: string): Promise<string> {
  assertPreviewableImagePath(fullPath);

  const storage = getStorageAdapter();
  const fileInfo = await storage.stat(fullPath).catch(() => null);
  const modifiedAt = getKnownPreviewableModifiedAt(fileInfo);
  const size = getKnownPreviewableImageSize(fileInfo);
  assertPreviewableImageInfo(fileInfo);
  const canValidateCache = modifiedAt !== null;
  const cached = blobUrlCache.get(fullPath);
  if (cached && canValidateCache && cached.modifiedAt === modifiedAt && cached.size === size) {
    touchBlobUrlCacheEntry(blobUrlCache, fullPath, cached);
    return cached.url;
  }

  if (cached) {
    revokeBlobUrlCacheEntry(cached);
    blobUrlCache.delete(fullPath);
  }

  const loadKey = canValidateCache
    ? getImageCacheKey(fullPath, modifiedAt, size)
    : getUnvalidatedImageCacheKey(fullPath);
  const existingLoad = blobUrlLoadPromises.get(loadKey);
  if (existingLoad) {
    return existingLoad;
  }
  assertCanStartPendingImageLoad(blobUrlLoadPromises, MAX_PENDING_BLOB_URL_LOADS);

  const loadPromise = (async () => {
    const loadGeneration = getCurrentImageCacheGeneration();
    const loadPathGeneration = getCurrentImagePathGeneration(fullPath);
    const data = await storage.readBinaryFile(fullPath, MAX_LOCAL_IMAGE_BYTES);
    assertPreviewableImageSize(data.byteLength);
    const mimeType = getMimeType(fullPath);
    const bytes = prepareImageBytes(fullPath, data);
    assertPreviewableImageSize(bytes.byteLength);
    const blob = new Blob([toBlobPart(bytes)], { type: mimeType });
    const blobUrl = URL.createObjectURL(blob);
    revokeLoadedUrlIfInvalidated(fullPath, loadGeneration, loadPathGeneration, blobUrl);

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
  })();

  blobUrlLoadPromises.set(loadKey, loadPromise);
  try {
    return await loadPromise;
  } catch (error) {
    throw error;
  } finally {
    if (blobUrlLoadPromises.get(loadKey) === loadPromise) {
      blobUrlLoadPromises.delete(loadKey);
    }
  }
}

export async function loadImageThumbnailAsBlob(
  fullPath: string,
  options?: { maxEdgePx?: number; allowMainThreadFallback?: boolean }
): Promise<string> {
  return loadImageThumbnailBlobUrl(fullPath, options, loadImageAsBlob);
}

export async function loadImageAsBase64(fullPath: string): Promise<string> {
  assertPreviewableImagePath(fullPath);

  const storage = getStorageAdapter();

  try {
    const fileInfo = await storage.stat(fullPath).catch(() => null);
    assertPreviewableImageInfo(fileInfo);
    const data = await storage.readBinaryFile(fullPath, MAX_LOCAL_IMAGE_BYTES);
    assertPreviewableImageSize(data.byteLength);
    const mimeType = getMimeType(fullPath);

    const bytes = prepareImageBytes(fullPath, data);
    assertPreviewableImageSize(bytes.byteLength);
    const blob = new Blob([toBlobPart(bytes)], { type: mimeType });

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
      reader.onerror = () => reject(reader.error ?? new Error('Failed to convert image to base64'));
      reader.onabort = () => reject(new Error('Image base64 conversion was aborted'));
      reader.readAsDataURL(blob);
    });


  } catch (error) {
    throw error;
  }
}

export function revokeImageBlob(fullPath: string): void {
  bumpImagePathGeneration(fullPath);
  const cached = blobUrlCache.get(fullPath);
  if (cached) {
    revokeBlobUrlCacheEntry(cached);
    blobUrlCache.delete(fullPath);
  }
  revokeThumbnailImageBlob(fullPath);
}

export function invalidateImageCache(fullPath: string): void {
  revokeImageBlob(fullPath);
}

export function clearImageCache(): void {
  incrementImageCacheGeneration();
  clearImagePathGenerations();
  for (const entry of blobUrlCache.values()) {
    revokeBlobUrlCacheEntry(entry);
  }
  blobUrlCache.clear();
  blobUrlLoadPromises.clear();
  clearThumbnailImageCache();
}

export function getCachedBlobUrl(fullPath: string): string | undefined {
  const cached = blobUrlCache.get(fullPath);
  
  if (cached) {
    touchBlobUrlCacheEntry(blobUrlCache, fullPath, cached);
  }
  return cached?.url;
}
