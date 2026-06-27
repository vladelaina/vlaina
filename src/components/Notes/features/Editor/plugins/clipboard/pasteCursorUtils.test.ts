import { describe, expect, it } from 'vitest';
import { Fragment, Slice } from '@milkdown/kit/prose/model';
import {
    MAX_MARKDOWN_STRUCTURAL_RESULT_SCAN_NODES,
    MAX_PASTE_CURSOR_TAIL_SCAN_NODES,
    findTailCursorPosInRange,
    isMarkdownStructuralResult,
    resolvePasteRange,
} from './pasteCursorUtils';

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

    it('caps real document tail scans by node count', () => {
        let accessed = 0;
        const nodes = Array.from({ length: MAX_PASTE_CURSOR_TAIL_SCAN_NODES + 1 }, (_, index) => ({
            isTextblock: true,
            content: { size: 1 },
            nodeSize: 3,
            index,
        }));
        const doc = {
            childCount: nodes.length,
            content: { size: nodes.length * 3 },
            child(index: number) {
                accessed += 1;
                return nodes[index];
            },
            nodesBetween() {
                throw new Error('nodesBetween should not be used for real document scans');
            },
        };

        expect(findTailCursorPosInRange(doc as any, 0, doc.content.size)).toBe(
            (MAX_PASTE_CURSOR_TAIL_SCAN_NODES - 1) * 3 + 2,
        );
        expect(accessed).toBe(MAX_PASTE_CURSOR_TAIL_SCAN_NODES);
    });

    it('stops fallback tail scans by node count', () => {
        let accessed = 0;
        const doc = {
            content: { size: (MAX_PASTE_CURSOR_TAIL_SCAN_NODES + 2) * 3 },
            nodesBetween(_from: number, _to: number, callback: (node: FakeNode, pos: number) => boolean | void) {
                for (let index = 0; index < MAX_PASTE_CURSOR_TAIL_SCAN_NODES + 2; index += 1) {
                    accessed += 1;
                    const shouldContinue = callback(
                        { isTextblock: true, content: { size: 1 } },
                        index * 3,
                    );
                    if (shouldContinue === false) break;
                }
            },
        };

        expect(findTailCursorPosInRange(doc as any, 0, doc.content.size)).toBe(
            (MAX_PASTE_CURSOR_TAIL_SCAN_NODES - 1) * 3 + 2,
        );
        expect(accessed).toBe(MAX_PASTE_CURSOR_TAIL_SCAN_NODES + 1);
    });
});

describe('isMarkdownStructuralResult', () => {
    const createParagraph = (children: any[]) => ({
        child: (index: number) => children[index],
        childCount: children.length,
        content: {
            size: children.reduce((size, child) => size + (child.nodeSize ?? 1), 0),
        },
        nodeSize: children.reduce((size, child) => size + (child.nodeSize ?? 1), 2),
        type: { name: 'paragraph' },
    });

    const createText = (marks: any[] = []) => ({
        isText: true,
        marks,
        nodeSize: 1,
        text: 'x',
        type: { name: 'text' },
    });

    it('returns true when non-paragraph block exists', () => {
        const nodes = [
            {
                type: { name: 'bullet_list' },
            },
        ] as any;

        expect(isMarkdownStructuralResult(nodes)).toBe(true);
    });

    it('returns true when paragraph has marks', () => {
        const nodes = [
            createParagraph([createText([{ type: { name: 'strong' } }])]),
        ] as any;

        expect(isMarkdownStructuralResult(nodes)).toBe(true);
    });

    it('returns true when paragraph has inline atomic nodes', () => {
        const nodes = [
            createParagraph([{ isText: false, nodeSize: 1, type: { name: 'math_inline' } }]),
        ] as any;

        expect(isMarkdownStructuralResult(nodes)).toBe(true);
    });

    it('returns false for plain paragraphs without marks', () => {
        const nodes = [
            createParagraph([createText()]),
        ] as any;

        expect(isMarkdownStructuralResult(nodes)).toBe(false);
    });

    it('stops scanning a paragraph after the first structural child', () => {
        let accessed = 0;
        const children = [
            { isText: false, nodeSize: 1, type: { name: 'math_inline' } },
            createText(),
        ];
        const paragraph = {
            ...createParagraph(children),
            child(index: number) {
                accessed += 1;
                return children[index];
            },
        };

        expect(isMarkdownStructuralResult([paragraph as any])).toBe(true);
        expect(accessed).toBe(1);
    });

    it('caps plain paragraph structural scans by node count', () => {
        let accessed = 0;
        const children = [
            ...Array.from({ length: MAX_MARKDOWN_STRUCTURAL_RESULT_SCAN_NODES }, () => createText()),
            { isText: false, nodeSize: 1, type: { name: 'math_inline' } },
        ];
        const paragraph = {
            ...createParagraph(children),
            child(index: number) {
                accessed += 1;
                return children[index];
            },
        };

        expect(isMarkdownStructuralResult([paragraph as any])).toBe(false);
        expect(accessed).toBe(MAX_MARKDOWN_STRUCTURAL_RESULT_SCAN_NODES);
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

    it('replaces all placeholder paragraphs when a block paste fills an empty document', () => {
        const slice = createSlice([createHeading()]);
        const paragraphs = [createParagraph(0), createParagraph(0)];
        const state = {
            selection: { from: 3, to: 3 },
            doc: {
                child: (index: number) => paragraphs[index],
                childCount: paragraphs.length,
                content: { size: 4 },
                nodeAt: () => null,
            },
        };

        expect(resolvePasteRange(state as any, slice)).toEqual({ from: 0, to: 4 });
    });

    it('replaces the active empty paragraph when the cursor is inside it', () => {
        const slice = createSlice([createHeading()]);
        const paragraph = createParagraph(0);
        const state = {
            selection: {
                $from: {
                    after: () => 9,
                    before: () => 7,
                    depth: 1,
                    parent: paragraph,
                },
                from: 8,
                to: 8,
            },
            doc: {
                child: () => createParagraph(5),
                childCount: 1,
                content: { size: 7 },
                nodeAt: () => null,
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
