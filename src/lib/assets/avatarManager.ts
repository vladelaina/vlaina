import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { normalizePublicRemoteMediaUrl } from '@/lib/notes/markdown/urlSecurity';
import { loadImageAsBase64 } from './io/reader';

const SYSTEM_DIR_NAME = '.vlaina';
const SYSTEM_SUBDIR = 'system';
const AVATAR_FETCH_TIMEOUT_MS = 8000;
const AVATAR_RETRY_COOLDOWN_MS = 5 * 60 * 1000;
const MAX_AVATAR_IMAGE_BYTES = 10 * 1024 * 1024;
const AVATAR_MIME_EXTENSIONS: Record<string, string> = {
    'image/avif': 'avif',
    'image/bmp': 'bmp',
    'image/gif': 'gif',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/vnd.microsoft.icon': 'ico',
    'image/webp': 'webp',
    'image/x-icon': 'ico',
};
const AVATAR_EXTENSIONS = Array.from(new Set(['png', ...Object.values(AVATAR_MIME_EXTENSIONS)]));

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

function getAvatarFilename(username: string, extension = 'png'): string {
    const safeUsername = username.replace(/[^a-zA-Z0-9_-]/g, '_');
    return `avatar_${safeUsername}.${extension}`;
}

function normalizeAvatarMimeType(value: string | null | undefined): string | null {
    const mimeType = (value || '').split(';')[0]?.trim().toLowerCase() || '';
    return Object.prototype.hasOwnProperty.call(AVATAR_MIME_EXTENSIONS, mimeType) ? mimeType : null;
}

function assertAvatarImageSize(size: number | null | undefined): void {
    if (typeof size === 'number' && size > MAX_AVATAR_IMAGE_BYTES) {
        throw new Error('Avatar image is too large.');
    }
}

function readContentLength(response: Response): number | null {
    const raw = response.headers?.get?.('content-length');
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
}

export async function downloadAndSaveAvatar(url: string, username: string): Promise<string | null> {
    if (!url || !username) return null;
    const safeUrl = normalizePublicRemoteMediaUrl(url);
    if (!safeUrl) return null;

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        return null;
    }

    const downloadKey = `${username}|${safeUrl}`;
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
            const response = await raceWithAbort(fetch(safeUrl, { signal: controller.signal }), controller.signal);

            if (!response.ok) {
                throw new Error(`Failed to fetch avatar: ${response.statusText}`);
            }
            assertAvatarImageSize(readContentLength(response));

            const blob = await raceWithAbort(response.blob(), controller.signal);
            const mimeType = normalizeAvatarMimeType(blob.type || response.headers?.get?.('content-type'));
            if (!mimeType) {
                throw new Error('Downloaded avatar is not a supported image.');
            }
            assertAvatarImageSize(blob.size);

            const arrayBuffer = await raceWithAbort(blob.arrayBuffer(), controller.signal);
            assertAvatarImageSize(arrayBuffer.byteLength);
            const uint8Array = new Uint8Array(arrayBuffer);

            const storage = getStorageAdapter();
            const basePath = await storage.getBasePath();
            const systemDir = await joinPath(basePath, SYSTEM_DIR_NAME, SYSTEM_SUBDIR);

            if (!await storage.exists(systemDir)) {
                await storage.mkdir(systemDir, true);
            }

            const filename = getAvatarFilename(username, AVATAR_MIME_EXTENSIONS[mimeType]);
            const avatarPath = await joinPath(systemDir, filename);
            await storage.writeBinaryFile(avatarPath, uint8Array, { recursive: true });

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
        const candidates = await Promise.all(AVATAR_EXTENSIONS.map(async (extension) => {
            const filename = getAvatarFilename(username, extension);
            const avatarPath = await joinPath(basePath, SYSTEM_DIR_NAME, SYSTEM_SUBDIR, filename);
            if (!(await storage.exists(avatarPath))) {
                return null;
            }
            const info = await storage.stat(avatarPath).catch(() => null);
            return {
                path: avatarPath,
                modifiedAt: info?.modifiedAt ?? 0,
            };
        }));
        const latest = candidates
            .filter((candidate): candidate is { path: string; modifiedAt: number } => candidate !== null)
            .sort((first, second) => second.modifiedAt - first.modifiedAt)[0];

        if (latest) {
            return await loadImageAsBase64(latest.path);
        }
        return null;
    } catch (error) {
        return null;
    }
}
