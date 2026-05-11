import { describe, expect, it } from 'vitest';
import { getImageAlignment, getImageWidth, mergeImageNodeAttrs } from './imageNodeAttrs';
import { parseImageSource } from './imageSourceFragment';

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

    it('keeps crop and alignment when resizing an existing image', () => {
        const latest = {
            src: 'image.png#c=5.000000,6.000000,70.000000,80.000000,1.250000&a=left',
            alt: 'cover',
        };
        const next = mergeImageNodeAttrs(latest, { width: '33%' });
        const parsed = parseImageSource(next.src as string);

        expect(parsed.crop).toMatchObject({ x: 5, y: 6, width: 70, height: 80, ratio: 1.25 });
        expect(parsed.align).toBe('left');
        expect(parsed.width).toBe('33%');
        expect(next.alt).toBe('cover');
    });

    it('keeps crop and width when changing alignment', () => {
        const latest = {
            src: 'image.png#c=5.000000,6.000000,70.000000,80.000000,1.250000&w=33%25',
            alt: 'cover',
        };
        const next = mergeImageNodeAttrs(latest, { align: 'right' });
        const parsed = parseImageSource(next.src as string);

        expect(parsed.crop).toMatchObject({ x: 5, y: 6, width: 70, height: 80, ratio: 1.25 });
        expect(parsed.align).toBe('right');
        expect(parsed.width).toBe('33%');
        expect(next.alt).toBe('cover');
    });

    it('updates caption without changing persisted layout fragments', () => {
        const latest = {
            src: 'image.png#c=5.000000,6.000000,70.000000,80.000000,1.250000&a=left&w=33%25&foo=bar',
            alt: 'old',
        };
        const next = mergeImageNodeAttrs(latest, { alt: 'new' });
        const parsed = parseImageSource(next.src as string);

        expect(parsed.crop).toMatchObject({ x: 5, y: 6, width: 70, height: 80, ratio: 1.25 });
        expect(parsed.align).toBe('left');
        expect(parsed.width).toBe('33%');
        expect(parsed.extras).toContain('foo=bar');
        expect(next.alt).toBe('new');
    });

    it('handles non-string src values safely', () => {
        expect(getImageAlignment({ src: 123 })).toBe('center');
        expect(getImageWidth({ src: 123, width: '40%' })).toBe('40%');
        const next = mergeImageNodeAttrs({ src: 123 }, { align: 'left', width: '25%' });
        const parsed = parseImageSource(next.src as string);
        expect(parsed.align).toBe('left');
        expect(parsed.width).toBe('25%');
    });

    it('clamps or drops note-controlled image layout values', () => {
        const parsed = parseImageSource('image.png#c=-10,200,999,0,999&w=999999%25&x=1');

        expect(parsed.crop).toEqual({
            x: 0,
            y: 100,
            width: 100,
            height: 1,
            ratio: 20,
        });
        expect(parsed.width).toBe('100%');
        expect(getImageWidth({ src: 'image.png#w=url(https%3A%2F%2Fexample.com%2Fx)' })).toBeNull();
        expect(getImageWidth({ src: 'image.png', width: 'calc(999999px * 999999)' })).toBeNull();
        expect(getImageWidth({ src: 'image.png', width: '999999px' })).toBe('2000px');
    });
});
