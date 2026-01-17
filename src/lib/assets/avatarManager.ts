import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { loadImageAsBlob, revokeImageBlob, invalidateImageCache } from './imageLoader';

const SYSTEM_DIR_NAME = '.nekotick';
const SYSTEM_SUBDIR = 'system';

// Request deduplication map
const pendingDownloads = new Map<string, Promise<string | null>>();

function getAvatarFilename(username: string): string {
    // Sanitize username to be safe for filenames
    const safeUsername = username.replace(/[^a-zA-Z0-9_-]/g, '_');
    return `avatar_${safeUsername}.png`;
}

/**
 * Download avatar from URL and save to local system directory
 * @param url Remote avatar URL
 * @param username GitHub username (used for filename)
 * @returns Local file path if successful, null otherwise
 */
export async function downloadAndSaveAvatar(url: string, username: string): Promise<string | null> {
    if (!url || !username) return null;

    // Check if download is already in progress
    if (pendingDownloads.has(username)) {
        return pendingDownloads.get(username) || null;
    }

    const downloadPromise = (async () => {
        try {
            // 1. Fetch image
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to fetch avatar: ${response.statusText}`);
            }

            // 2. Convert to binary
            const blob = await response.blob();
            const arrayBuffer = await blob.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);

            // 3. Prepare storage
            const storage = getStorageAdapter();
            const basePath = await storage.getBasePath();
            const systemDir = await joinPath(basePath, SYSTEM_DIR_NAME, SYSTEM_SUBDIR);

            // Ensure directory exists
            if (!await storage.exists(systemDir)) {
                await storage.mkdir(systemDir, true);
            }

            // 4. Save file
            const filename = getAvatarFilename(username);
            const avatarPath = await joinPath(systemDir, filename);
            await storage.writeBinaryFile(avatarPath, uint8Array);

            // 5. Invalidate cache to ensure UI gets the new image
            // DO NOT revoke immediately, as the UI might still be displaying the old blob
            invalidateImageCache(avatarPath);

            console.log('[AvatarManager] Avatar saved locally to:', avatarPath);
            return avatarPath;
        } catch (error) {
            console.error('[AvatarManager] Failed to save avatar locally:', error);
            return null;
        } finally {
            // Remove promise from pending map regardless of result
            pendingDownloads.delete(username);
        }
    })();

    pendingDownloads.set(username, downloadPromise);
    return downloadPromise;
}

/**
 * Get the local asset URL for the saved avatar
 * @param username GitHub username
 * @returns Blob URL (blob:...) or null if not found
 */
export async function getLocalAvatarUrl(username: string): Promise<string | null> {
    if (!username) return null;
    try {
        const storage = getStorageAdapter();
        const basePath = await storage.getBasePath();
        const filename = getAvatarFilename(username);
        const avatarPath = await joinPath(basePath, SYSTEM_DIR_NAME, SYSTEM_SUBDIR, filename);

        if (await storage.exists(avatarPath)) {
            // Use imageLoader to get a fresh blob URL
            return await loadImageAsBlob(avatarPath);
        }
        return null;
    } catch (error) {
        // Silent fail is okay, UI will fallback to remote URL
        return null;
    }
}
