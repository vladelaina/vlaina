import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    ensureImageFileExists,
    MAX_RESTORED_IMAGE_BYTES,
    moveImageToTrash,
} from './fileUtils';

const adapter = {
    exists: vi.fn<(path: string) => Promise<boolean>>(),
    writeBinaryFile: vi.fn<(path: string, data: Uint8Array, options?: { recursive?: boolean }) => Promise<void>>(),
};

const restoredRasterImageFilenames = [
    'photo.jpg',
    'photo.jpeg',
    'screenshot.png',
    'animation.gif',
    'cover.webp',
    'scan.bmp',
    'favicon.ico',
    'photo.avif',
];

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
        vi.clearAllMocks();
        vi.unstubAllGlobals();
        adapter.exists.mockResolvedValue(false);
        adapter.writeBinaryFile.mockResolvedValue();
    });

    it('does not move local image files to trash when markdown image refs are removed', async () => {
        const moved = await moveImageToTrash('assets/demo.png', '/notesRoot', undefined);

        expect(moved).toBe(false);
        expect(adapter.exists).not.toHaveBeenCalled();
    });

    it('leaves unsafe media sources untouched when markdown image refs are removed', async () => {
        await expect(moveImageToTrash('javascript:demo.png', '/notesRoot', 'note.md')).resolves.toBe(false);
        await expect(moveImageToTrash('http://127.0.0.1:3000/demo.png', '/notesRoot', 'note.md')).resolves.toBe(false);

        expect(adapter.exists).not.toHaveBeenCalled();
    });

    it('does not restore non-image paths from blob URLs', async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        await ensureImageFileExists('docs/secret.md', 'blob:http://localhost/demo', '/notesRoot', 'note.md');

        expect(fetchMock).not.toHaveBeenCalled();
        expect(adapter.writeBinaryFile).not.toHaveBeenCalled();
    });

    it('does not restore unsafe media sources as local image files', async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        await ensureImageFileExists('javascript:demo.png', 'blob:http://localhost/demo', '/notesRoot', 'note.md');
        await ensureImageFileExists('http://127.0.0.1:3000/demo.png', 'blob:http://localhost/demo', '/notesRoot', 'note.md');

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

        await ensureImageFileExists('assets/demo.png', 'blob:http://localhost/demo', '/notesRoot', 'note.md');

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

        await ensureImageFileExists('assets/demo.png', 'blob:http://localhost/demo', '/notesRoot', 'note.md');

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

        await ensureImageFileExists('assets/demo.png', 'blob:http://localhost/demo', '/notesRoot', 'note.md');

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

        await ensureImageFileExists('assets/demo.png', 'blob:http://localhost/demo', '/notesRoot', 'note.md');

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

        await ensureImageFileExists('assets/demo.png', 'blob:http://localhost/demo', '/notesRoot', 'note.md');

        expect(adapter.writeBinaryFile).toHaveBeenCalledWith(
            '/notesRoot/assets/demo.png',
            new Uint8Array([1, 2]),
            { recursive: true },
        );
    });

    it.each(restoredRasterImageFilenames)('restores %s blobs when local blob MIME is missing', async (filename) => {
        vi.stubGlobal('fetch', vi.fn(async () => ({
            headers: new Headers({
                'content-length': '2',
            }),
            blob: async () => ({
                type: '',
                size: 2,
                arrayBuffer: async () => new Uint8Array([3, 4]).buffer,
            }),
        })));

        await ensureImageFileExists(`assets/${filename}`, 'blob:http://localhost/demo', '/notesRoot', 'note.md');

        expect(adapter.writeBinaryFile).toHaveBeenCalledWith(
            `/notesRoot/assets/${filename}`,
            new Uint8Array([3, 4]),
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

        await ensureImageFileExists('assets/demo.svg', 'blob:http://localhost/demo', '/notesRoot', 'note.md');

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

    it('sanitizes restored SVG blobs when local blob MIME is missing', async () => {
        const svg = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><circle cx="1" cy="1" r="1"></circle></svg>';
        vi.stubGlobal('fetch', vi.fn(async () => ({
            headers: new Headers({
                'content-length': String(svg.length),
            }),
            blob: async () => ({
                type: '',
                size: svg.length,
                arrayBuffer: async () => new TextEncoder().encode(svg).buffer,
            }),
        })));

        await ensureImageFileExists('assets/demo.svg', 'blob:http://localhost/demo', '/notesRoot', 'note.md');

        const bytes = adapter.writeBinaryFile.mock.calls[0]?.[1] as Uint8Array;
        const output = new TextDecoder().decode(bytes);
        expect(output).toContain('<circle');
        expect(output).not.toContain('<script');
    });
});
