import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useToastStore } from '@/stores/useToastStore';
import { handleEditorImageFiles, uploadImageFileAndInsert } from './handleEditorImageFiles';
import { MAX_IMAGE_UPLOAD_INPUT_FILES } from './imageFileExtraction';

describe('handleEditorImageFiles', () => {
    beforeEach(() => {
        useToastStore.setState({ toasts: [] });
        vi.restoreAllMocks();
    });

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
            dom: { dispatchEvent: vi.fn() },
            dispatch,
        };
        const file = new File(['demo'], 'demo.png', { type: 'image/png' });

        await expect(uploadImageFileAndInsert(file, view as never, () => ({
            uploadAsset,
            currentNote: { path: 'daily/demo.md', content: '' },
        }))).resolves.toBe(true);

        expect(uploadAsset).toHaveBeenCalledWith(file, 'daily/demo.md');
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
            dom: { dispatchEvent: vi.fn() },
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

    it('bounds direct image file handling before upload', async () => {
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
            dom: { dispatchEvent: vi.fn() },
            dispatch,
        };
        const files = Array.from(
            { length: MAX_IMAGE_UPLOAD_INPUT_FILES + 5 },
            (_value, index) => new File([`demo-${index}`], `demo-${index}.png`, { type: 'image/png' }),
        );

        await expect(handleEditorImageFiles(files, view as never, () => ({
            uploadAsset,
            currentNote: { path: 'daily/demo.md', content: '' },
        }))).resolves.toBe(true);

        const uploadedFiles = uploadAsset.mock.calls.map(([uploadedFile]) => uploadedFile);
        expect(uploadAsset).toHaveBeenCalledTimes(MAX_IMAGE_UPLOAD_INPUT_FILES);
        expect(uploadedFiles.at(-1)).toBe(files[MAX_IMAGE_UPLOAD_INPUT_FILES - 1]);
        expect(uploadedFiles).not.toContain(files[MAX_IMAGE_UPLOAD_INPUT_FILES]);
    });

    it('silences transient missing notesRoot upload failures', async () => {
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
            success: false,
            path: null,
            isDuplicate: false,
            error: 'Opened folder path is unavailable',
        });
        const addToast = vi.spyOn(useToastStore.getState(), 'addToast');
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
            currentNote: null,
        }))).resolves.toBe(false);

        expect(addToast).not.toHaveBeenCalled();
        expect(dispatch).not.toHaveBeenCalled();
    });
});
