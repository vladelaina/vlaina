import { getParentPath, getStorageAdapter, joinPath, type StorageAdapter } from '@/lib/storage/adapter';
import { getMimeType } from '../core/naming';
import { computeBufferHash } from '../core/hashing';
import { toBlobPart } from '@/lib/blobPart';
import { createThumbnailBlobUrl } from './readerThumbnailCreate';
import {
  assertCanStartPendingImageLoad,
  assertPreviewableImageInfo,
  assertPreviewableImagePath,
  assertPreviewableImageSize,
  getCurrentImageCacheGeneration,
  getCurrentImagePathGeneration,
  getImageCacheKey,
  getKnownPreviewableImageSize,
  getKnownPreviewableModifiedAt,
  getUnvalidatedImageCacheKey,
  isImageCacheInvalidatedError,
  MAX_LOCAL_IMAGE_BYTES,
  prepareImageBytes,
  revokeBlobUrlCacheEntry,
  revokeLoadedUrlIfInvalidated,
  touchBlobUrlCacheEntry,
  type BlobUrlCacheEntry,
} from './readerImageShared';

const MAX_THUMBNAIL_CACHE_SIZE = 300;
export const MAX_PENDING_THUMBNAIL_BLOB_URL_LOADS = 100;
const THUMBNAIL_MAX_EDGE_PX = 160;
const MAX_THUMBNAIL_MAX_EDGE_PX = 2048;
const DEFAULT_THUMBNAIL_MAX_EDGE_PX = THUMBNAIL_MAX_EDGE_PX;
const PERSISTENT_THUMBNAIL_CACHE_VERSION = 'v1';
const MAX_PERSISTENT_THUMBNAIL_CACHE_ENTRIES = 2000;
const MAX_PERSISTENT_THUMBNAIL_CACHE_BYTES = 256 * 1024 * 1024;
const PERSISTENT_THUMBNAIL_CLEANUP_WRITE_INTERVAL = 100;

const thumbnailBlobUrlCache = new Map<string, BlobUrlCacheEntry>();
const thumbnailBlobUrlLoadPromises = new Map<string, Promise<string>>();
let persistentThumbnailWritesSinceCleanup = PERSISTENT_THUMBNAIL_CLEANUP_WRITE_INTERVAL;
let persistentThumbnailCleanup: Promise<void> | null = null;

function schedulePersistentThumbnailCleanup(
  storage: StorageAdapter,
  persistentCachePath: string,
): void {
  persistentThumbnailWritesSinceCleanup += 1;
  if (
    persistentThumbnailWritesSinceCleanup < PERSISTENT_THUMBNAIL_CLEANUP_WRITE_INTERVAL
    || persistentThumbnailCleanup
  ) {
    return;
  }

  const cacheDirectory = getParentPath(persistentCachePath);
  if (!cacheDirectory) return;
  persistentThumbnailWritesSinceCleanup = 0;
  persistentThumbnailCleanup = (async () => {
    const entries = await storage.listDir(cacheDirectory).catch(() => []);
    const files = entries
      .filter((entry) => entry.isFile)
      .sort((first, second) => (
        (second.modifiedAt ?? second.createdAt ?? 0) -
        (first.modifiedAt ?? first.createdAt ?? 0)
      ));
    let totalBytes = files.reduce((total, entry) => total + (entry.size ?? 0), 0);
    for (let index = files.length - 1; index >= 0; index -= 1) {
      if (
        index < MAX_PERSISTENT_THUMBNAIL_CACHE_ENTRIES
        && totalBytes <= MAX_PERSISTENT_THUMBNAIL_CACHE_BYTES
      ) {
        break;
      }
      const entry = files[index];
      if (!entry) continue;
      try {
        await storage.deleteFile(entry.path);
        totalBytes -= entry.size ?? 0;
      } catch {
      }
    }
  })().finally(() => {
    persistentThumbnailCleanup = null;
  });
}

function normalizeThumbnailMaxEdgePx(value: number | undefined): number {
  const rounded = Math.round(value ?? DEFAULT_THUMBNAIL_MAX_EDGE_PX);
  if (!Number.isFinite(rounded)) {
    return DEFAULT_THUMBNAIL_MAX_EDGE_PX;
  }
  return Math.max(1, Math.min(MAX_THUMBNAIL_MAX_EDGE_PX, rounded));
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
  return joinPath(await storage.getBasePath(), '.vlaina', 'app', 'cache', 'thumbnails', `${hash}.webp`);
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
    assertPreviewableImageInfo(info);
    const bytes = await storage.readBinaryFile(persistentCachePath, MAX_LOCAL_IMAGE_BYTES);
    assertPreviewableImageSize(bytes.byteLength);
    return URL.createObjectURL(new Blob([toBlobPart(bytes)], { type: 'image/webp' }));
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
    .then(() => schedulePersistentThumbnailCleanup(storage, persistentCachePath))
    .catch(() => {});
}

export async function loadImageThumbnailBlobUrl(
  fullPath: string,
  options: { maxEdgePx?: number; allowMainThreadFallback?: boolean } | undefined,
  fallbackLoadImageAsBlob: (path: string) => Promise<string>
): Promise<string> {
  assertPreviewableImagePath(fullPath);

  const storage = getStorageAdapter();
  const fileInfo = await storage.stat(fullPath).catch(() => null);
  const modifiedAt = getKnownPreviewableModifiedAt(fileInfo);
  const size = getKnownPreviewableImageSize(fileInfo);
  assertPreviewableImageInfo(fileInfo);
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
  assertCanStartPendingImageLoad(
    thumbnailBlobUrlLoadPromises,
    MAX_PENDING_THUMBNAIL_BLOB_URL_LOADS
  );

  const loadPromise = (async () => {
    const loadGeneration = getCurrentImageCacheGeneration();
    const loadPathGeneration = getCurrentImagePathGeneration(fullPath);
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

    const data = await storage.readBinaryFile(fullPath, MAX_LOCAL_IMAGE_BYTES);
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
    return fallbackLoadImageAsBlob(fullPath);
  } finally {
    if (thumbnailBlobUrlLoadPromises.get(cacheKey) === loadPromise) {
      thumbnailBlobUrlLoadPromises.delete(cacheKey);
    }
  }
}

export function revokeThumbnailImageBlob(fullPath: string): void {
  for (const [cacheKey, entry] of thumbnailBlobUrlCache.entries()) {
    if (cacheKey === fullPath || cacheKey.startsWith(`${fullPath}::`)) {
      revokeBlobUrlCacheEntry(entry);
      thumbnailBlobUrlCache.delete(cacheKey);
    }
  }
}

export function clearThumbnailImageCache(): void {
  for (const entry of thumbnailBlobUrlCache.values()) {
    revokeBlobUrlCacheEntry(entry);
  }
  thumbnailBlobUrlCache.clear();
  thumbnailBlobUrlLoadPromises.clear();
  persistentThumbnailWritesSinceCleanup = PERSISTENT_THUMBNAIL_CLEANUP_WRITE_INTERVAL;
}
