import { moveDesktopItemToTrash } from '@/lib/desktop/trash';
import { isImageFilename } from '@/lib/assets/core/naming';
import { getStorageAdapter } from '@/lib/storage/adapter';
import { getImageSourceBase, isVirtualImageSource, resolveImageSourcePathCandidates } from './imageSourcePath';
import { createSafeImageFetchInit, readBoundedImageBlobResponse } from '@/lib/markdown/fetchBoundedImageBlob';
import { sanitizeSvgBytes } from '@/lib/markdown/svgSanitizer';
import { sanitizeNoteMediaSrc } from '@/lib/notes/markdown/urlSecurity';

const pendingDeletions = new Map<string, ReturnType<typeof setTimeout>>();
const UNDO_GRACE_PERIOD_MS = 10000;
export const MAX_PENDING_IMAGE_DELETIONS = 100;
export const MAX_RESTORED_IMAGE_BYTES = 50 * 1024 * 1024;

function normalizeBlobMimeType(value: string): string {
    return value.split(';')[0]?.trim().toLowerCase() ?? '';
}

function prepareRestoredImageBytes(bytes: Uint8Array, mimeType: string): Uint8Array {
    return mimeType === 'image/svg+xml' ? sanitizeSvgBytes(bytes) : bytes;
}

function isBlobByteLengthWithinLimit(size: number, maxBytes: number): boolean {
    return Number.isFinite(size) && size >= 0 && size <= maxBytes;
}

function getSafeLocalImageSource(src: string): string | null {
    const baseSrc = getImageSourceBase(src);
    const safeSrc = sanitizeNoteMediaSrc(baseSrc);
    if (!safeSrc || isVirtualImageSource(safeSrc)) {
        return null;
    }
    return safeSrc;
}

export async function ensureImageFileExists(
    src: string,
    blobUrl: string,
    notesPath: string,
    currentNotePath?: string
): Promise<void> {
    if (!src || !blobUrl || !blobUrl.startsWith('blob:')) return;
    const safeSrc = getSafeLocalImageSource(src);
    if (!safeSrc) return;

    try {
        const fullPath = await resolveImagePath(safeSrc, notesPath, currentNotePath);
        if (!fullPath) return;
        if (!isImageFilename(fullPath)) return;

        if (pendingDeletions.has(fullPath)) {
            clearTimeout(pendingDeletions.get(fullPath)!);
            pendingDeletions.delete(fullPath);
        }

        const storage = getStorageAdapter();

        if (await storage.exists(fullPath)) {
            return;
        }

        const response = await fetch(blobUrl, createSafeImageFetchInit());
        const result = await readBoundedImageBlobResponse(response, {
            maxBytes: MAX_RESTORED_IMAGE_BYTES,
        });
        if (result.status === 'too-large') return;

        const blob = result.blob;
        const mimeType = normalizeBlobMimeType(blob.type);
        if (!mimeType.startsWith('image/')) return;
        if (!isBlobByteLengthWithinLimit(blob.size, MAX_RESTORED_IMAGE_BYTES)) return;

        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = prepareRestoredImageBytes(new Uint8Array(arrayBuffer), mimeType);
        if (uint8Array.byteLength > MAX_RESTORED_IMAGE_BYTES) return;

        await storage.writeBinaryFile(fullPath, uint8Array, { recursive: true });

    } catch (err) {
    }
}

export async function moveImageToTrash(
    src: string,
    notesPath: string,
    currentNotePath?: string
): Promise<boolean> {
    if (!src) return false;
    const safeSrc = getSafeLocalImageSource(src);
    if (!safeSrc) return false;

    try {
        const fullPath = await resolveImagePath(safeSrc, notesPath, currentNotePath);
        if (!fullPath) return false;
        if (!isImageFilename(fullPath)) return false;

        const existingDeletion = pendingDeletions.get(fullPath);
        if (existingDeletion) {
            clearTimeout(existingDeletion);
        } else if (pendingDeletions.size >= MAX_PENDING_IMAGE_DELETIONS) {
            return false;
        }

        const timerId = setTimeout(async () => {
            try {
                await moveDesktopItemToTrash(fullPath);
            } catch (err) {
            } finally {
                pendingDeletions.delete(fullPath);
            }
        }, UNDO_GRACE_PERIOD_MS);

        pendingDeletions.set(fullPath, timerId);
        return true;

    } catch (err) {
    }

    return false;
}

export async function restoreImageFromTrash(
    src: string,
    notesPath: string,
    currentNotePath?: string
): Promise<void> {
    if (!src) return;
    const safeSrc = getSafeLocalImageSource(src);
    if (!safeSrc) return;

    try {
        const fullPath = await resolveImagePath(safeSrc, notesPath, currentNotePath);
        if (fullPath && !isImageFilename(fullPath)) return;
        if (fullPath && pendingDeletions.has(fullPath)) {
            clearTimeout(pendingDeletions.get(fullPath)!);
            pendingDeletions.delete(fullPath);
        }
    } catch (err) {
    }
}

export function cancelAllPendingImageDeletions(): void {
    for (const [path, timerId] of pendingDeletions) {
        clearTimeout(timerId);
        pendingDeletions.delete(path);
    }
}

async function resolveImagePath(src: string, notesPath: string, currentNotePath?: string): Promise<string> {
    const candidates = await resolveImageSourcePathCandidates({
        rawSrc: src,
        notesPath,
        currentNotePath,
    });

    if (candidates.length <= 1) {
        const candidate = candidates[0] ?? '';
        return candidate && isImageFilename(candidate) ? candidate : '';
    }

    const storage = getStorageAdapter();
    const imageCandidates = candidates.filter(isImageFilename);
    for (const candidate of imageCandidates) {
        if (await storage.exists(candidate).catch(() => false)) {
            return candidate;
        }
    }

    return imageCandidates[0] ?? '';
}
