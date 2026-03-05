import { describe, expect, it } from 'vitest';
import { clampHeadingLevel, getDefaultHeadingPlaceholderText } from './headingPlaceholderText';

describe('headingPlaceholderText', () => {
    it('clamps heading level to 1~6', () => {
        expect(clampHeadingLevel(-10)).toBe(1);
        expect(clampHeadingLevel(0)).toBe(1);
        expect(clampHeadingLevel(1)).toBe(1);
        expect(clampHeadingLevel(3)).toBe(3);
        expect(clampHeadingLevel(6)).toBe(6);
        expect(clampHeadingLevel(9)).toBe(6);
    });

    it('builds english placeholder copy', () => {
        expect(getDefaultHeadingPlaceholderText(1)).toBe('Heading 1');
        expect(getDefaultHeadingPlaceholderText(6)).toBe('Heading 6');
        expect(getDefaultHeadingPlaceholderText(100)).toBe('Heading 6');
    });
});
