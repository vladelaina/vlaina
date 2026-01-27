import { invoke } from '@tauri-apps/api/core';
import { joinPath } from '@/lib/storage/adapter';

// In-memory map to track pending deletions
// Key: Image Source Path, Value: Timeout ID
const pendingDeletions = new Map<string, ReturnType<typeof setTimeout>>();

const UNDO_GRACE_PERIOD_MS = 10000; // 10 seconds grace period

/**
 * Marks a local image file for deletion with a grace period.
 * If user undoes the action within the grace period, deletion is cancelled.
 * 
 * @param src - The source URL from the image node
 * @param notesPath - The absolute path to the vault root
 * @param currentNotePath - The relative path of the current note
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
        if (pendingDeletions.has(src)) {
            clearTimeout(pendingDeletions.get(src)!);
        }

        // Set new timer
        const timerId = setTimeout(async () => {
            try {
                await invoke('move_to_trash', { path: fullPath });
            } catch (err) {
                console.error('[ImageTrash] Failed to move to trash:', err);
            } finally {
                pendingDeletions.delete(src);
            }
        }, UNDO_GRACE_PERIOD_MS);

        pendingDeletions.set(src, timerId);
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
    _notesPath: string,
    _currentNotePath?: string
): Promise<void> {
    if (!src) return;

    if (pendingDeletions.has(src)) {
        clearTimeout(pendingDeletions.get(src)!);
        pendingDeletions.delete(src);
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