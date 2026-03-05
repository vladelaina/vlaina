import { describe, expect, it } from 'vitest';
import { getImageAlignment, getImageWidth, mergeImageNodeAttrs } from './imageNodeAttrs';
import { parseImageSource } from './cropUtils';

describe('imageNodeAttrs', () => {
    it('reads alignment and width from src fragment first', () => {
        const attrs = { src: 'image.png#a=left&w=30%25', align: 'right', width: '90%' };
        expect(getImageAlignment(attrs)).toBe('left');
        expect(getImageWidth(attrs)).toBe('30%');
    });

    it('falls back to node attrs when src has no alignment/width fragment', () => {
        const attrs = { src: 'image.png', align: 'right', width: '45%' };
        expect(getImageAlignment(attrs)).toBe('right');
        expect(getImageWidth(attrs)).toBe('45%');
    });

    it('merges alignment update while preserving crop/width/extras', () => {
        const latest = {
            src: 'image.png#c=1.000000,2.000000,30.000000,40.000000,1.500000&w=25%25&foo=bar',
            alt: 'cover',
        };

        const next = mergeImageNodeAttrs(latest, { align: 'left' });
        const parsed = parseImageSource(next.src as string);

        expect(parsed.align).toBe('left');
        expect(parsed.width).toBe('25%');
        expect(parsed.crop?.ratio).toBe(1.5);
        expect(parsed.extras).toContain('foo=bar');
        expect(next.alt).toBe('cover');
    });

    it('keeps existing alignment/width when incoming src only updates crop', () => {
        const latest = { src: 'image.png#a=right&w=25%25&foo=bar' };
        const next = mergeImageNodeAttrs(latest, { src: 'image.png#c=5,6,7,8,1' });
        const parsed = parseImageSource(next.src as string);

        expect(parsed.align).toBe('right');
        expect(parsed.width).toBe('25%');
        expect(parsed.crop).not.toBeNull();
        expect(parsed.extras).toContain('foo=bar');
    });

    it('handles non-string src values safely', () => {
        expect(getImageAlignment({ src: 123 })).toBe('center');
        expect(getImageWidth({ src: 123, width: '40%' })).toBe('40%');
        const next = mergeImageNodeAttrs({ src: 123 }, { align: 'left', width: '25%' });
        const parsed = parseImageSource(next.src as string);
        expect(parsed.align).toBe('left');
        expect(parsed.width).toBe('25%');
    });
});
