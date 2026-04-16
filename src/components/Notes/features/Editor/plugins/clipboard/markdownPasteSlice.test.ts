import { Fragment } from '@milkdown/kit/prose/model';
import { describe, expect, it } from 'vitest';

import {
    createMarkdownPasteSlice,
    hasOnlyParagraphNodes,
    shouldInlineParagraphMarkdownPaste,
} from './markdownPasteSlice';

type FakeNode = {
    content: unknown;
    textContent?: string;
    type: {
        name: string;
    };
};

const createParagraphNode = (text: string): FakeNode => ({
    content: {
        childCount: 1,
        firstChild: {
            type: { name: 'text' },
            textContent: text,
        },
    },
    textContent: text,
    type: { name: 'paragraph' },
});

const createListNode = (): FakeNode => ({
    content: { childCount: 1 },
    type: { name: 'bullet_list' },
});

const createSelectionState = (sameParent = true) => {
    const parent = { isTextblock: true };
    return {
        selection: {
            $from: { parent },
            $to: { parent: sameParent ? parent : { isTextblock: true } },
        },
    };
};

describe('markdownPasteSlice', () => {
    it('detects paragraph-only markdown results', () => {
        const nodes = [createParagraphNode('bold') as any];

        expect(hasOnlyParagraphNodes(nodes)).toBe(true);
    });

    it('rejects structured markdown blocks from paragraph-only detection', () => {
        const nodes = [
            createParagraphNode('parent') as any,
            createListNode() as any,
        ] as any;

        expect(hasOnlyParagraphNodes(nodes)).toBe(false);
    });

    it('inlines a single markdown paragraph into the current textblock selection', () => {
        const paragraph = createParagraphNode('bold') as any;
        const slice = createMarkdownPasteSlice(createSelectionState(), [paragraph]);

        expect(shouldInlineParagraphMarkdownPaste(createSelectionState(), [paragraph])).toBe(true);
        expect(slice.content).toBe(paragraph.content);
    });

    it('keeps markdown paragraph blocks when the selection spans different parents', () => {
        const paragraph = createParagraphNode('bold') as any;
        const slice = createMarkdownPasteSlice(createSelectionState(false), [paragraph]);

        expect(shouldInlineParagraphMarkdownPaste(createSelectionState(false), [paragraph])).toBe(false);
        expect(slice.content.childCount).toBe(1);
        expect(slice.content.firstChild?.type.name).toBe('paragraph');
    });

    it('keeps structured markdown as block content', () => {
        const list = createListNode() as any;
        const slice = createMarkdownPasteSlice(createSelectionState(), [list]);

        expect(slice.content).toEqual(Fragment.fromArray([list]));
    });
});
