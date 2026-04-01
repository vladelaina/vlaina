import { describe, expect, it } from 'vitest';
import { resolveInitialImageWidth, resolveInitialImageWidthPercent } from './imageInitialWidth';

describe('imageInitialWidth', () => {
    it('keeps smaller images near their natural display ratio', () => {
        expect(resolveInitialImageWidthPercent(360, 1000)).toBe(36);
        expect(resolveInitialImageWidth(360, 1000)).toBe('36%');
    });

    it('caps large images below full width by default', () => {
        expect(resolveInitialImageWidthPercent(1800, 1000)).toBe(72);
        expect(resolveInitialImageWidth(1800, 1000)).toBe('72%');
    });

    it('enforces a sensible minimum width for very small images', () => {
        expect(resolveInitialImageWidthPercent(60, 1000)).toBe(20);
        expect(resolveInitialImageWidth(60, 1000)).toBe('20%');
    });

    it('returns null for invalid measurements', () => {
        expect(resolveInitialImageWidthPercent(0, 1000)).toBeNull();
        expect(resolveInitialImageWidthPercent(500, 0)).toBeNull();
        expect(resolveInitialImageWidth(0, 1000)).toBeNull();
    });
});
