import { getStorageAdapter, joinPath, type StorageAdapter } from '@/lib/storage/adapter';
import { getMimeType, isImageFilename } from '../core/naming';
import { computeBufferHash } from '../core/hashing';
import { sanitizeSvgBytes } from '@/lib/markdown/svgSanitizer';

const MAX_CACHE_SIZE = 500;
const MAX_THUMBNAIL_CACHE_SIZE = 300;
const MAX_LOCAL_IMAGE_BYTES = 50 * 1024 * 1024;
const THUMBNAIL_MAX_EDGE_PX = 160;
const MAX_THUMBNAIL_MAX_EDGE_PX = 2048;
const DEFAULT_THUMBNAIL_MAX_EDGE_PX = THUMBNAIL_MAX_EDGE_PX;
const PERSISTENT_THUMBNAIL_CACHE_VERSION = 'v1';

interface BlobUrlCacheEntry {
  url: string;
  modifiedAt: number | null;
  size: number | null;
}

const blobUrlCache = new Map<string, BlobUrlCacheEntry>();
const thumbnailBlobUrlCache = new Map<string, BlobUrlCacheEntry>();
const blobUrlLoadPromises = new Map<string, Promise<string>>();
const thumbnailBlobUrlLoadPromises = new Map<string, Promise<string>>();
let imageCacheGeneration = 0;
const imagePathGenerations = new Map<string, number>();
const IMAGE_CACHE_INVALIDATED_ERROR_MESSAGE = 'Image cache was invalidated while loading.';

function touchBlobUrlCacheEntry(cache: Map<string, BlobUrlCacheEntry>, key: string, entry: BlobUrlCacheEntry) {
  cache.delete(key);
  cache.set(key, entry);
}

function revokeBlobUrlCacheEntry(entry: BlobUrlCacheEntry | undefined) {
  if (entry) {
    URL.revokeObjectURL(entry.url);
  }
}

function createImageCacheInvalidatedError(): Error {
  return new Error(IMAGE_CACHE_INVALIDATED_ERROR_MESSAGE);
}

function isImageCacheInvalidatedError(error: unknown): boolean {
  return error instanceof Error && error.message === IMAGE_CACHE_INVALIDATED_ERROR_MESSAGE;
}

function getImagePathGeneration(fullPath: string): number {
  return imagePathGenerations.get(fullPath) ?? 0;
}

function bumpImagePathGeneration(fullPath: string): void {
  imagePathGenerations.set(fullPath, getImagePathGeneration(fullPath) + 1);
}

function revokeLoadedUrlIfInvalidated(
  fullPath: string,
  loadGeneration: number,
  loadPathGeneration: number,
  url: string,
): void {
  if (
    loadGeneration === imageCacheGeneration
    && loadPathGeneration === getImagePathGeneration(fullPath)
  ) {
    return;
  }

  URL.revokeObjectURL(url);
  throw createImageCacheInvalidatedError();
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
  if (typeof size !== 'number' || size > MAX_LOCAL_IMAGE_BYTES) {
    throw new Error('Image asset is too large to preview.');
  }
}

function normalizeThumbnailMaxEdgePx(value: number | undefined): number {
  const rounded = Math.round(value ?? DEFAULT_THUMBNAIL_MAX_EDGE_PX);
  if (!Number.isFinite(rounded)) {
    return DEFAULT_THUMBNAIL_MAX_EDGE_PX;
  }
  return Math.max(1, Math.min(MAX_THUMBNAIL_MAX_EDGE_PX, rounded));
}

function isSvgImagePath(fullPath: string): boolean {
  return fullPath.toLowerCase().split(/[\\/]/).pop()?.endsWith('.svg') === true;
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

async function blobToUint8Array(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

async function getPersistentThumbnailCachePath(
  storage: StorageAdapter,
  cacheKey: string
): Promise<string | null> {
  if (storage.platform !== 'electron') {
    return null;
  }

  const hashInput = new TextEncoder().encode(`${PERSISTENT_THUMBNAIL_CACHE_VERSION}\0${cacheKey}`);
  const hash = await computeBufferHash(hashInput);
  return joinPath(await storage.getBasePath(), '.vlaina', 'cache', 'image-thumbnails', `${hash}.webp`);
}

async function loadPersistentThumbnailBlobUrl(
  storage: StorageAdapter,
  persistentCachePath: string,
  _fullPath: string,
  _maxEdgePx: number
): Promise<string | null> {
  try {
    if (!(await storage.exists(persistentCachePath))) {
      return null;
    }
    const info = await storage.stat(persistentCachePath).catch(() => null);
    assertPreviewableImageSize(info?.size);
    const bytes = await storage.readBinaryFile(persistentCachePath);
    assertPreviewableImageSize(bytes.byteLength);
    return URL.createObjectURL(new Blob([bytes], { type: 'image/webp' }));
  } catch {
    return null;
  }
}

function persistThumbnailBlobInBackground(
  storage: StorageAdapter,
  persistentCachePath: string | null,
  _fullPath: string,
  _maxEdgePx: number,
  blob: Blob
): void {
  if (!persistentCachePath) {
    return;
  }

  void blobToUint8Array(blob)
    .then((bytes) => {
      assertPreviewableImageSize(blob.size);
      assertPreviewableImageSize(bytes.byteLength);
      return storage.writeBinaryFile(persistentCachePath, bytes, { recursive: true });
    })
    .catch(() => {});
}

function createThumbnailBlobInWorker(
  bytes: Uint8Array,
  mimeType: string,
  maxEdgePx: number
): Promise<Blob> | null {
  if (
    typeof Worker === 'undefined' ||
    typeof Blob === 'undefined'
  ) {
    return null;
  }

  let worker: Worker;
  try {
    worker = new Worker(new URL('./imageThumbnail.worker.ts', import.meta.url), { type: 'module' });
  } catch (error) {
    return Promise.reject(error);
  }

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      worker.terminate();
    };
    worker.onmessage = (event: MessageEvent<{ ok: boolean; blob?: Blob; message?: string }>) => {
      cleanup();
      if (event.data?.ok && event.data.blob) {
        resolve(event.data.blob);
        return;
      }
      reject(new Error(event.data?.message || 'Failed to create thumbnail in worker'));
    };
    worker.onerror = (event) => {
      cleanup();
      reject(new Error(event.message || 'Thumbnail worker failed'));
    };
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    worker.postMessage({ buffer, mimeType, maxEdgePx }, [buffer]);
  });
}

async function createThumbnailBlobUrl(
  fullPath: string,
  bytes: Uint8Array,
  mimeType: string,
  maxEdgePx = DEFAULT_THUMBNAIL_MAX_EDGE_PX,
  allowMainThreadFallback = true,
  onThumbnailBlob?: (blob: Blob) => void
): Promise<string> {
  if (isSvgImagePath(fullPath)) {
    const blob = new Blob([prepareImageBytes(fullPath, bytes)], { type: mimeType });
    return URL.createObjectURL(blob);
  }

  const workerThumbnailPromise = createThumbnailBlobInWorker(bytes, mimeType, maxEdgePx);
  const workerThumbnailBlob = workerThumbnailPromise
    ? await workerThumbnailPromise.catch(() => null)
    : null;
  if (workerThumbnailBlob) {
    onThumbnailBlob?.(workerThumbnailBlob);
    return URL.createObjectURL(workerThumbnailBlob);
  }

  if (!allowMainThreadFallback) {
    const blob = new Blob([bytes], { type: mimeType });
    return URL.createObjectURL(blob);
  }

  const sourceBlob = new Blob([bytes], { type: mimeType });
  const sourceUrl = URL.createObjectURL(sourceBlob);

  try {
    const image = await loadImageElement(sourceUrl);
    const scale = Math.min(
      1,
      maxEdgePx / Math.max(image.naturalWidth || 1, image.naturalHeight || 1),
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
    onThumbnailBlob?.(thumbnailBlob);

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

  const loadPromise = (async () => {
    const loadGeneration = imageCacheGeneration;
    const loadPathGeneration = getImagePathGeneration(fullPath);
    const data = await storage.readBinaryFile(fullPath);
    assertPreviewableImageSize(data.byteLength);
    const mimeType = getMimeType(fullPath);
    const bytes = prepareImageBytes(fullPath, data);
    assertPreviewableImageSize(bytes.byteLength);
    const blob = new Blob([bytes], { type: mimeType });
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
  assertPreviewableImagePath(fullPath);

  const storage = getStorageAdapter();
  const fileInfo = await storage.stat(fullPath).catch(() => null);
  const modifiedAt = fileInfo?.modifiedAt ?? null;
  const size = fileInfo?.size ?? null;
  assertPreviewableImageSize(size);
  const canValidateCache = modifiedAt !== null;
  const maxEdgePx = normalizeThumbnailMaxEdgePx(options?.maxEdgePx);
  const allowMainThreadFallback = options?.allowMainThreadFallback ?? true;
  const fallbackMode = allowMainThreadFallback ? 'fallback' : 'no-fallback';
  const cacheKey = canValidateCache
    ? `${getImageCacheKey(fullPath, modifiedAt, size)}::thumb:${maxEdgePx}:${fallbackMode}`
    : `${getUnvalidatedImageCacheKey(fullPath)}::thumb:${maxEdgePx}:${fallbackMode}`;
  const cached = thumbnailBlobUrlCache.get(cacheKey);
  if (cached && canValidateCache) {
    touchBlobUrlCacheEntry(thumbnailBlobUrlCache, cacheKey, cached);
    return cached.url;
  }
  if (cached) {
    revokeBlobUrlCacheEntry(cached);
    thumbnailBlobUrlCache.delete(cacheKey);
  }

  const existingLoad = thumbnailBlobUrlLoadPromises.get(cacheKey);
  if (existingLoad) {
    return existingLoad;
  }

  const loadPromise = (async () => {
    const loadGeneration = imageCacheGeneration;
    const loadPathGeneration = getImagePathGeneration(fullPath);
    const persistentCachePath = canValidateCache
      ? await getPersistentThumbnailCachePath(storage, cacheKey)
      : null;
    if (persistentCachePath) {
      const persistentBlobUrl = await loadPersistentThumbnailBlobUrl(storage, persistentCachePath, fullPath, maxEdgePx);
      if (persistentBlobUrl) {
        revokeLoadedUrlIfInvalidated(fullPath, loadGeneration, loadPathGeneration, persistentBlobUrl);
        if (thumbnailBlobUrlCache.size >= MAX_THUMBNAIL_CACHE_SIZE) {
          const oldestKey = thumbnailBlobUrlCache.keys().next().value;
          if (oldestKey) {
            revokeBlobUrlCacheEntry(thumbnailBlobUrlCache.get(oldestKey));
            thumbnailBlobUrlCache.delete(oldestKey);
          }
        }
        thumbnailBlobUrlCache.set(cacheKey, {
          url: persistentBlobUrl,
          modifiedAt,
          size,
        });
        return persistentBlobUrl;
      }
    }

    const data = await storage.readBinaryFile(fullPath);
    assertPreviewableImageSize(data.byteLength);
    const mimeType = getMimeType(fullPath);
    const blobUrl = await createThumbnailBlobUrl(
      fullPath,
      prepareImageBytes(fullPath, data),
      mimeType,
      maxEdgePx,
      allowMainThreadFallback,
      (blob) => persistThumbnailBlobInBackground(storage, persistentCachePath, fullPath, maxEdgePx, blob),
    );
    revokeLoadedUrlIfInvalidated(fullPath, loadGeneration, loadPathGeneration, blobUrl);

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
    if (isImageCacheInvalidatedError(error)) {
      throw error;
    }
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
    assertPreviewableImageSize(fileInfo?.size);
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
  imageCacheGeneration += 1;
  imagePathGenerations.clear();
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
