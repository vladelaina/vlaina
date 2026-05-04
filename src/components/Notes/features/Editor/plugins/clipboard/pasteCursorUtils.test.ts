import { describe, expect, it } from 'vitest';
import { Fragment, Slice } from '@milkdown/kit/prose/model';
import { findTailCursorPosInRange, isMarkdownStructuralResult, resolvePasteRange } from './pasteCursorUtils';

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

describe('resolvePasteRange', () => {
    const createParagraph = (size: number) => ({
        type: { name: 'paragraph' },
        content: { size },
        nodeSize: size + 2,
    });

    const createText = () => ({
        isInline: true,
        isText: true,
        type: { name: 'text' },
    });

    const createHeading = () => ({
        isInline: false,
        isText: false,
        type: { name: 'heading' },
    });

    const createSlice = (nodes: any[]) => new Slice(Fragment.fromArray(nodes), 0, 0);

    it('moves inline paste at an empty paragraph boundary inside that paragraph', () => {
        const slice = createSlice([createText()]);
        const state = {
            selection: { from: 7, to: 7 },
            doc: {
                nodeAt: (pos: number) => (pos === 7 ? createParagraph(0) : null),
            },
        };

        expect(resolvePasteRange(state as any, slice)).toEqual({ from: 8, to: 8 });
    });

    it('replaces an empty paragraph boundary for block paste', () => {
        const slice = createSlice([createHeading()]);
        const state = {
            selection: { from: 7, to: 7 },
            doc: {
                nodeAt: (pos: number) => (pos === 7 ? createParagraph(0) : null),
            },
        };

        expect(resolvePasteRange(state as any, slice)).toEqual({ from: 7, to: 9 });
    });

    it('keeps ordinary selection ranges unchanged', () => {
        const slice = createSlice([createText()]);
        const state = {
            selection: { from: 2, to: 5 },
            doc: {
                nodeAt: () => createParagraph(0),
            },
        };

        expect(resolvePasteRange(state as any, slice)).toEqual({ from: 2, to: 5 });
    });
});
