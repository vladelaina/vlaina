import { describe, expect, it } from 'vitest';
import {
    MAX_IMAGE_UPLOAD_INPUT_FILES,
    MAX_IMAGE_UPLOAD_TRANSFER_ITEM_SCAN,
    extractImageFilesFromClipboardItems,
    extractImageFilesFromFileList,
} from './imageFileExtraction';

const supportedImageFilenames = [
    'photo.jpg',
    'photo.jpeg',
    'screenshot.png',
    'animation.gif',
    'cover.webp',
    'diagram.svg',
    'scan.bmp',
    'favicon.ico',
    'photo.avif',
];

describe('imageFileExtraction', () => {
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

    it('extracts clipboard image files when MIME is missing but filename is known', () => {
        const imageFiles = supportedImageFilenames.map((filename) => new File(['demo'], filename, { type: '' }));
        const explicitTextFile = new File(['demo'], 'looks-like-image.png', { type: 'text/plain' });
        const items = [
            ...imageFiles.map((file) => ({ kind: 'file', type: '', getAsFile: () => file })),
            { kind: 'file', type: 'text/plain', getAsFile: () => explicitTextFile },
        ];

        expect(extractImageFilesFromClipboardItems(items)).toEqual(imageFiles);
    });

    it('extracts image files from a dropped file list only', () => {
        const imageFile = new File(['demo'], 'demo.png', { type: 'image/png' });
        const textFile = new File(['demo'], 'demo.txt', { type: 'text/plain' });

        expect(extractImageFilesFromFileList([imageFile, textFile])).toEqual([imageFile]);
    });

    it('extracts dropped image files when MIME is octet-stream but filename is known', () => {
        const imageFiles = supportedImageFilenames.map((filename) =>
            new File(['demo'], filename, { type: 'application/octet-stream' })
        );
        const explicitTextFile = new File(['demo'], 'looks-like-image.png', { type: 'text/plain' });

        expect(extractImageFilesFromFileList([...imageFiles, explicitTextFile])).toEqual(imageFiles);
    });

    it('caps clipboard item scanning and collected image files', () => {
        const imageFile = new File(['demo'], 'demo.png', { type: 'image/png' });
        let accessed = 0;
        const items = {
            length: MAX_IMAGE_UPLOAD_TRANSFER_ITEM_SCAN + 1,
            get [0]() {
                accessed += 1;
                return { type: 'image/png', getAsFile: () => imageFile };
            },
        } as ArrayLike<{ type: string; getAsFile: () => File | null }>;

        for (let index = 1; index < MAX_IMAGE_UPLOAD_TRANSFER_ITEM_SCAN; index += 1) {
            Object.defineProperty(items, index, {
                get() {
                    accessed += 1;
                    return { type: 'image/png', getAsFile: () => imageFile };
                },
            });
        }
        Object.defineProperty(items, MAX_IMAGE_UPLOAD_TRANSFER_ITEM_SCAN, {
            get() {
                throw new Error('Read past clipboard item scan cap');
            },
        });

        const files = extractImageFilesFromClipboardItems(items);

        expect(files).toHaveLength(MAX_IMAGE_UPLOAD_INPUT_FILES);
        expect(accessed).toBe(MAX_IMAGE_UPLOAD_INPUT_FILES);
    });

    it('caps dropped file list scanning and collected image files', () => {
        const imageFile = new File(['demo'], 'demo.png', { type: 'image/png' });
        let accessed = 0;
        const files = {
            length: MAX_IMAGE_UPLOAD_TRANSFER_ITEM_SCAN + 1,
            get [0]() {
                accessed += 1;
                return imageFile;
            },
        } as ArrayLike<File>;

        for (let index = 1; index < MAX_IMAGE_UPLOAD_TRANSFER_ITEM_SCAN; index += 1) {
            Object.defineProperty(files, index, {
                get() {
                    accessed += 1;
                    return imageFile;
                },
            });
        }
        Object.defineProperty(files, MAX_IMAGE_UPLOAD_TRANSFER_ITEM_SCAN, {
            get() {
                throw new Error('Read past dropped file scan cap');
            },
        });

        const imageFiles = extractImageFilesFromFileList(files);

        expect(imageFiles).toHaveLength(MAX_IMAGE_UPLOAD_INPUT_FILES);
        expect(accessed).toBe(MAX_IMAGE_UPLOAD_INPUT_FILES);
    });
});
