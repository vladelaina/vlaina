import { describe, expect, it } from 'vitest';
import { findTailCursorPosInRange, isMarkdownStructuralResult } from './pasteCursorUtils';

type FakeNode = {
    isTextblock: boolean;
    content: { size: number };
};

const createFakeDoc = (
    nodes: Array<{ node: FakeNode; pos: number }>,
    docSize = 200,
) => ({
    content: { size: docSize },
    nodesBetween: (_from: number, _to: number, f: (node: FakeNode, pos: number) => void) => {
        nodes.forEach(({ node, pos }) => f(node, pos));
    },
});

describe('findTailCursorPosInRange', () => {
    it('returns tail of the last textblock in range', () => {
        const doc = createFakeDoc([
            { node: { isTextblock: true, content: { size: 3 } }, pos: 10 },
            { node: { isTextblock: true, content: { size: 8 } }, pos: 30 },
        ]);

        expect(findTailCursorPosInRange(doc, 5, 60)).toBe(39);
    });

    it('places cursor after single-character text', () => {
        const doc = createFakeDoc([
            { node: { isTextblock: true, content: { size: 1 } }, pos: 5 },
        ]);

        expect(findTailCursorPosInRange(doc, 0, 20)).toBe(7);
    });

    it('ignores non-textblock nodes', () => {
        const doc = createFakeDoc([
            { node: { isTextblock: false, content: { size: 10 } }, pos: 20 },
        ]);

        expect(findTailCursorPosInRange(doc, 0, 40)).toBeNull();
    });

    it('ignores out-of-bounds candidates', () => {
        const doc = createFakeDoc(
            [
                { node: { isTextblock: true, content: { size: 50 } }, pos: 180 },
            ],
            200,
        );

        expect(findTailCursorPosInRange(doc, 0, 200)).toBeNull();
    });
});

describe('isMarkdownStructuralResult', () => {
    it('returns true when non-paragraph block exists', () => {
        const nodes = [
            {
                type: { name: 'bullet_list' },
                descendants: () => {},
            },
        ] as any;

        expect(isMarkdownStructuralResult(nodes)).toBe(true);
    });

    it('returns true when paragraph has marks', () => {
        const nodes = [
            {
                type: { name: 'paragraph' },
                descendants: (cb: (child: any) => unknown) => cb({ isText: true, marks: [{ type: { name: 'strong' } }] }),
            },
        ] as any;

        expect(isMarkdownStructuralResult(nodes)).toBe(true);
    });

    it('returns false for plain paragraphs without marks', () => {
        const nodes = [
            {
                type: { name: 'paragraph' },
                descendants: (cb: (child: any) => unknown) => cb({ isText: true, marks: [] }),
            },
        ] as any;

        expect(isMarkdownStructuralResult(nodes)).toBe(false);
    });
});
