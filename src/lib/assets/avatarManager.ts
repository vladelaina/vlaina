import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { loadImageAsBase64 } from './imageLoader';

const SYSTEM_DIR_NAME = '.nekotick';
const SYSTEM_SUBDIR = 'system';

const pendingDownloads = new Map<string, Promise<string | null>>();

function getAvatarFilename(username: string): string {
    const safeUsername = username.replace(/[^a-zA-Z0-9_-]/g, '_');
    return `avatar_${safeUsername}.png`;
}

export async function downloadAndSaveAvatar(url: string, username: string): Promise<string | null> {
    if (!url || !username) return null;

    if (pendingDownloads.has(username)) {
        return pendingDownloads.get(username) || null;
    }

    const downloadPromise = (async () => {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to fetch avatar: ${response.statusText}`);
            }

            const blob = await response.blob();
            const arrayBuffer = await blob.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);

            const storage = getStorageAdapter();
            const basePath = await storage.getBasePath();
            const systemDir = await joinPath(basePath, SYSTEM_DIR_NAME, SYSTEM_SUBDIR);

            if (!await storage.exists(systemDir)) {
                await storage.mkdir(systemDir, true);
            }

            const filename = getAvatarFilename(username);
            const avatarPath = await joinPath(systemDir, filename);
            await storage.writeBinaryFile(avatarPath, uint8Array);


            return avatarPath;
        } catch (error) {
            console.error('[AvatarManager] Failed to save avatar locally:', error);
            return null;
        } finally {
            pendingDownloads.delete(username);
        }
    })();

    pendingDownloads.set(username, downloadPromise);
    return downloadPromise;
}

export async function getLocalAvatarUrl(username: string): Promise<string | null> {
    if (!username) return null;
    try {
        const storage = getStorageAdapter();
        const basePath = await storage.getBasePath();
        const filename = getAvatarFilename(username);
        const avatarPath = await joinPath(basePath, SYSTEM_DIR_NAME, SYSTEM_SUBDIR, filename);

        if (await storage.exists(avatarPath)) {
            return await loadImageAsBase64(avatarPath);
        }
        return null;
    } catch (error) {
        return null;
    }
}
