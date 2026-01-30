import { invoke } from '@tauri-apps/api/core';
import { joinPath, getStorageAdapter } from '@/lib/storage/adapter';

// In-memory map to track pending deletions
// Key: Absolute File Path, Value: Timeout ID
const pendingDeletions = new Map<string, ReturnType<typeof setTimeout>>();

const UNDO_GRACE_PERIOD_MS = 10000; // 10 seconds grace period

/**
 * Ensures that the image file exists on disk.
 * If the file is missing (e.g. externally deleted) but we still have the blob in memory,
 * this function will write the blob back to disk, restoring the file.
 */
export async function ensureImageFileExists(
    src: string,
    blobUrl: string,
    notesPath: string,
    currentNotePath?: string
): Promise<void> {
    if (!src || !blobUrl || !blobUrl.startsWith('blob:')) return;
    
    // Skip remote/data URLs
    if (src.startsWith('http') || src.startsWith('data:')) return;

    try {
        const fullPath = await resolveImagePath(src, notesPath, currentNotePath);
        if (!fullPath) return;

        // CRITICAL: Cancel any pending deletion for this file
        if (pendingDeletions.has(fullPath)) {
            clearTimeout(pendingDeletions.get(fullPath)!);
            pendingDeletions.delete(fullPath);
        }

        const storage = getStorageAdapter();
        
        // 1. Check if file exists
        if (await storage.exists(fullPath)) {
            return; // File is safe, nothing to do
        }

        // 2. Fetch blob data
        const response = await fetch(blobUrl);
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        // 3. Write back to disk
        await storage.writeBinaryFile(fullPath, uint8Array);
        
    } catch (err) {
        console.error('[ImageBlock] Failed to restore image file:', err);
    }
}

/**
 * Marks a local image file for deletion with a grace period.
 * If user undoes the action within the grace period, deletion is cancelled.
 */
export async function moveImageToTrash(
    src: string, 
    notesPath: string, 
    currentNotePath?: string
): Promise<boolean> {
    if (!src) return false;

    // Skip remote/data URLs
    if (src.startsWith('http') || src.startsWith('data:') || src.startsWith('blob:')) {
        return false;
    }

    try {
        const fullPath = await resolveImagePath(src, notesPath, currentNotePath);
        if (!fullPath) return false;

        // If already pending, clear old timer (reset clock)
        if (pendingDeletions.has(fullPath)) {
            clearTimeout(pendingDeletions.get(fullPath)!);
        }

        // Set new timer
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

/**
 * Restores an image by cancelling its pending deletion.
 * Used when an image is re-inserted (e.g. via Undo).
 */
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

// Helper to resolve paths
async function resolveImagePath(src: string, notesPath: string, currentNotePath?: string): Promise<string> {
    const baseSrc = src.split('#')[0];
    
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