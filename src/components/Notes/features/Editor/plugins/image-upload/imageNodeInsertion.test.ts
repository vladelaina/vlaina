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

    it('builds alt text from the image filename without URL metadata', () => {
        expect(buildImageNodeAttrs('.\\assets\\demo-image.png?cache=1#preview')).toEqual({
            src: '.\\assets\\demo-image.png?cache=1#preview',
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
            dom: { dispatchEvent: vi.fn() },
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
        expect(view.dom.dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({
            type: 'editor:image-user-input',
        }));
        expect(dispatch).toHaveBeenCalledWith(tr);
    });

    it('restores a saved selection and inserts the image in one transaction', () => {
        const savedSelection = { type: 'saved-selection' };
        const scrollIntoView = vi.fn(function () {
            return tr;
        });
        const replaceSelectionWith = vi.fn(function () {
            return tr;
        });
        const setSelection = vi.fn(function () {
            return tr;
        });
        const tr = { replaceSelectionWith, scrollIntoView, setSelection };
        const dispatch = vi.fn();
        const imageNode = { type: 'image-node' };
        const view = {
            dom: { dispatchEvent: vi.fn() },
            state: {
                schema: { nodes: { image: { create: vi.fn(() => imageNode) } } },
                tr,
            },
            dispatch,
        };

        expect(insertImageNodeAtSelection(
            view as never,
            './assets/demo-image.png',
            savedSelection as never,
        )).toBe(true);
        expect(setSelection).toHaveBeenCalledWith(savedSelection);
        expect(setSelection.mock.invocationCallOrder[0]).toBeLessThan(
            replaceSelectionWith.mock.invocationCallOrder[0],
        );
        expect(dispatch).toHaveBeenCalledTimes(1);
        expect(dispatch).toHaveBeenCalledWith(tr);
    });
});
