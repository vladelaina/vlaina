import { describe, expect, it } from 'vitest';
import {
    extractImageFilesFromClipboardItems,
    extractImageFilesFromFileList,
} from './imageFileExtraction';

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

    it('extracts image files from a dropped file list only', () => {
        const imageFile = new File(['demo'], 'demo.png', { type: 'image/png' });
        const textFile = new File(['demo'], 'demo.txt', { type: 'text/plain' });

        expect(extractImageFilesFromFileList([imageFile, textFile])).toEqual([imageFile]);
    });
});
