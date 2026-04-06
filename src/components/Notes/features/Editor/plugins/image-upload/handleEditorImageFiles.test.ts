import { describe, expect, it, vi } from 'vitest';
import { handleEditorImageFiles, uploadImageFileAndInsert } from './handleEditorImageFiles';

describe('handleEditorImageFiles', () => {
    it('uploads a file and inserts the uploaded image path', async () => {
        const scrollIntoView = vi.fn(function () {
            return tr;
        });
        const replaceSelectionWith = vi.fn(function () {
            return { scrollIntoView, docChanged: true };
        });
        const tr = { replaceSelectionWith };
        const dispatch = vi.fn();
        const create = vi.fn(() => ({ type: 'image-node' }));
        const uploadAsset = vi.fn().mockResolvedValue({
            success: true,
            path: './assets/demo.png',
            isDuplicate: false,
        });
        const view = {
            state: {
                schema: { nodes: { image: { create } } },
                tr,
            },
            dispatch,
        };
        const file = new File(['demo'], 'demo.png', { type: 'image/png' });

        await expect(uploadImageFileAndInsert(file, view as never, () => ({
            uploadAsset,
            currentNote: { path: 'daily/demo.md', content: '' },
        }))).resolves.toBe(true);

        expect(uploadAsset).toHaveBeenCalledWith(file, 'content', 'daily/demo.md');
        expect(replaceSelectionWith).toHaveBeenCalledTimes(2);
        expect(dispatch).toHaveBeenCalledTimes(1);
    });

    it('does not upload when the current selection cannot accept images', async () => {
        const replaceSelectionWith = vi.fn(() => {
            throw new Error('cannot insert');
        });
        const create = vi.fn(() => ({ type: 'image-node' }));
        const uploadAsset = vi.fn();
        const view = {
            state: {
                schema: { nodes: { image: { create } } },
                tr: { replaceSelectionWith },
            },
            dispatch: vi.fn(),
        };
        const file = new File(['demo'], 'demo.png', { type: 'image/png' });

        await expect(handleEditorImageFiles([file], view as never, () => ({
            uploadAsset,
            currentNote: { path: 'daily/demo.md', content: '' },
        }))).resolves.toBe(false);

        expect(uploadAsset).not.toHaveBeenCalled();
    });

    it('uploads multiple files in sequence', async () => {
        const scrollIntoView = vi.fn(function () {
            return tr;
        });
        const replaceSelectionWith = vi.fn(function () {
            return { scrollIntoView, docChanged: true };
        });
        const tr = { replaceSelectionWith };
        const dispatch = vi.fn();
        const create = vi.fn(() => ({ type: 'image-node' }));
        const uploadAsset = vi.fn()
            .mockResolvedValueOnce({
                success: true,
                path: './assets/one.png',
                isDuplicate: false,
            })
            .mockResolvedValueOnce({
                success: true,
                path: './assets/two.png',
                isDuplicate: false,
            });
        const view = {
            state: {
                schema: { nodes: { image: { create } } },
                tr,
            },
            dispatch,
        };
        const files = [
            new File(['one'], 'one.png', { type: 'image/png' }),
            new File(['two'], 'two.png', { type: 'image/png' }),
        ];

        await expect(handleEditorImageFiles(files, view as never, () => ({
            uploadAsset,
            currentNote: { path: 'daily/demo.md', content: '' },
        }))).resolves.toBe(true);

        expect(uploadAsset).toHaveBeenCalledTimes(2);
        expect(dispatch).toHaveBeenCalledTimes(2);
    });
});
