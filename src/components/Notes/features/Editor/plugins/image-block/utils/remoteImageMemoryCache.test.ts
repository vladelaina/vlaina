import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    clearRemoteImageMemoryCache,
    clearRemoteImageMemoryCacheForTests,
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
