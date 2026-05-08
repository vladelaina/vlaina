import DOMPurify from 'dompurify';
import { getStorageAdapter } from '@/lib/storage/adapter';
import { getMimeType, isImageFilename } from '../core/naming';

const MAX_CACHE_SIZE = 500;
const MAX_THUMBNAIL_CACHE_SIZE = 300;
const MAX_LOCAL_IMAGE_BYTES = 50 * 1024 * 1024;
const THUMBNAIL_MAX_EDGE_PX = 160;

interface BlobUrlCacheEntry {
  url: string;
  modifiedAt: number | null;
  size: number | null;
}

const blobUrlCache = new Map<string, BlobUrlCacheEntry>();
const thumbnailBlobUrlCache = new Map<string, BlobUrlCacheEntry>();
const blobUrlLoadPromises = new Map<string, Promise<string>>();
const thumbnailBlobUrlLoadPromises = new Map<string, Promise<string>>();

function touchBlobUrlCacheEntry(cache: Map<string, BlobUrlCacheEntry>, key: string, entry: BlobUrlCacheEntry) {
  cache.delete(key);
  cache.set(key, entry);
}

function revokeBlobUrlCacheEntry(entry: BlobUrlCacheEntry | undefined) {
  if (entry) {
    URL.revokeObjectURL(entry.url);
  }
}

function getImageCacheKey(fullPath: string, modifiedAt: number | null, size: number | null) {
  return `${fullPath}::${modifiedAt ?? 'm'}::${size ?? 's'}`;
}

function getUnvalidatedImageCacheKey(fullPath: string) {
  return `${fullPath}::unvalidated`;
}

function assertPreviewableImagePath(fullPath: string): void {
  if (!isImageFilename(fullPath)) {
    throw new Error('Only image files can be loaded as note assets.');
  }
}

function assertPreviewableImageSize(size: number | null | undefined): void {
  if (typeof size === 'number' && size > MAX_LOCAL_IMAGE_BYTES) {
    throw new Error('Image asset is too large to preview.');
  }
}

function isSvgImagePath(fullPath: string): boolean {
  return fullPath.toLowerCase().split(/[\\/]/).pop()?.endsWith('.svg') === true;
}

function sanitizeSvgBytes(data: Uint8Array): Uint8Array {
  const svgText = new TextDecoder().decode(data);
  const sanitized = DOMPurify.sanitize(svgText, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ['foreignObject', 'script', 'iframe', 'object', 'embed'],
  });
  return new TextEncoder().encode(sanitized);
}

function prepareImageBytes(fullPath: string, data: Uint8Array): Uint8Array {
  const copy = new Uint8Array(data);
  return isSvgImagePath(fullPath) ? sanitizeSvgBytes(copy) : copy;
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to decode image'));
    image.src = src;
  });
}

async function createThumbnailBlobUrl(fullPath: string, bytes: Uint8Array, mimeType: string): Promise<string> {
  if (isSvgImagePath(fullPath)) {
    const blob = new Blob([prepareImageBytes(fullPath, bytes)], { type: mimeType });
    return URL.createObjectURL(blob);
  }

  const sourceBlob = new Blob([bytes], { type: mimeType });
  const sourceUrl = URL.createObjectURL(sourceBlob);

  try {
    const image = await loadImageElement(sourceUrl);
    const scale = Math.min(
      1,
      THUMBNAIL_MAX_EDGE_PX / Math.max(image.naturalWidth || 1, image.naturalHeight || 1),
    );
    const width = Math.max(1, Math.round((image.naturalWidth || 1) * scale));
    const height = Math.max(1, Math.round((image.naturalHeight || 1) * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) {
      throw new Error('Canvas is unavailable');
    }
    context.drawImage(image, 0, 0, width, height);

    const thumbnailBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create thumbnail'));
        }
      }, 'image/webp', 0.82);
    });

    return URL.createObjectURL(thumbnailBlob);
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

export async function loadImageAsBlob(fullPath: string): Promise<string> {
  assertPreviewableImagePath(fullPath);

  const storage = getStorageAdapter();
  const fileInfo = await storage.stat(fullPath).catch(() => null);
  const modifiedAt = fileInfo?.modifiedAt ?? null;
  const size = fileInfo?.size ?? null;
  assertPreviewableImageSize(size);
  const canValidateCache = modifiedAt !== null || size !== null;
  const cached = blobUrlCache.get(fullPath);
  if (cached && (!canValidateCache || (cached.modifiedAt === modifiedAt && cached.size === size))) {
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

  const loadPromise = (async () => {
    const data = await storage.readBinaryFile(fullPath);
    assertPreviewableImageSize(data.byteLength);
    const mimeType = getMimeType(fullPath);
    const bytes = prepareImageBytes(fullPath, data);
    assertPreviewableImageSize(bytes.byteLength);
    const blob = new Blob([bytes], { type: mimeType });
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
  })();

  blobUrlLoadPromises.set(loadKey, loadPromise);
  try {
    return await loadPromise;
  } catch (error) {
    console.error('Failed to load image:', fullPath, error);
    throw error;
  } finally {
    if (blobUrlLoadPromises.get(loadKey) === loadPromise) {
      blobUrlLoadPromises.delete(loadKey);
    }
  }
}

export async function loadImageThumbnailAsBlob(fullPath: string): Promise<string> {
  assertPreviewableImagePath(fullPath);

  const storage = getStorageAdapter();
  const fileInfo = await storage.stat(fullPath).catch(() => null);
  const modifiedAt = fileInfo?.modifiedAt ?? null;
  const size = fileInfo?.size ?? null;
  assertPreviewableImageSize(size);
  const canValidateCache = modifiedAt !== null || size !== null;
  const cacheKey = canValidateCache
    ? getImageCacheKey(fullPath, modifiedAt, size)
    : getUnvalidatedImageCacheKey(fullPath);
  const cached = thumbnailBlobUrlCache.get(cacheKey);
  if (cached) {
    touchBlobUrlCacheEntry(thumbnailBlobUrlCache, cacheKey, cached);
    return cached.url;
  }

  const existingLoad = thumbnailBlobUrlLoadPromises.get(cacheKey);
  if (existingLoad) {
    return existingLoad;
  }

  const loadPromise = (async () => {
    const data = await storage.readBinaryFile(fullPath);
    assertPreviewableImageSize(data.byteLength);
    const mimeType = getMimeType(fullPath);
    const blobUrl = await createThumbnailBlobUrl(fullPath, prepareImageBytes(fullPath, data), mimeType);

    if (thumbnailBlobUrlCache.size >= MAX_THUMBNAIL_CACHE_SIZE) {
      const oldestKey = thumbnailBlobUrlCache.keys().next().value;
      if (oldestKey) {
        revokeBlobUrlCacheEntry(thumbnailBlobUrlCache.get(oldestKey));
        thumbnailBlobUrlCache.delete(oldestKey);
      }
    }

    thumbnailBlobUrlCache.set(cacheKey, {
      url: blobUrl,
      modifiedAt,
      size,
    });

    return blobUrl;
  })();

  thumbnailBlobUrlLoadPromises.set(cacheKey, loadPromise);
  try {
    return await loadPromise;
  } catch (error) {
    console.error('Failed to load image thumbnail:', fullPath, error);
    return loadImageAsBlob(fullPath);
  } finally {
    if (thumbnailBlobUrlLoadPromises.get(cacheKey) === loadPromise) {
      thumbnailBlobUrlLoadPromises.delete(cacheKey);
    }
  }
}

export async function loadImageAsBase64(fullPath: string): Promise<string> {
  assertPreviewableImagePath(fullPath);

  const storage = getStorageAdapter();

  try {
    const fileInfo = await storage.stat(fullPath).catch(() => null);
    assertPreviewableImageSize(fileInfo?.size ?? null);
    const data = await storage.readBinaryFile(fullPath);
    assertPreviewableImageSize(data.byteLength);
    const mimeType = getMimeType(fullPath);

    const bytes = prepareImageBytes(fullPath, data);
    assertPreviewableImageSize(bytes.byteLength);
    const blob = new Blob([bytes], { type: mimeType });

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

  for (const [cacheKey, entry] of thumbnailBlobUrlCache.entries()) {
    if (cacheKey === fullPath || cacheKey.startsWith(`${fullPath}::`)) {
      revokeBlobUrlCacheEntry(entry);
      thumbnailBlobUrlCache.delete(cacheKey);
    }
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
  for (const entry of thumbnailBlobUrlCache.values()) {
    revokeBlobUrlCacheEntry(entry);
  }
  thumbnailBlobUrlCache.clear();
  blobUrlLoadPromises.clear();
  thumbnailBlobUrlLoadPromises.clear();
}

export function getCachedBlobUrl(fullPath: string): string | undefined {
  const cached = blobUrlCache.get(fullPath);
  
  if (cached) {
    touchBlobUrlCacheEntry(blobUrlCache, fullPath, cached);
  }
  return cached?.url;
}
