import { isImageFilename } from '../core/naming';
import { sanitizeSvgBytes } from '@/lib/markdown/svgSanitizer';
import {
  getImageCacheGeneration,
  incrementImageCacheGeneration as incrementSharedImageCacheGeneration,
} from './imageCacheGeneration';

export const MAX_LOCAL_IMAGE_BYTES = 50 * 1024 * 1024;

export interface BlobUrlCacheEntry {
  url: string;
  modifiedAt: number | null;
  size: number | null;
}

const imagePathGenerations = new Map<string, number>();
const IMAGE_CACHE_INVALIDATED_ERROR_MESSAGE = 'Image cache was invalidated while loading.';

export function touchBlobUrlCacheEntry(cache: Map<string, BlobUrlCacheEntry>, key: string, entry: BlobUrlCacheEntry) {
  cache.delete(key);
  cache.set(key, entry);
}

export function assertCanStartPendingImageLoad(
  pendingLoads: Map<string, Promise<string>>,
  maxPendingLoads: number
): void {
  if (pendingLoads.size >= maxPendingLoads) {
    throw new Error('Too many image asset previews are loading.');
  }
}

export function revokeBlobUrlCacheEntry(entry: BlobUrlCacheEntry | undefined) {
  if (entry) {
    URL.revokeObjectURL(entry.url);
  }
}

function createImageCacheInvalidatedError(): Error {
  return new Error(IMAGE_CACHE_INVALIDATED_ERROR_MESSAGE);
}

export function isImageCacheInvalidatedError(error: unknown): boolean {
  return error instanceof Error && error.message === IMAGE_CACHE_INVALIDATED_ERROR_MESSAGE;
}

function getImagePathGeneration(fullPath: string): number {
  return imagePathGenerations.get(fullPath) ?? 0;
}

export function bumpImagePathGeneration(fullPath: string): void {
  imagePathGenerations.set(fullPath, getImagePathGeneration(fullPath) + 1);
}

export function incrementImageCacheGeneration(): void {
  incrementSharedImageCacheGeneration();
}

export function clearImagePathGenerations(): void {
  imagePathGenerations.clear();
}

export function revokeLoadedUrlIfInvalidated(
  fullPath: string,
  loadGeneration: number,
  loadPathGeneration: number,
  url: string,
): void {
  if (
    loadGeneration === getImageCacheGeneration()
    && loadPathGeneration === getImagePathGeneration(fullPath)
  ) {
    return;
  }

  URL.revokeObjectURL(url);
  throw createImageCacheInvalidatedError();
}

export function getCurrentImageCacheGeneration(): number {
  return getImageCacheGeneration();
}

export function getCurrentImagePathGeneration(fullPath: string): number {
  return getImagePathGeneration(fullPath);
}

export function getImageCacheKey(fullPath: string, modifiedAt: number | null, size: number | null) {
  return `${fullPath}::${modifiedAt ?? 'm'}::${size ?? 's'}`;
}

export function getUnvalidatedImageCacheKey(fullPath: string) {
  return `${fullPath}::unvalidated`;
}

export function assertPreviewableImagePath(fullPath: string): void {
  if (!isImageFilename(fullPath)) {
    throw new Error('Only image files can be loaded as note assets.');
  }
}

function isPreviewableImageSize(size: number): boolean {
  return Number.isFinite(size) && size >= 0 && size <= MAX_LOCAL_IMAGE_BYTES;
}

export function getKnownPreviewableImageSize(
  info: { size?: number | null } | null | undefined,
): number | null {
  return typeof info?.size === 'number' && isPreviewableImageSize(info.size)
    ? info.size
    : null;
}

export function getKnownPreviewableModifiedAt(
  info: { modifiedAt?: number | null } | null | undefined,
): number | null {
  return typeof info?.modifiedAt === 'number' && Number.isFinite(info.modifiedAt)
    ? info.modifiedAt
    : null;
}

export function assertPreviewableImageSize(size: number | null | undefined): void {
  if (typeof size !== 'number' || !isPreviewableImageSize(size)) {
    throw new Error('Image asset is too large to preview.');
  }
}

export function assertPreviewableImageInfo(
  info: { isDirectory?: boolean; isFile?: boolean; size?: number | null } | null | undefined,
): void {
  if (
    info?.isFile === false ||
    info?.isDirectory === true ||
    (typeof info?.size === 'number' && !isPreviewableImageSize(info.size))
  ) {
    throw new Error('Image asset is too large to preview.');
  }
}

export function isSvgImagePath(fullPath: string): boolean {
  return fullPath.toLowerCase().split(/[\\/]/).pop()?.endsWith('.svg') === true;
}

export function prepareImageBytes(fullPath: string, data: Uint8Array): Uint8Array {
  const copy = new Uint8Array(data);
  return isSvgImagePath(fullPath) ? sanitizeSvgBytes(copy) : copy;
}
