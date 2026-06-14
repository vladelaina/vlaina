import { createAsyncPrefetchQueue } from '@/lib/asyncPrefetchQueue';
import { createSafeImageFetchInit, readBoundedImageBlobResponse } from '@/lib/markdown/fetchBoundedImageBlob';
import { normalizePublicRemoteMediaUrl } from '@/lib/notes/markdown/urlSecurity';

interface RemoteImageCacheEntry {
    src?: string;
    objectUrl?: string;
    sizeBytes?: number;
    promise?: Promise<string>;
    lastUsed: number;
}

interface RemoteImageResolveResult {
    src: string;
    sizeBytes?: number;
}

export const MAX_REMOTE_IMAGE_CACHE_ENTRIES = 200;
const MAX_REMOTE_IMAGE_CACHE_BYTES = 48 * 1024 * 1024;
export const MAX_SINGLE_REMOTE_IMAGE_CACHE_BYTES = 8 * 1024 * 1024;
export const REMOTE_IMAGE_FETCH_TIMEOUT_MS = 15_000;
const MAX_REMOTE_IMAGE_FETCH_CONCURRENCY = 4;
const remoteImageCache = new Map<string, RemoteImageCacheEntry>();
const remoteImageFetchQueue = createAsyncPrefetchQueue(MAX_REMOTE_IMAGE_FETCH_CONCURRENCY);
let remoteImageCacheBytes = 0;
let remoteImageCacheGeneration = 0;

function revokeObjectUrl(objectUrl: string | undefined): void {
    if (!objectUrl || typeof URL === 'undefined' || typeof URL.revokeObjectURL !== 'function') {
        return;
    }

    URL.revokeObjectURL(objectUrl);
}

function getKnownRemoteImageCacheSize(size: number | null | undefined): number | undefined {
    return typeof size === 'number' && Number.isFinite(size) && size >= 0
        ? size
        : undefined;
}

function isRemoteImageBlobSizeWithinLimit(size: number): boolean {
    const knownSize = getKnownRemoteImageCacheSize(size);
    return knownSize !== undefined && knownSize <= MAX_SINGLE_REMOTE_IMAGE_CACHE_BYTES;
}

function getRemoteImageCacheEntrySizeBytes(entry: RemoteImageCacheEntry | undefined): number {
    return getKnownRemoteImageCacheSize(entry?.sizeBytes) ?? 0;
}

function evictRemoteImageCacheIfNeeded(): void {
    while (
        remoteImageCache.size > MAX_REMOTE_IMAGE_CACHE_ENTRIES
        || remoteImageCacheBytes > MAX_REMOTE_IMAGE_CACHE_BYTES
    ) {
        if (!evictOldestResolvedRemoteImageCacheEntry()) break;
    }
}

function evictOldestResolvedRemoteImageCacheEntry(): boolean {
    const evictableEntry = Array.from(remoteImageCache.entries())
        .filter(([, entry]) => !entry.promise)
        .sort(([, a], [, b]) => a.lastUsed - b.lastUsed)[0];
    if (!evictableEntry) {
        return false;
    }

    const [url, entry] = evictableEntry;
    revokeObjectUrl(entry.objectUrl);
    remoteImageCacheBytes -= getRemoteImageCacheEntrySizeBytes(entry);
    remoteImageCache.delete(url);
    return true;
}

function reserveRemoteImageCacheEntry(): boolean {
    while (remoteImageCache.size >= MAX_REMOTE_IMAGE_CACHE_ENTRIES) {
        if (!evictOldestResolvedRemoteImageCacheEntry()) return false;
    }
    return true;
}

function setRemoteImageCacheEntry(url: string, entry: RemoteImageCacheEntry): void {
    const existing = remoteImageCache.get(url);
    if (existing?.objectUrl && existing.objectUrl !== entry.objectUrl) {
        revokeObjectUrl(existing.objectUrl);
    }
    remoteImageCacheBytes -= getRemoteImageCacheEntrySizeBytes(existing);
    remoteImageCacheBytes += getRemoteImageCacheEntrySizeBytes(entry);
    remoteImageCache.set(url, entry);
    evictRemoteImageCacheIfNeeded();
}

function createRemoteImageFetchTimeout(): { signal?: AbortSignal; clear: () => void } {
    if (typeof AbortController === 'undefined') {
        return { clear: () => undefined };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
        controller.abort();
    }, REMOTE_IMAGE_FETCH_TIMEOUT_MS);

    return {
        signal: controller.signal,
        clear: () => clearTimeout(timeoutId),
    };
}

async function fetchRemoteImageForCache(safeUrl: string): Promise<RemoteImageResolveResult> {
    const timeout = createRemoteImageFetchTimeout();
    try {
        const response = await fetch(safeUrl, createSafeImageFetchInit({ cache: 'force-cache' }, timeout.signal));
        if (!response.ok) {
            return { src: safeUrl };
        }

        const result = await readBoundedImageBlobResponse(response, {
            maxBytes: MAX_SINGLE_REMOTE_IMAGE_CACHE_BYTES,
            signal: timeout.signal,
        });
        if (result.status === 'too-large') {
            return { src: safeUrl };
        }

        const blob = result.blob;
        if (!blob.type.startsWith('image/')) {
            return { src: safeUrl };
        }
        if (!isRemoteImageBlobSizeWithinLimit(blob.size)) {
            return { src: safeUrl };
        }

        return {
            src: URL.createObjectURL(blob),
            sizeBytes: blob.size,
        };
    } finally {
        timeout.clear();
    }
}

export async function resolveRemoteImageFromMemoryCache(url: string): Promise<string> {
    const safeUrl = normalizePublicRemoteMediaUrl(url);
    if (!safeUrl) {
        return '';
    }

    const now = Date.now();
    const cacheGeneration = remoteImageCacheGeneration;
    const existing = remoteImageCache.get(safeUrl);
    if (existing?.src) {
        existing.lastUsed = now;
        return existing.src;
    }
    if (existing?.promise) {
        existing.lastUsed = now;
        return existing.promise;
    }

    if (
        typeof fetch !== 'function'
        || typeof URL === 'undefined'
        || typeof URL.createObjectURL !== 'function'
    ) {
        setRemoteImageCacheEntry(safeUrl, { src: safeUrl, lastUsed: now });
        return safeUrl;
    }

    if (!reserveRemoteImageCacheEntry()) {
        return safeUrl;
    }

    const promise = remoteImageFetchQueue.run(() => fetchRemoteImageForCache(safeUrl))
        .catch((): RemoteImageResolveResult => ({ src: safeUrl }))
        .then((result) => {
            const { src, sizeBytes } = result;
            const objectUrl = src.startsWith('blob:') ? src : undefined;
            if (cacheGeneration !== remoteImageCacheGeneration) {
                revokeObjectUrl(objectUrl);
                return safeUrl;
            }
            setRemoteImageCacheEntry(safeUrl, {
                src,
                objectUrl,
                sizeBytes: objectUrl ? sizeBytes : undefined,
                lastUsed: Date.now(),
            });
            return src;
        });

    remoteImageCache.set(safeUrl, { promise, lastUsed: now });
    return promise;
}

export function getCachedRemoteImageSrc(url: string): string | undefined {
    const safeUrl = normalizePublicRemoteMediaUrl(url);
    if (!safeUrl) {
        return undefined;
    }

    const existing = remoteImageCache.get(safeUrl);
    if (!existing?.src) {
        return undefined;
    }

    existing.lastUsed = Date.now();
    return existing.src;
}

export function clearRemoteImageMemoryCache(): void {
    remoteImageCacheGeneration += 1;
    for (const entry of remoteImageCache.values()) {
        revokeObjectUrl(entry.objectUrl);
    }
    remoteImageCache.clear();
    remoteImageCacheBytes = 0;
}

export function clearRemoteImageMemoryCacheForTests(): void {
    clearRemoteImageMemoryCache();
}
