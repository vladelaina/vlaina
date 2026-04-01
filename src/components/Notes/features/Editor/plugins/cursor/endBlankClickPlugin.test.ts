import { describe, expect, it } from 'vitest';
import { getTemporaryTailParagraphPos } from './endBlankClickPlugin';

describe('getTemporaryTailParagraphPos', () => {
    it('returns the position when the tracked node is the last empty paragraph', () => {
        const doc = {
            content: { size: 12 },
            nodeAt: (pos: number) => (pos === 10
                ? { type: { name: 'paragraph' }, content: { size: 0 }, nodeSize: 2 }
                : null),
        };

        expect(getTemporaryTailParagraphPos(doc, 10)).toBe(10);
    });

    it('returns null when the tracked node is not the trailing empty paragraph', () => {
        const doc = {
            content: { size: 12 },
            nodeAt: (pos: number) => {
                if (pos === 8) {
                    return { type: { name: 'paragraph' }, content: { size: 0 }, nodeSize: 2 };
                }
                if (pos === 10) {
                    return { type: { name: 'paragraph' }, content: { size: 1 }, nodeSize: 2 };
                }
                return null;
            },
        };

        expect(getTemporaryTailParagraphPos(doc, 8)).toBeNull();
        expect(getTemporaryTailParagraphPos(doc, 10)).toBeNull();
        expect(getTemporaryTailParagraphPos(doc, null)).toBeNull();
    });
});
