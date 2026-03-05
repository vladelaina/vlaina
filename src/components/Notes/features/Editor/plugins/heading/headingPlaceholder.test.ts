import { describe, expect, it } from 'vitest';
import { getHeadingPlaceholder } from './headingPlaceholder';

describe('getHeadingPlaceholder', () => {
    it('returns placeholder by heading level', () => {
        expect(getHeadingPlaceholder(1)).toBe('Heading 1');
        expect(getHeadingPlaceholder(2)).toBe('Heading 2');
        expect(getHeadingPlaceholder(3)).toBe('Heading 3');
        expect(getHeadingPlaceholder(4)).toBe('Heading 4');
        expect(getHeadingPlaceholder(5)).toBe('Heading 5');
        expect(getHeadingPlaceholder(6)).toBe('Heading 6');
    });

    it('clamps unsupported levels into 1~6', () => {
        expect(getHeadingPlaceholder(0)).toBe('Heading 1');
        expect(getHeadingPlaceholder(-3)).toBe('Heading 1');
        expect(getHeadingPlaceholder(9)).toBe('Heading 6');
    });
});
