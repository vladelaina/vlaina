import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    ensureImageFileExists,
    moveImageToTrash,
} from './fileUtils';
import { moveDesktopItemToTrash } from '@/lib/desktop/trash';

const adapter = {
    exists: vi.fn<(path: string) => Promise<boolean>>(),
    writeBinaryFile: vi.fn<(path: string, data: Uint8Array) => Promise<void>>(),
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

    it('does not restore non-image paths from blob URLs', async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        await ensureImageFileExists('docs/secret.md', 'blob:http://localhost/demo', '/vault', 'note.md');

        expect(fetchMock).not.toHaveBeenCalled();
        expect(adapter.writeBinaryFile).not.toHaveBeenCalled();
    });

    it('does not restore oversized image blobs', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => ({
            blob: async () => ({
                size: 51 * 1024 * 1024,
                arrayBuffer: vi.fn(),
            }),
        })));

        await ensureImageFileExists('assets/demo.png', 'blob:http://localhost/demo', '/vault', 'note.md');

        expect(adapter.writeBinaryFile).not.toHaveBeenCalled();
    });
});
