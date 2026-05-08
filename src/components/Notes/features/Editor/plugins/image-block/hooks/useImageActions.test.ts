import { describe, expect, it } from 'vitest';
import { createImageDownloadDefaultName } from './useImageActions';

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
