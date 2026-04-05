import { describe, expect, it, vi } from 'vitest';
import {
    buildImageNodeAttrs,
    canInsertImageNodeAtSelection,
    insertImageNodeAtSelection,
} from './imageNodeInsertion';

describe('imageNodeInsertion', () => {
    it('builds stable image attrs from the uploaded path', () => {
        expect(buildImageNodeAttrs('./assets/demo-image.png')).toEqual({
            src: './assets/demo-image.png',
            alt: 'demo-image',
            align: 'center',
            width: null,
        });
    });

    it('detects when the current selection can accept an image node', () => {
        const replaceSelectionWith = vi.fn(function () {
            return { docChanged: true };
        });
        const create = vi.fn(() => ({ type: 'image-node' }));
        const view = {
            state: {
                schema: { nodes: { image: { create } } },
                tr: { replaceSelectionWith },
            },
        };

        expect(canInsertImageNodeAtSelection(view as never)).toBe(true);
        expect(create).toHaveBeenCalledWith({
            src: './image.png',
            alt: 'image',
            align: 'center',
            width: null,
        });
    });

    it('returns false when the current selection cannot accept an image node', () => {
        const replaceSelectionWith = vi.fn(() => {
            throw new Error('cannot insert');
        });
        const create = vi.fn(() => ({ type: 'image-node' }));
        const view = {
            state: {
                schema: { nodes: { image: { create } } },
                tr: { replaceSelectionWith },
            },
        };

        expect(canInsertImageNodeAtSelection(view as never)).toBe(false);
    });

    it('replaces the current selection with an image node', () => {
        const scrollIntoView = vi.fn(function () {
            return tr;
        });
        const replaceSelectionWith = vi.fn(function () {
            return { scrollIntoView };
        });
        const tr = { replaceSelectionWith };
        const dispatch = vi.fn();
        const imageNode = { type: 'image-node' };
        const create = vi.fn(() => imageNode);
        const view = {
            state: {
                schema: { nodes: { image: { create } } },
                tr,
            },
            dispatch,
        };

        expect(insertImageNodeAtSelection(view as never, './assets/demo-image.png')).toBe(true);
        expect(create).toHaveBeenCalledWith({
            src: './assets/demo-image.png',
            alt: 'demo-image',
            align: 'center',
            width: null,
        });
        expect(replaceSelectionWith).toHaveBeenCalledWith(imageNode);
        expect(scrollIntoView).toHaveBeenCalled();
        expect(dispatch).toHaveBeenCalledWith(tr);
    });
});
