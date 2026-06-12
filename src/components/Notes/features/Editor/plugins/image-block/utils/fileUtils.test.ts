import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    cancelAllPendingImageDeletions,
    ensureImageFileExists,
    MAX_PENDING_IMAGE_DELETIONS,
    MAX_RESTORED_IMAGE_BYTES,
    moveImageToTrash,
} from './fileUtils';
import { moveDesktopItemToTrash } from '@/lib/desktop/trash';

const adapter = {
    exists: vi.fn<(path: string) => Promise<boolean>>(),
    writeBinaryFile: vi.fn<(path: string, data: Uint8Array, options?: { recursive?: boolean }) => Promise<void>>(),
};

vi.mock('@/lib/desktop/trash', () => ({
    moveDesktopItemToTrash: vi.fn<() => Promise<void>>(),
}));

vi.mock('@/lib/storage/adapter', () => ({
    getStorageAdapter: () => adapter,
    getParentPath(path: string) {
        const normalized = path.replace(/\\/g, '/');
        const index = normalized.lastIndexOf('/');
        return index > 0 ? normalized.slice(0, index) : null;
    },
    isAbsolutePath(path: string) {
        return path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path);
    },
    async joinPath(...segments: string[]) {
        return segments
            .filter(Boolean)
            .map((segment, index) => (
                index === 0
                    ? segment.replace(/[/\\]+$/, '')
                    : segment.replace(/^[/\\]+/, '')
            ))
            .join('/');
    },
}));

describe('image block file utils', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        adapter.exists.mockResolvedValue(false);
        adapter.writeBinaryFile.mockResolvedValue();
    });

    afterEach(() => {
        cancelAllPendingImageDeletions();
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it('does not move non-image vault files to trash', async () => {
        const moved = await moveImageToTrash('docs/secret.md', '/vault', 'note.md');

        await vi.advanceTimersByTimeAsync(10000);

        expect(moved).toBe(false);
        expect(moveDesktopItemToTrash).not.toHaveBeenCalled();
    });

    it('moves image files to trash after the undo grace period', async () => {
        const moved = await moveImageToTrash('assets/demo.png', '/vault', undefined);

        await vi.advanceTimersByTimeAsync(10000);

        expect(moved).toBe(true);
        expect(moveDesktopItemToTrash).toHaveBeenCalledWith('/vault/assets/demo.png');
    });

    it('bounds pending image deletions for different files', async () => {
        const moves = await Promise.all(
            Array.from({ length: MAX_PENDING_IMAGE_DELETIONS }, (_value, index) =>
                moveImageToTrash(`assets/demo-${index}.png`, '/vault', undefined)
            )
        );

        expect(moves.every(Boolean)).toBe(true);
        await expect(moveImageToTrash('assets/overflow.png', '/vault', undefined)).resolves.toBe(false);

        await vi.advanceTimersByTimeAsync(10000);

        expect(moveDesktopItemToTrash).toHaveBeenCalledTimes(MAX_PENDING_IMAGE_DELETIONS);
        expect(moveDesktopItemToTrash).not.toHaveBeenCalledWith('/vault/assets/overflow.png');
    });

    it('does not move unsafe media sources to trash', async () => {
        await expect(moveImageToTrash('javascript:demo.png', '/vault', 'note.md')).resolves.toBe(false);
        await expect(moveImageToTrash('http://127.0.0.1:3000/demo.png', '/vault', 'note.md')).resolves.toBe(false);

        await vi.advanceTimersByTimeAsync(10000);

        expect(moveDesktopItemToTrash).not.toHaveBeenCalled();
    });

    it('does not restore non-image paths from blob URLs', async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        await ensureImageFileExists('docs/secret.md', 'blob:http://localhost/demo', '/vault', 'note.md');

        expect(fetchMock).not.toHaveBeenCalled();
        expect(adapter.writeBinaryFile).not.toHaveBeenCalled();
    });

    it('does not restore unsafe media sources as local image files', async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        await ensureImageFileExists('javascript:demo.png', 'blob:http://localhost/demo', '/vault', 'note.md');
        await ensureImageFileExists('http://127.0.0.1:3000/demo.png', 'blob:http://localhost/demo', '/vault', 'note.md');

        expect(fetchMock).not.toHaveBeenCalled();
        expect(adapter.writeBinaryFile).not.toHaveBeenCalled();
    });

    it('does not restore oversized image blobs', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => ({
            blob: async () => ({
                type: 'image/png',
                size: 51 * 1024 * 1024,
                arrayBuffer: vi.fn(),
            }),
        })));

        await ensureImageFileExists('assets/demo.png', 'blob:http://localhost/demo', '/vault', 'note.md');

        expect(adapter.writeBinaryFile).not.toHaveBeenCalled();
    });

    it('does not restore image blobs with invalid size metadata', async () => {
        const arrayBuffer = vi.fn();
        vi.stubGlobal('fetch', vi.fn(async () => ({
            headers: new Headers({
                'content-length': '2',
                'content-type': 'image/png',
            }),
            blob: async () => ({
                type: 'image/png',
                size: -1,
                arrayBuffer,
            }),
        })));

        await ensureImageFileExists('assets/demo.png', 'blob:http://localhost/demo', '/vault', 'note.md');

        expect(arrayBuffer).not.toHaveBeenCalled();
        expect(adapter.writeBinaryFile).not.toHaveBeenCalled();
    });

    it('stops reading streamed restore blobs once they exceed the image limit', async () => {
        const cancel = vi.fn(async () => undefined);
        const reader = {
            read: vi.fn()
                .mockResolvedValueOnce({ done: false, value: new Uint8Array(MAX_RESTORED_IMAGE_BYTES) })
                .mockResolvedValueOnce({ done: false, value: new Uint8Array(1) }),
            cancel,
            releaseLock: vi.fn(),
        };
        vi.stubGlobal('fetch', vi.fn(async () => ({
            headers: new Headers({ 'content-type': 'image/png' }),
            body: {
                getReader: () => reader,
            },
            blob: vi.fn(),
        })));

        await ensureImageFileExists('assets/demo.png', 'blob:http://localhost/demo', '/vault', 'note.md');

        expect(cancel).toHaveBeenCalledTimes(1);
        expect(reader.releaseLock).toHaveBeenCalledTimes(1);
        expect(adapter.writeBinaryFile).not.toHaveBeenCalled();
    });

    it('does not restore non-image blobs even when the target has an image extension', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => ({
            blob: async () => ({
                type: 'text/html',
                size: 12,
                arrayBuffer: async () => new Uint8Array([1, 2]).buffer,
            }),
        })));

        await ensureImageFileExists('assets/demo.png', 'blob:http://localhost/demo', '/vault', 'note.md');

        expect(adapter.writeBinaryFile).not.toHaveBeenCalled();
    });

    it('restores image blobs with recursive directory creation', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => ({
            headers: new Headers({
                'content-length': '2',
                'content-type': 'image/png',
            }),
            blob: async () => ({
                type: 'image/png',
                size: 2,
                arrayBuffer: async () => new Uint8Array([1, 2]).buffer,
            }),
        })));

        await ensureImageFileExists('assets/demo.png', 'blob:http://localhost/demo', '/vault', 'note.md');

        expect(adapter.writeBinaryFile).toHaveBeenCalledWith(
            '/vault/assets/demo.png',
            new Uint8Array([1, 2]),
            { recursive: true },
        );
    });

    it('sanitizes restored SVG image blobs before writing them', async () => {
        const svg = [
            '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)">',
            '<script>alert(1)</script>',
            '<foreignObject><iframe src="javascript:alert(1)"></iframe></foreignObject>',
            '<image href="https://example.test/a.png" xlink:href="https://example.test/b.png"></image>',
            '<rect filter="url(https://example.test/filter.svg#drop)" fill="url(#local-fill)"></rect>',
            '<circle cx="1" cy="1" r="1"></circle>',
            '</svg>',
        ].join('');
        vi.stubGlobal('fetch', vi.fn(async () => ({
            headers: new Headers({
                'content-length': String(svg.length),
                'content-type': 'image/svg+xml;charset=utf-8',
            }),
            blob: async () => ({
                type: 'image/svg+xml;charset=utf-8',
                size: svg.length,
                arrayBuffer: async () => new TextEncoder().encode(svg).buffer,
            }),
        })));

        await ensureImageFileExists('assets/demo.svg', 'blob:http://localhost/demo', '/vault', 'note.md');

        const bytes = adapter.writeBinaryFile.mock.calls[0]?.[1] as Uint8Array;
        const output = new TextDecoder().decode(bytes);
        expect(output).toContain('<svg');
        expect(output).toContain('<circle');
        expect(output).toContain('url(#local-fill)');
        expect(output).not.toContain('<script');
        expect(output).not.toContain('foreignObject');
        expect(output).not.toContain('javascript:');
        expect(output).not.toContain('example.test');
        expect(output).not.toContain('onload');
    });
});
