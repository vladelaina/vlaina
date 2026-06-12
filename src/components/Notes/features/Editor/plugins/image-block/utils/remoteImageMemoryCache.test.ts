import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    clearRemoteImageMemoryCache,
    clearRemoteImageMemoryCacheForTests,
    MAX_REMOTE_IMAGE_CACHE_ENTRIES,
    MAX_SINGLE_REMOTE_IMAGE_CACHE_BYTES,
    REMOTE_IMAGE_FETCH_TIMEOUT_MS,
    resolveRemoteImageFromMemoryCache,
} from './remoteImageMemoryCache';

describe('remoteImageMemoryCache', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearRemoteImageMemoryCacheForTests();
        Object.defineProperty(URL, 'createObjectURL', {
            configurable: true,
            value: vi.fn(() => 'blob:remote-image'),
        });
        Object.defineProperty(URL, 'revokeObjectURL', {
            configurable: true,
            value: vi.fn(),
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('limits concurrent remote image fetches', async () => {
        let activeFetches = 0;
        let maxActiveFetches = 0;

        vi.stubGlobal('fetch', vi.fn(async () => {
            activeFetches += 1;
            maxActiveFetches = Math.max(maxActiveFetches, activeFetches);
            await new Promise((resolve) => setTimeout(resolve, 10));
            activeFetches -= 1;
            return {
                ok: true,
                headers: new Headers({ 'content-length': '12' }),
                blob: async () => new Blob(['remote image'], { type: 'image/png' }),
            };
        }));

        const resolutions = Array.from({ length: 8 }, (_, index) =>
            resolveRemoteImageFromMemoryCache(`https://example.com/${index}.png`)
        );

        await vi.waitFor(() => {
            expect(fetch).toHaveBeenCalledTimes(4);
        });
        expect(maxActiveFetches).toBe(4);

        await Promise.all(resolutions);
        expect(fetch).toHaveBeenCalledTimes(8);
        expect(maxActiveFetches).toBe(4);
    });

    it('does not enqueue remote image fetches after pending cache entries fill the budget', async () => {
        let releaseFetch!: () => void;
        const fetchGate = new Promise<void>((resolve) => {
            releaseFetch = resolve;
        });
        vi.stubGlobal('fetch', vi.fn(async () => {
            await fetchGate;
            return {
                ok: true,
                headers: new Headers({ 'content-length': '12' }),
                blob: async () => new Blob(['remote image'], { type: 'image/png' }),
            };
        }));

        const pendingResolutions = Array.from({ length: MAX_REMOTE_IMAGE_CACHE_ENTRIES }, (_value, index) =>
            resolveRemoteImageFromMemoryCache(`https://example.com/pending-${index}.png`)
        );
        const overflowUrl = `https://example.com/pending-${MAX_REMOTE_IMAGE_CACHE_ENTRIES}.png`;

        await expect(resolveRemoteImageFromMemoryCache(overflowUrl)).resolves.toBe(overflowUrl);
        expect(fetch).toHaveBeenCalledTimes(4);

        releaseFetch();
        await Promise.all(pendingResolutions);

        expect(fetch).toHaveBeenCalledTimes(MAX_REMOTE_IMAGE_CACHE_ENTRIES);
    });

    it('does not fetch local-network URLs when called directly', async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        await expect(resolveRemoteImageFromMemoryCache('http://127.0.0.1:3000/secret.png')).resolves.toBe('');
        await expect(resolveRemoteImageFromMemoryCache('http://localhost/secret.png')).resolves.toBe('');

        expect(fetchMock).not.toHaveBeenCalled();
        expect(URL.createObjectURL).not.toHaveBeenCalled();
    });

    it('normalizes protocol-relative public URLs before fetching and caching', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => ({
            ok: true,
            headers: new Headers({ 'content-length': '12' }),
            blob: async () => new Blob(['remote image'], { type: 'image/png' }),
        })));

        await expect(resolveRemoteImageFromMemoryCache('//example.com/remote.png')).resolves.toBe('blob:remote-image');
        await expect(resolveRemoteImageFromMemoryCache('https://example.com/remote.png')).resolves.toBe('blob:remote-image');

        expect(fetch).toHaveBeenCalledTimes(1);
        expect(fetch).toHaveBeenCalledWith('https://example.com/remote.png', {
            cache: 'force-cache',
            credentials: 'omit',
            referrerPolicy: 'no-referrer',
            signal: expect.any(AbortSignal),
        });
    });

    it('stops reading streamed remote images once they exceed the cache limit', async () => {
        const cancel = vi.fn(async () => undefined);
        const reader = {
            read: vi.fn()
                .mockResolvedValueOnce({ done: false, value: new Uint8Array(MAX_SINGLE_REMOTE_IMAGE_CACHE_BYTES) })
                .mockResolvedValueOnce({ done: false, value: new Uint8Array(1) }),
            cancel,
            releaseLock: vi.fn(),
        };
        vi.stubGlobal('fetch', vi.fn(async () => ({
            ok: true,
            headers: new Headers({ 'content-type': 'image/png' }),
            body: {
                getReader: () => reader,
            },
        })));

        await expect(resolveRemoteImageFromMemoryCache('https://example.com/large.png')).resolves.toBe('https://example.com/large.png');

        expect(cancel).toHaveBeenCalledTimes(1);
        expect(reader.releaseLock).toHaveBeenCalledTimes(1);
        expect(URL.createObjectURL).not.toHaveBeenCalled();
    });

    it('does not cache remote image blobs with invalid size metadata', async () => {
        const url = 'https://example.com/invalid-size.png';
        vi.stubGlobal('fetch', vi.fn(async () => ({
            ok: true,
            headers: new Headers({
                'content-length': '2',
                'content-type': 'image/png',
            }),
            blob: async () => ({
                type: 'image/png',
                size: -1,
            }),
        })));

        await expect(resolveRemoteImageFromMemoryCache(url)).resolves.toBe(url);

        expect(URL.createObjectURL).not.toHaveBeenCalled();
    });

    it('falls back to the safe remote URL when remote image fetches time out', async () => {
        vi.useFakeTimers();
        const url = 'https://example.com/timeout.png';
        vi.stubGlobal('fetch', vi.fn((_url: string, init?: RequestInit) =>
            new Promise<Response>((_resolve, reject) => {
                init?.signal?.addEventListener('abort', () => {
                    reject(new DOMException('Aborted', 'AbortError'));
                }, { once: true });
            })
        ));

        const resolution = resolveRemoteImageFromMemoryCache(url);
        await Promise.resolve();

        expect(fetch).toHaveBeenCalledWith(url, {
            cache: 'force-cache',
            credentials: 'omit',
            referrerPolicy: 'no-referrer',
            signal: expect.any(AbortSignal),
        });

        await vi.advanceTimersByTimeAsync(REMOTE_IMAGE_FETCH_TIMEOUT_MS);

        await expect(resolution).resolves.toBe(url);
        expect(URL.createObjectURL).not.toHaveBeenCalled();
    });

    it('does not repopulate the cache from requests that finish after clearing', async () => {
        let resolveBlob: () => void = () => undefined;
        let resolveBlobStarted: () => void = () => undefined;
        const blobStarted = new Promise<void>((resolve) => {
            resolveBlobStarted = resolve;
        });
        const url = 'https://example.com/late.png';
        vi.mocked(URL.createObjectURL).mockReturnValueOnce('blob:late-remote-image');
        vi.stubGlobal('fetch', vi.fn(async () => ({
            ok: true,
            headers: new Headers({ 'content-length': '12' }),
            blob: async () => {
                resolveBlobStarted();
                await new Promise<void>((resolve) => {
                    resolveBlob = resolve;
                });
                return new Blob(['remote image'], { type: 'image/png' });
            },
        })));

        const resolution = resolveRemoteImageFromMemoryCache(url);

        await vi.waitFor(() => {
            expect(fetch).toHaveBeenCalledTimes(1);
        });
        await blobStarted;

        clearRemoteImageMemoryCache();
        resolveBlob();

        await expect(resolution).resolves.toBe(url);
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:late-remote-image');
    });
});
