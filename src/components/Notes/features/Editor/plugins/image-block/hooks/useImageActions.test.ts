import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_FETCHED_IMAGE_BYTES } from '@/lib/markdown/fetchBoundedImageBlob';
import { createImageDownloadDefaultName, useImageActions } from './useImageActions';

const mocks = vi.hoisted(() => ({
    ensureImageFileExists: vi.fn(async () => undefined),
    saveDialog: vi.fn(async () => '/downloads/demo.png'),
    writeDesktopBinaryFile: vi.fn(async () => undefined),
    writeTextToClipboard: vi.fn(async () => true),
}));

vi.mock('@/lib/i18n', () => ({
    useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('@/lib/clipboard', () => ({
    writeTextToClipboard: mocks.writeTextToClipboard,
}));

vi.mock('@/lib/desktop/fs', () => ({
    writeDesktopBinaryFile: mocks.writeDesktopBinaryFile,
}));

vi.mock('@/lib/storage/dialog', () => ({
    saveDialog: mocks.saveDialog,
}));

vi.mock('../utils/fileUtils', () => ({
    ensureImageFileExists: mocks.ensureImageFileExists,
}));

vi.mock('../commands/imageNodeCommands', () => ({
    deleteImageNodeAtPos: vi.fn(),
}));

function renderImageActions() {
    return renderHook(() =>
        useImageActions({
            node: { attrs: { src: 'assets/demo.png', alt: 'demo' } } as never,
            view: {} as never,
            getPos: () => undefined,
            baseSrc: 'assets/demo.png',
            resolvedSrc: 'blob:resolved-image',
            notesPath: '/vault',
            currentNotePath: 'note.md',
            updateNodeAttrs: vi.fn(),
            markImageUserInput: vi.fn(),
            setCropParams: vi.fn(),
            setIsActive: vi.fn(),
            setHeight: vi.fn(),
        })
    );
}

describe('createImageDownloadDefaultName', () => {
    it('removes path separators and control characters from image download names', () => {
        expect(createImageDownloadDefaultName('../secret\u0000name', 'assets/photo.webp')).toBe('secretname.webp');
        expect(createImageDownloadDefaultName('folder\\evil/name', 'assets/photo.jpg')).toBe('folderevilname.jpg');
    });

    it('falls back to a safe extension for unsupported source extensions', () => {
        expect(createImageDownloadDefaultName('cover', 'assets/cover.html')).toBe('cover.png');
        expect(createImageDownloadDefaultName('...', 'assets/cover')).toBe('image.png');
    });
});

describe('useImageActions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.unstubAllGlobals();
    });

    it('falls back to copying source text when resolved content is not an image', async () => {
        const clipboardWrite = vi.fn();
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { write: clipboardWrite },
        });
        vi.stubGlobal('fetch', vi.fn(async () => ({
            headers: new Headers({
                'content-length': '12',
                'content-type': 'text/html',
            }),
            blob: async () => new Blob(['not an image'], { type: 'text/html' }),
        })));
        const { result } = renderImageActions();

        let copied = false;
        await act(async () => {
            copied = await result.current.handleCopy();
        });

        expect(copied).toBe(true);
        expect(clipboardWrite).not.toHaveBeenCalled();
        expect(mocks.writeTextToClipboard).toHaveBeenCalledWith('assets/demo.png');
    });

    it('copies resolved image content to the clipboard', async () => {
        const clipboardWrite = vi.fn(async () => undefined);
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { write: clipboardWrite },
        });
        vi.stubGlobal('ClipboardItem', vi.fn(function ClipboardItem(items) {
            return { items };
        }));
        vi.stubGlobal('fetch', vi.fn(async () => ({
            headers: new Headers({
                'content-length': '3',
                'content-type': 'image/png',
            }),
            blob: async () => new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }),
        })));
        const { result } = renderImageActions();

        let copied = false;
        await act(async () => {
            copied = await result.current.handleCopy();
        });

        expect(copied).toBe(true);
        expect(clipboardWrite).toHaveBeenCalledTimes(1);
        expect(mocks.writeTextToClipboard).not.toHaveBeenCalled();
    });

    it('does not copy oversized resolved image responses', async () => {
        const clipboardWrite = vi.fn();
        const blob = vi.fn(async () => new Blob([new Uint8Array([1])], { type: 'image/png' }));
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { write: clipboardWrite },
        });
        vi.stubGlobal('fetch', vi.fn(async () => ({
            headers: new Headers({
                'content-length': String(MAX_FETCHED_IMAGE_BYTES + 1),
                'content-type': 'image/png',
            }),
            blob,
        })));
        const { result } = renderImageActions();

        let copied = true;
        await act(async () => {
            copied = await result.current.handleCopy();
        });

        expect(copied).toBe(false);
        expect(blob).not.toHaveBeenCalled();
        expect(clipboardWrite).not.toHaveBeenCalled();
        expect(mocks.writeTextToClipboard).not.toHaveBeenCalled();
    });

    it('does not write downloaded non-image content to disk', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => ({
            headers: new Headers({
                'content-length': '12',
                'content-type': 'text/html',
            }),
            blob: async () => new Blob(['not an image'], { type: 'text/html' }),
        })));
        const { result } = renderImageActions();

        await act(async () => {
            await result.current.handleDownload();
        });

        expect(mocks.saveDialog).toHaveBeenCalledWith({
            defaultPath: 'demo.png',
            filters: [{ name: 'Images', extensions: ['png', 'jpg', 'webp'] }],
        });
        expect(mocks.writeDesktopBinaryFile).not.toHaveBeenCalled();
    });

    it('writes downloaded image content to disk', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => ({
            headers: new Headers({
                'content-length': '3',
                'content-type': 'image/png',
            }),
            blob: async () => new Blob([new Uint8Array([4, 5, 6])], { type: 'image/png' }),
        })));
        const { result } = renderImageActions();

        await act(async () => {
            await result.current.handleDownload();
        });

        expect(mocks.writeDesktopBinaryFile).toHaveBeenCalledWith(
            '/downloads/demo.png',
            expect.any(Uint8Array),
        );
    });

    it('does not write or anchor-download oversized image responses', async () => {
        const blob = vi.fn(async () => new Blob([new Uint8Array([1])], { type: 'image/png' }));
        vi.stubGlobal('fetch', vi.fn(async () => ({
            headers: new Headers({
                'content-length': String(MAX_FETCHED_IMAGE_BYTES + 1),
                'content-type': 'image/png',
            }),
            blob,
        })));
        const { result } = renderImageActions();
        const appendSpy = vi.spyOn(document.body, 'appendChild');

        await act(async () => {
            await result.current.handleDownload();
        });

        expect(blob).not.toHaveBeenCalled();
        expect(mocks.writeDesktopBinaryFile).not.toHaveBeenCalled();
        expect(appendSpy).not.toHaveBeenCalled();

        appendSpy.mockRestore();
    });
});
