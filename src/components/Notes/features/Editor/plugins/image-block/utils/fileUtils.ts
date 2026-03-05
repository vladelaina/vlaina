import { invoke } from '@tauri-apps/api/core';
import { joinPath, getStorageAdapter } from '@/lib/storage/adapter';

const pendingDeletions = new Map<string, ReturnType<typeof setTimeout>>();
const UNDO_GRACE_PERIOD_MS = 10000;

function isAbsolutePath(path: string): boolean {
    if (!path) return false;
    if (path.startsWith('/')) return true;
    return /^[a-zA-Z]:[\\/]/.test(path);
}

export async function ensureImageFileExists(
    src: string,
    blobUrl: string,
    notesPath: string,
    currentNotePath?: string
): Promise<void> {
    if (!src || !blobUrl || !blobUrl.startsWith('blob:')) return;
    if (src.startsWith('http') || src.startsWith('data:')) return;

    try {
        const fullPath = await resolveImagePath(src, notesPath, currentNotePath);
        if (!fullPath) return;

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
        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        await storage.writeBinaryFile(fullPath, uint8Array);

    } catch (err) {
        console.error('[ImageBlock] Failed to restore image file:', err);
    }
}

export async function moveImageToTrash(
    src: string,
    notesPath: string,
    currentNotePath?: string
): Promise<boolean> {
    if (!src) return false;
    if (src.startsWith('http') || src.startsWith('data:') || src.startsWith('blob:')) {
        return false;
    }

    try {
        const fullPath = await resolveImagePath(src, notesPath, currentNotePath);
        if (!fullPath) return false;

        if (pendingDeletions.has(fullPath)) {
            clearTimeout(pendingDeletions.get(fullPath)!);
        }

        const timerId = setTimeout(async () => {
            try {
                await invoke('move_to_trash', { path: fullPath });
            } catch (err) {
                console.error('[ImageTrash] Failed to move to trash:', err);
            } finally {
                pendingDeletions.delete(fullPath);
            }
        }, UNDO_GRACE_PERIOD_MS);

        pendingDeletions.set(fullPath, timerId);
        return true;

    } catch (err) {
        console.error('Failed to schedule image deletion:', err);
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
        if (fullPath && pendingDeletions.has(fullPath)) {
            clearTimeout(pendingDeletions.get(fullPath)!);
            pendingDeletions.delete(fullPath);
        }
    } catch (err) {
        console.error('Failed to cancel deletion:', err);
    }
}

async function resolveImagePath(src: string, notesPath: string, currentNotePath?: string): Promise<string> {
    const baseSrc = src.split('#')[0];
    if (isAbsolutePath(baseSrc)) {
        return baseSrc;
    }

    if (baseSrc.startsWith('./') || baseSrc.startsWith('../')) {
        if (currentNotePath) {
            const normalizedPath = currentNotePath.replace(/\\/g, '/');
            const pathParts = normalizedPath.split('/');
            pathParts.pop();
            const parentDir = pathParts.join('/');
            return await joinPath(notesPath, parentDir, baseSrc);
        }
    }
    return await joinPath(notesPath, baseSrc);
}
