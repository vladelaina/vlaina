import { getMimeType, isImageFilename, sanitizeFilename } from '@/lib/assets/core/naming';
import { toBlobPart } from '@/lib/blobPart';
import { getStorageAdapter } from '@/lib/storage/adapter';
import { MAX_FETCHED_IMAGE_BYTES } from '@/lib/markdown/fetchBoundedImageBlob';
import { isSvgImageMimeType, rasterizeSvgBlobToPngBlob } from '@/lib/markdown/svgRasterize';
import { normalizePublicRemoteMediaUrl } from '@/lib/notes/markdown/urlSecurity';
import { getImageSourceBase, isVirtualImageSource, resolveImageSourcePathCandidates } from '../utils/imageSourcePath';

const DOWNLOAD_IMAGE_EXTENSIONS = new Set(['gif', 'jpeg', 'jpg', 'png', 'webp']);

type LocalActionImageBlobResult =
    | { status: 'ok'; blob: Blob }
    | { status: 'too-large' }
    | { status: 'not-local' | 'not-found' };

function getSafeDownloadExtension(src: string) {
    const extension = src.split('#')[0]?.split('?')[0]?.split('.').pop()?.toLowerCase() ?? '';
    return DOWNLOAD_IMAGE_EXTENSIONS.has(extension) ? extension : 'png';
}

export function isLikelySvgImageSource(src: string | null | undefined): boolean {
    const normalized = src?.split('#')[0]?.split('?')[0]?.trim().toLowerCase() ?? '';
    return normalized.endsWith('.svg') || normalized.endsWith('.svgz');
}

export function isBlobByteLengthWithinLimit(size: number, maxBytes: number): boolean {
    return Number.isFinite(size) && size >= 0 && size <= maxBytes;
}

function isTooLargeReadError(error: unknown): boolean {
    return error instanceof Error && /too large/i.test(error.message);
}

export async function normalizeActionImageBlob(blob: Blob): Promise<Blob | null> {
    if (!blob.type.startsWith('image/')) {
        return null;
    }

    const outputBlob = isSvgImageMimeType(blob.type)
        ? await rasterizeSvgBlobToPngBlob(blob)
        : blob;

    if (
        !outputBlob ||
        !outputBlob.type.startsWith('image/') ||
        !isBlobByteLengthWithinLimit(outputBlob.size, MAX_FETCHED_IMAGE_BYTES)
    ) {
        return null;
    }

    return outputBlob;
}

export function createImageDownloadDefaultName(alt: string, src: string) {
    const sanitizedBase = sanitizeFilename(alt.replace(/[\u0000-\u001f\u007f]/g, ''))
        .replace(/^\.+|\.+$/g, '') || 'image';
    return `${sanitizedBase}.${getSafeDownloadExtension(src)}`;
}

export function getImageActionResourceSrc(baseSrc: string, resolvedSrc?: string): string {
    const baseResourceSrc = getImageSourceBase(baseSrc);
    const remoteResourceSrc = normalizePublicRemoteMediaUrl(baseResourceSrc);
    if (remoteResourceSrc) {
        return remoteResourceSrc;
    }
    if (baseResourceSrc && isVirtualImageSource(baseResourceSrc)) {
        return baseResourceSrc;
    }
    return resolvedSrc || '';
}

export async function readLocalActionImageBlob(
    baseSrc: string,
    notesPath: string,
    currentNotePath?: string,
): Promise<LocalActionImageBlobResult> {
    const baseResourceSrc = getImageSourceBase(baseSrc);
    if (!baseResourceSrc || normalizePublicRemoteMediaUrl(baseResourceSrc) || isVirtualImageSource(baseResourceSrc)) {
        return { status: 'not-local' };
    }

    const candidatePaths = await resolveImageSourcePathCandidates({
        rawSrc: baseResourceSrc,
        notesPath,
        currentNotePath,
    });
    if (candidatePaths.length === 0) {
        return { status: 'not-found' };
    }

    const storage = getStorageAdapter();
    let sawTooLargeCandidate = false;

    for (const candidatePath of candidatePaths) {
        if (!isImageFilename(candidatePath)) {
            continue;
        }

        const info = await storage.stat(candidatePath).catch(() => null);
        if (info?.isDirectory || info?.isFile === false) {
            continue;
        }
        if (typeof info?.size === 'number' && !isBlobByteLengthWithinLimit(info.size, MAX_FETCHED_IMAGE_BYTES)) {
            sawTooLargeCandidate = true;
            continue;
        }

        try {
            const bytes = await storage.readBinaryFile(candidatePath, MAX_FETCHED_IMAGE_BYTES);
            if (!isBlobByteLengthWithinLimit(bytes.byteLength, MAX_FETCHED_IMAGE_BYTES)) {
                sawTooLargeCandidate = true;
                continue;
            }

            return {
                status: 'ok',
                blob: new Blob([toBlobPart(bytes)], { type: getMimeType(candidatePath) }),
            };
        } catch (error) {
            if (isTooLargeReadError(error)) {
                sawTooLargeCandidate = true;
            }
        }
    }

    return sawTooLargeCandidate ? { status: 'too-large' } : { status: 'not-found' };
}

export async function readBlobBytes(blob: Blob): Promise<Uint8Array> {
    if (typeof blob.arrayBuffer === 'function') {
        return new Uint8Array(await blob.arrayBuffer());
    }

    return await new Promise<Uint8Array>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result;
            if (result instanceof ArrayBuffer) {
                resolve(new Uint8Array(result));
                return;
            }
            reject(new Error('Unable to read image blob.'));
        };
        reader.onerror = () => reject(reader.error ?? new Error('Unable to read image blob.'));
        reader.onabort = () => reject(new Error('Image blob read was aborted.'));
        reader.readAsArrayBuffer(blob);
    });
}
