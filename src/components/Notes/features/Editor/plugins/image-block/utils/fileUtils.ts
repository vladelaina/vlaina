import { getMimeType, isImageFilename } from '@/lib/assets/core/naming';
import { getStorageAdapter } from '@/lib/storage/adapter';
import { getImageSourceBase, isVirtualImageSource, resolveImageSourcePathCandidates } from './imageSourcePath';
import { createSafeImageFetchInit, readBoundedImageBlobResponse } from '@/lib/markdown/fetchBoundedImageBlob';
import { sanitizeSvgBytes } from '@/lib/markdown/svgSanitizer';
import { sanitizeNoteMediaSrc } from '@/lib/notes/markdown/urlSecurity';

export const MAX_RESTORED_IMAGE_BYTES = 50 * 1024 * 1024;

function normalizeBlobMimeType(value: string): string {
    return value.split(';')[0]?.trim().toLowerCase() ?? '';
}

function getRestoredImageMimeType(blobType: string, fullPath: string): string {
    const mimeType = normalizeBlobMimeType(blobType);
    if (mimeType.startsWith('image/')) return mimeType;
    if (mimeType && mimeType !== 'application/octet-stream') return '';

    const inferredMimeType = getMimeType(fullPath);
    return inferredMimeType.startsWith('image/') ? inferredMimeType : '';
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
        const mimeType = getRestoredImageMimeType(blob.type, fullPath);
        if (!mimeType) return;
        if (!isBlobByteLengthWithinLimit(blob.size, MAX_RESTORED_IMAGE_BYTES)) return;

        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = prepareRestoredImageBytes(new Uint8Array(arrayBuffer), mimeType);
        if (uint8Array.byteLength > MAX_RESTORED_IMAGE_BYTES) return;

        await storage.writeBinaryFile(fullPath, uint8Array, { recursive: true });

    } catch (err) {
    }
}

export async function moveImageToTrash(
    _src: string,
    _notesPath: string,
    _currentNotePath?: string
): Promise<boolean> {
    // Removing an image from a note only removes the markdown reference.
    // User image files are left untouched on disk.
    return false;
}

export async function restoreImageFromTrash(
    _src: string,
    _notesPath: string,
    _currentNotePath?: string
): Promise<void> {
    // Kept as a no-op for older image lifecycle call sites.
}

export function cancelAllPendingImageDeletions(): void {
    // No pending image deletions are tracked.
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
