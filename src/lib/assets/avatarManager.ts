import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { loadImageAsBase64 } from './io/reader';

const SYSTEM_DIR_NAME = '.vlaina';
const SYSTEM_SUBDIR = 'system';
const AVATAR_FETCH_TIMEOUT_MS = 8000;
const AVATAR_RETRY_COOLDOWN_MS = 5 * 60 * 1000;

const pendingDownloads = new Map<string, Promise<string | null>>();
const failedDownloads = new Map<string, number>();

function createAbortError(): DOMException {
    return new DOMException('Aborted', 'AbortError');
}

function throwIfAborted(signal: AbortSignal): void {
    if (!signal.aborted) return;
    throw createAbortError();
}

async function raceWithAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
    throwIfAborted(signal);
    promise.catch(() => undefined);

    return await new Promise<T>((resolve, reject) => {
        let settled = false;
        const cleanup = () => {
            signal.removeEventListener('abort', abort);
        };
        const settle = (callback: () => void) => {
            if (settled) return;
            settled = true;
            cleanup();
            callback();
        };
        const abort = () => {
            settle(() => reject(createAbortError()));
        };

        signal.addEventListener('abort', abort, { once: true });
        if (signal.aborted) {
            abort();
            return;
        }

        promise.then(
            (value) => {
                settle(() => {
                    try {
                        throwIfAborted(signal);
                        resolve(value);
                    } catch (error) {
                        reject(error);
                    }
                });
            },
            (error) => {
                settle(() => {
                    try {
                        throwIfAborted(signal);
                        reject(error);
                    } catch (abortError) {
                        reject(abortError);
                    }
                });
            }
        );
    });
}

function getAvatarFilename(username: string): string {
    const safeUsername = username.replace(/[^a-zA-Z0-9_-]/g, '_');
    return `avatar_${safeUsername}.png`;
}

export async function downloadAndSaveAvatar(url: string, username: string): Promise<string | null> {
    if (!url || !username) return null;

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        return null;
    }

    const downloadKey = `${username}|${url}`;
    const lastFailedAt = failedDownloads.get(downloadKey);
    if (lastFailedAt && Date.now() - lastFailedAt < AVATAR_RETRY_COOLDOWN_MS) {
        return null;
    }

    if (pendingDownloads.has(username)) {
        return pendingDownloads.get(username) || null;
    }

    const downloadPromise = (async () => {
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        try {
            const controller = new AbortController();
            timeoutId = setTimeout(() => controller.abort(), AVATAR_FETCH_TIMEOUT_MS);
            const response = await raceWithAbort(fetch(url, { signal: controller.signal }), controller.signal);

            if (!response.ok) {
                throw new Error(`Failed to fetch avatar: ${response.statusText}`);
            }

            const blob = await raceWithAbort(response.blob(), controller.signal);
            const arrayBuffer = await raceWithAbort(blob.arrayBuffer(), controller.signal);
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

            failedDownloads.delete(downloadKey);

            return avatarPath;
        } catch (error) {
            failedDownloads.set(downloadKey, Date.now());
            return null;
        } finally {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
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
