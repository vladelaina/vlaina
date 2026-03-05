import { describe, expect, it } from 'vitest';
import { isClickBelowLastBlock, resolveTailBlankClickAction } from './endBlankClickUtils';

describe('isClickBelowLastBlock', () => {
    it('returns true when click is below last block', () => {
        const editor = document.createElement('div');
        const last = document.createElement('p');
        last.getBoundingClientRect = () =>
            ({ bottom: 120 } as DOMRect);
        editor.appendChild(last);

        expect(isClickBelowLastBlock(editor, 130)).toBe(true);
    });

    it('returns false when click is not below last block', () => {
        const editor = document.createElement('div');
        const last = document.createElement('p');
        last.getBoundingClientRect = () =>
            ({ bottom: 120 } as DOMRect);
        editor.appendChild(last);

        expect(isClickBelowLastBlock(editor, 100)).toBe(false);
    });
});

describe('resolveTailBlankClickAction', () => {
    it('moves cursor into existing tail empty paragraph', () => {
        const state = {
            doc: {
                content: { size: 50 },
                lastChild: { type: { name: 'paragraph' }, content: { size: 0 } },
                type: { schema: { nodes: { paragraph: {} } } },
            },
        };

        expect(resolveTailBlankClickAction(state)).toEqual({
            insertParagraph: false,
            targetPos: 49,
            bias: -1,
        });
    });

    it('requests creating a new paragraph when tail is non-empty', () => {
        const state = {
            doc: {
                content: { size: 50 },
                lastChild: { type: { name: 'paragraph' }, content: { size: 3 } },
                type: { schema: { nodes: { paragraph: {} } } },
            },
        };

        expect(resolveTailBlankClickAction(state)).toEqual({
            insertParagraph: true,
            targetPos: 51,
            bias: 1,
        });
    });

    it('returns null when paragraph node type is unavailable', () => {
        const state = {
            doc: {
                content: { size: 50 },
                lastChild: { type: { name: 'paragraph' }, content: { size: 3 } },
                type: { schema: { nodes: {} } },
            },
        };

        expect(resolveTailBlankClickAction(state)).toBeNull();
    });
});

