import { describe, expect, it } from 'vitest';
import { resolveCoverZoom, resolveDisplayedMediaSizeAtZoom1 } from './cropperViewport';

describe('cropperViewport', () => {
    it('resolves cover zoom for a container that is taller than the image ratio', () => {
        expect(resolveCoverZoom(
            { width: 500, height: 500 },
            { width: 170, height: 141 },
        )).toBeCloseTo(1.2068794326241132, 6);
    });

    it('resolves the displayed media size at zoom 1', () => {
        const displayed = resolveDisplayedMediaSizeAtZoom1(
            { width: 500, height: 500 },
            { width: 170, height: 141 },
        );

        expect(displayed?.width).toBeCloseTo(500, 6);
        expect(displayed?.height).toBeCloseTo(414.7058823529412, 6);
    });

    it('returns null for invalid sizes', () => {
        expect(resolveCoverZoom(
            { width: 0, height: 500 },
            { width: 170, height: 141 },
        )).toBeNull();
        expect(resolveDisplayedMediaSizeAtZoom1(
            { width: 500, height: 500 },
            { width: 0, height: 141 },
        )).toBeNull();
    });
});
