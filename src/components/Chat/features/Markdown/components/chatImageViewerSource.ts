import {
  normalizeDirectChatImageSource,
  resolveSafeChatImageSource,
} from "@/components/Chat/common/chatImageSourceResolution";
import { isSvgDataUrl } from "@/components/Chat/common/svgRasterize";
import { createStoredAttachmentFromSource } from "@/lib/storage/attachmentStorage";

export const TRANSPARENT_IMAGE_DATA_URL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
export const RESOLVED_VIEWER_IMAGE_CACHE_CHAR_LIMIT = 32 * 1024 * 1024;

const RESOLVED_VIEWER_IMAGE_CACHE_LIMIT = 100;
const resolvedViewerImageCache = new Map<string, Promise<string | null>>();
const resolvedViewerImageCacheSizes = new Map<string, number>();
let resolvedViewerImageCacheChars = 0;

export function requiresAttachmentResolution(src: string): boolean {
  return createStoredAttachmentFromSource(src) !== null;
}

function removeResolvedViewerImageCacheEntry(src: string): void {
  const cachedSize = resolvedViewerImageCacheSizes.get(src) ?? 0;
  if (cachedSize > 0) {
    resolvedViewerImageCacheChars = Math.max(0, resolvedViewerImageCacheChars - cachedSize);
  }
  resolvedViewerImageCacheSizes.delete(src);
  resolvedViewerImageCache.delete(src);
}

function pruneResolvedViewerImageCache(): void {
  while (resolvedViewerImageCacheChars > RESOLVED_VIEWER_IMAGE_CACHE_CHAR_LIMIT) {
    const oldestKey = resolvedViewerImageCacheSizes.keys().next().value;
    if (!oldestKey) {
      break;
    }
    removeResolvedViewerImageCacheEntry(oldestKey);
  }
}

function rememberResolvedViewerImageCacheSize(src: string, resolvedSrc: string | null): void {
  if (!resolvedViewerImageCache.has(src)) {
    return;
  }

  const nextSize = resolvedSrc?.length ?? 0;
  const previousSize = resolvedViewerImageCacheSizes.get(src) ?? 0;
  resolvedViewerImageCacheChars = Math.max(0, resolvedViewerImageCacheChars - previousSize);
  resolvedViewerImageCacheSizes.delete(src);

  if (nextSize <= 0 || nextSize > RESOLVED_VIEWER_IMAGE_CACHE_CHAR_LIMIT) {
    removeResolvedViewerImageCacheEntry(src);
    return;
  }

  resolvedViewerImageCacheSizes.set(src, nextSize);
  resolvedViewerImageCacheChars += nextSize;
  pruneResolvedViewerImageCache();
}

export function getInitialViewerImageSource(src: string): string {
  if (requiresAttachmentResolution(src)) {
    return src;
  }
  return getInitialDirectViewerImageSource(src) ?? TRANSPARENT_IMAGE_DATA_URL;
}

export function getInitialDirectViewerImageSource(src: string | null | undefined): string | null {
  if (!src) {
    return null;
  }
  const directSrc = normalizeDirectChatImageSource(src);
  return directSrc && !isSvgDataUrl(directSrc) ? directSrc : null;
}

export async function resolveViewerImageSource(src: string): Promise<string | null> {
  if (!requiresAttachmentResolution(src)) {
    return resolveSafeChatImageSource(src, "viewer-image");
  }

  const cached = resolvedViewerImageCache.get(src);
  if (cached) {
    resolvedViewerImageCache.delete(src);
    resolvedViewerImageCache.set(src, cached);
    const cachedSize = resolvedViewerImageCacheSizes.get(src);
    if (cachedSize !== undefined) {
      resolvedViewerImageCacheSizes.delete(src);
      resolvedViewerImageCacheSizes.set(src, cachedSize);
    }
    return cached;
  }

  const resolved = resolveSafeChatImageSource(src, "viewer-image")
    .then((resolvedSrc) => {
      rememberResolvedViewerImageCacheSize(src, resolvedSrc);
      return resolvedSrc;
    })
    .catch((error) => {
      removeResolvedViewerImageCacheEntry(src);
      throw error;
    });
  if (resolvedViewerImageCache.size >= RESOLVED_VIEWER_IMAGE_CACHE_LIMIT) {
    const oldestKey = resolvedViewerImageCache.keys().next().value;
    if (oldestKey) {
      removeResolvedViewerImageCacheEntry(oldestKey);
    }
  }
  resolvedViewerImageCache.set(src, resolved);
  return resolved;
}

export function warmViewerImageSource(src: string | null | undefined): void {
  if (!src || !requiresAttachmentResolution(src) || resolvedViewerImageCache.has(src)) {
    return;
  }

  void resolveViewerImageSource(src).catch(() => undefined);
}
