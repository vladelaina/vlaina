import { describe, expect, it, vi } from 'vitest';
import { applyImageNodeAttrsAtPos, deleteImageNodeAtPos, moveImageNode } from './imageNodeCommands';

function createDoc(nodes: Record<number, any>) {
    return {
        content: { size: 200 },
        nodeAt: vi.fn((pos: number) => nodes[pos] ?? null),
        nodesBetween: vi.fn((from: number, to: number, callback: (node: any, pos: number) => boolean | void) => {
            const entries = Object.entries(nodes)
                .map(([pos, node]) => [Number(pos), node] as const)
                .filter(([pos]) => pos >= from && pos <= to)
                .sort((a, b) => a[0] - b[0]);

            for (const [pos, node] of entries) {
                if (callback(node, pos) === false) break;
            }
        }),
        slice: vi.fn((from: number) => ({
            content: {
                firstChild: nodes[from] ?? null,
            },
        })),
    };
}

function createImageNode(attrs: Record<string, unknown>) {
    return {
        type: { name: 'image' },
        attrs,
        nodeSize: 1,
    };
}

function createParagraphNode() {
    return {
        type: { name: 'paragraph' },
        attrs: {},
        nodeSize: 3,
    };
}

describe('imageNodeCommands', () => {
    it('marks image attr updates as user input so autosave can persist them', () => {
        const imageNode = createImageNode({ src: './assets/demo.png', alt: 'demo' });
        const doc = createDoc({ 12: imageNode });
        const tr: any = {
            setNodeMarkup: vi.fn(() => tr),
        };
        const view: any = {
            dom: new EventTarget(),
            state: { doc, tr },
            dispatch: vi.fn(),
        };
        const listener = vi.fn();
        view.dom.addEventListener('editor:image-user-input', listener);

        const updated = applyImageNodeAttrsAtPos(view, 12, { width: '70%' });

        expect(updated).toBe(true);
        expect(listener).toHaveBeenCalledTimes(1);
        expect(tr.setNodeMarkup).toHaveBeenCalledWith(
            12,
            undefined,
            expect.objectContaining({ width: '70%' }),
        );
        expect(view.dispatch).toHaveBeenCalledWith(tr);
    });

    it('does not update image attrs when the node no longer matches the expected source', () => {
        const imageNode = createImageNode({ src: './assets/other.png', alt: 'other' });
        const doc = createDoc({ 12: imageNode });
        const tr: any = {
            setNodeMarkup: vi.fn(() => tr),
        };
        const view: any = {
            dom: new EventTarget(),
            state: { doc, tr },
            dispatch: vi.fn(),
        };
        const listener = vi.fn();
        view.dom.addEventListener('editor:image-user-input', listener);

        const updated = applyImageNodeAttrsAtPos(
            view,
            12,
            { width: '70%' },
            { src: './assets/demo.png' },
        );

        expect(updated).toBe(false);
        expect(listener).not.toHaveBeenCalled();
        expect(tr.setNodeMarkup).not.toHaveBeenCalled();
        expect(view.dispatch).not.toHaveBeenCalled();
    });

    it('applies left alignment to the inserted image node when moving upward', () => {
        const imageAttrs = {
            src: './assets/demo.png',
            alt: 'demo',
            title: null,
            width: '72%',
            crop: { x: 0, y: 0, width: 99.899209, height: 99.898319, ratio: 1.898247 },
        };
        const initialDoc = createDoc({
            51: createImageNode(imageAttrs),
        });
        const insertedDoc = createDoc({
            48: createParagraphNode(),
            49: createImageNode(imageAttrs),
        });
        const tr: any = {
            doc: initialDoc,
            mapping: {
                map: vi.fn((pos: number) => pos),
            },
            setMeta: vi.fn(() => {
                return tr;
            }),
            insert: vi.fn(() => {
                tr.doc = insertedDoc;
                return tr;
            }),
            setNodeMarkup: vi.fn(() => {
                return tr;
            }),
            delete: vi.fn(() => {
                return tr;
            }),
        };
        const view: any = {
            dom: new EventTarget(),
            state: {
                doc: initialDoc,
                tr,
            },
            dispatch: vi.fn(),
        };
        const listener = vi.fn();
        view.dom.addEventListener('editor:image-user-input', listener);

        const moved = moveImageNode(view, {
            sourcePos: 51,
            targetPos: 48,
            alignment: 'left',
        });

        expect(moved).toBe(true);
        expect(tr.setNodeMarkup).toHaveBeenCalledWith(
            49,
            undefined,
            expect.objectContaining({
                src: expect.any(String),
            }),
        );

        const nextAttrs = tr.setNodeMarkup.mock.calls[0][2];
        expect(nextAttrs.src).toBe('./assets/demo.png');
        expect(nextAttrs.align).toBe('left');
        expect(nextAttrs.width).toBe('72%');
        expect(listener).toHaveBeenCalledTimes(1);
        expect(view.dispatch).toHaveBeenCalledWith(tr);
    });

    it('applies right alignment to the inserted image node when moving downward', () => {
        const imageAttrs = {
            src: './assets/demo.png',
            alt: 'demo',
            title: null,
            width: '72%',
            crop: { x: 0, y: 0, width: 99.899209, height: 99.898319, ratio: 1.898247 },
        };
        const initialDoc = createDoc({
            49: createImageNode(imageAttrs),
        });
        const insertedDoc = createDoc({
            44: createParagraphNode(),
            45: createImageNode(imageAttrs),
        });
        const tr: any = {
            doc: initialDoc,
            mapping: {
                map: vi.fn((pos: number) => (pos === 44 ? 44 : pos)),
            },
            setMeta: vi.fn(() => {
                return tr;
            }),
            delete: vi.fn(() => {
                return tr;
            }),
            insert: vi.fn(() => {
                tr.doc = insertedDoc;
                return tr;
            }),
            setNodeMarkup: vi.fn(() => {
                return tr;
            }),
        };
        const view: any = {
            dom: new EventTarget(),
            state: {
                doc: initialDoc,
                tr,
            },
            dispatch: vi.fn(),
        };
        const listener = vi.fn();
        view.dom.addEventListener('editor:image-user-input', listener);

        const moved = moveImageNode(view, {
            sourcePos: 49,
            targetPos: 44,
            alignment: 'right',
        });

        expect(moved).toBe(true);
        expect(tr.setNodeMarkup).toHaveBeenCalledWith(
            45,
            undefined,
            expect.objectContaining({
                src: expect.any(String),
            }),
        );

        const nextAttrs = tr.setNodeMarkup.mock.calls[0][2];
        expect(nextAttrs.src).toBe('./assets/demo.png');
        expect(nextAttrs.align).toBe('right');
        expect(nextAttrs.width).toBe('72%');
        expect(listener).toHaveBeenCalledTimes(1);
        expect(view.dispatch).toHaveBeenCalledWith(tr);
    });

    it('marks image deletion as user input so autosave can persist it', () => {
        const imageNode = createImageNode({ src: './assets/demo.png', alt: 'demo' });
        const doc = createDoc({ 20: imageNode });
        const tr: any = {
            delete: vi.fn(() => tr),
        };
        const view: any = {
            dom: new EventTarget(),
            state: { doc, tr },
            dispatch: vi.fn(),
        };
        const listener = vi.fn();
        view.dom.addEventListener('editor:image-user-input', listener);

        const deleted = deleteImageNodeAtPos(view, 20);

        expect(deleted).toBe(true);
        expect(listener).toHaveBeenCalledTimes(1);
        expect(tr.delete).toHaveBeenCalledWith(20, 21);
        expect(view.dispatch).toHaveBeenCalledWith(tr);
    });
});
