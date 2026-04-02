import { describe, expect, it, vi } from 'vitest';
import { moveImageNode } from './imageNodeCommands';
import { parseImageSource } from '../utils/imageSourceFragment';

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
    it('applies left alignment to the inserted image node when moving upward', () => {
        const imageAttrs = {
            src: './assets/demo.png#c=0.000000,0.000000,99.899209,99.898319,1.898247&w=72%25',
            alt: 'demo',
            title: null,
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
            state: {
                doc: initialDoc,
                tr,
            },
            dispatch: vi.fn(),
        };

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
        expect(parseImageSource(nextAttrs.src as string).align).toBe('left');
        expect(view.dispatch).toHaveBeenCalledWith(tr);
    });

    it('applies right alignment to the inserted image node when moving downward', () => {
        const imageAttrs = {
            src: './assets/demo.png#c=0.000000,0.000000,99.899209,99.898319,1.898247&w=72%25',
            alt: 'demo',
            title: null,
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
            state: {
                doc: initialDoc,
                tr,
            },
            dispatch: vi.fn(),
        };

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
        expect(parseImageSource(nextAttrs.src as string).align).toBe('right');
        expect(view.dispatch).toHaveBeenCalledWith(tr);
    });
});
