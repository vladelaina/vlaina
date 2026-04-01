import { describe, expect, it, vi } from 'vitest';
import {
    buildImageNodeAttrs,
    extractImageFilesFromClipboardItems,
    extractImageFilesFromFileList,
    insertImageNodeAtSelection,
    uploadImageFileAndInsert,
} from './imageUploadHelpers';

describe('imageUploadHelpers', () => {
    it('extracts image files from clipboard items only', () => {
        const imageFile = new File(['demo'], 'demo.png', { type: 'image/png' });
        const textFile = new File(['demo'], 'demo.txt', { type: 'text/plain' });
        const items = [
            { type: 'image/png', getAsFile: () => imageFile },
            { type: 'text/plain', getAsFile: () => textFile },
            { type: 'image/jpeg', getAsFile: () => null },
        ];

        expect(extractImageFilesFromClipboardItems(items)).toEqual([imageFile]);
    });

    it('extracts image files from a dropped file list only', () => {
        const imageFile = new File(['demo'], 'demo.png', { type: 'image/png' });
        const textFile = new File(['demo'], 'demo.txt', { type: 'text/plain' });

        expect(extractImageFilesFromFileList([imageFile, textFile])).toEqual([imageFile]);
    });

    it('builds stable image attrs from the uploaded path', () => {
        expect(buildImageNodeAttrs('./assets/demo-image.png')).toEqual({
            src: './assets/demo-image.png',
            alt: 'demo-image',
            align: 'center',
            width: null,
        });
    });

    it('inserts an image node at the current selection', () => {
        const tr = {
            insert: vi.fn(),
        };
        tr.insert.mockReturnValue(tr);
        const dispatch = vi.fn();
        const imageNode = { type: 'image-node' };
        const create = vi.fn(() => imageNode);
        const view = {
            state: {
                selection: { from: 12 },
                schema: { nodes: { image: { create } } },
                tr,
            },
            dispatch,
        };

        expect(insertImageNodeAtSelection(view as never, './assets/demo-image.png')).toBe(true);
        expect(create).toHaveBeenCalledWith({
            src: './assets/demo-image.png',
            alt: 'demo-image',
            align: 'center',
            width: null,
        });
        expect(tr.insert).toHaveBeenCalledWith(12, imageNode);
        expect(dispatch).toHaveBeenCalledWith(tr);
    });

    it('uploads a file and inserts the uploaded image path', async () => {
        const file = new File(['demo'], 'demo.png', { type: 'image/png' });
        const tr = {
            insert: vi.fn(),
        };
        tr.insert.mockReturnValue(tr);
        const dispatch = vi.fn();
        const create = vi.fn(() => ({ type: 'image-node' }));
        const uploadAsset = vi.fn().mockResolvedValue({
            success: true,
            path: './assets/demo.png',
            isDuplicate: false,
        });
        const view = {
            state: {
                selection: { from: 4 },
                schema: { nodes: { image: { create } } },
                tr,
            },
            dispatch,
        };

        await expect(uploadImageFileAndInsert(file, view as never, () => ({
            uploadAsset,
            currentNote: { path: 'daily/demo.md', content: '' },
        }))).resolves.toBe(true);

        expect(uploadAsset).toHaveBeenCalledWith(file, 'content', 'daily/demo.md');
        expect(tr.insert).toHaveBeenCalledTimes(1);
    });
});
