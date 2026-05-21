import { moveDesktopItemToTrash } from '@/lib/desktop/trash';
import { isImageFilename } from '@/lib/assets/core/naming';
import { getStorageAdapter } from '@/lib/storage/adapter';
import { getImageSourceBase, isVirtualImageSource, resolveImageSourcePathCandidates } from './imageSourcePath';

const pendingDeletions = new Map<string, ReturnType<typeof setTimeout>>();
const UNDO_GRACE_PERIOD_MS = 10000;
const MAX_RESTORED_IMAGE_BYTES = 50 * 1024 * 1024;

export async function ensureImageFileExists(
    src: string,
    blobUrl: string,
    notesPath: string,
    currentNotePath?: string
): Promise<void> {
    if (!src || !blobUrl || !blobUrl.startsWith('blob:')) return;
    if (isVirtualImageSource(getImageSourceBase(src))) return;

    try {
        const fullPath = await resolveImagePath(src, notesPath, currentNotePath);
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

        const response = await fetch(blobUrl);
        const blob = await response.blob();
        if (blob.size > MAX_RESTORED_IMAGE_BYTES) return;

        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        if (uint8Array.byteLength > MAX_RESTORED_IMAGE_BYTES) return;

        await storage.writeBinaryFile(fullPath, uint8Array);

    } catch (err) {
    }
}

export async function moveImageToTrash(
    src: string,
    notesPath: string,
    currentNotePath?: string
): Promise<boolean> {
    if (!src) return false;
    if (isVirtualImageSource(getImageSourceBase(src))) {
        return false;
    }

    try {
        const fullPath = await resolveImagePath(src, notesPath, currentNotePath);
        if (!fullPath) return false;
        if (!isImageFilename(fullPath)) return false;

        if (pendingDeletions.has(fullPath)) {
            clearTimeout(pendingDeletions.get(fullPath)!);
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

    try {
        const fullPath = await resolveImagePath(src, notesPath, currentNotePath);
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
