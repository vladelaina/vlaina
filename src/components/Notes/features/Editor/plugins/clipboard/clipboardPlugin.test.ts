import { describe, expect, it, vi } from 'vitest';
import { Editor, defaultValueCtx, editorViewCtx } from '@milkdown/kit/core';
import { TextSelection } from '@milkdown/kit/prose/state';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { clipboardPlugin } from './clipboardPlugin';
import { createStandaloneTocPasteNode } from './clipboardPlugin';
import { dispatchTailBlankClickAction, endBlankClickPlugin } from '../cursor/endBlankClickPlugin';

function simulatePasteText(view: any, text: string): boolean {
    const event = {
        clipboardData: {
            getData(type: string) {
                return type === 'text/plain' ? text : '';
            },
        },
        preventDefault: vi.fn(),
    };

    let handled = false;
    view.someProp('handlePaste', (handlePaste: any) => {
        handled = handlePaste(view, event, null) || handled;
    });
    return handled;
}

function insertEmptyParagraphAfterDocumentEnd(view: any): void {
    const paragraphType = view.state.schema.nodes.paragraph;
    const tr = view.state.tr.insert(view.state.doc.content.size, paragraphType.create());
    const cursorPos = tr.doc.content.size - 1;
    view.dispatch(tr.setSelection(TextSelection.create(tr.doc, cursorPos)));
}

describe('createStandaloneTocPasteNode', () => {
    it('creates a toc node for [toc]', () => {
        const node = { type: 'toc-node' } as any;
        const create = vi.fn(() => node);

        const result = createStandaloneTocPasteNode({
            nodes: {
                toc: { create },
            },
        }, '[toc]');

        expect(create).toHaveBeenCalledWith({ maxLevel: 6 });
        expect(result).toBe(node);
    });

    it('creates a toc node for {:toc}', () => {
        const node = { type: 'toc-node' } as any;
        const create = vi.fn(() => node);

        const result = createStandaloneTocPasteNode({
            nodes: {
                toc: { create },
            },
        }, '{:toc}');

        expect(create).toHaveBeenCalledWith({ maxLevel: 6 });
        expect(result).toBe(node);
    });

    it('returns null for non-toc text', () => {
        const create = vi.fn(() => ({ type: 'toc-node' } as any));

        const result = createStandaloneTocPasteNode({
            nodes: {
                toc: { create },
            },
        }, '[to]');

        expect(result).toBeNull();
        expect(create).not.toHaveBeenCalled();
    });

    it('returns null when toc schema is unavailable', () => {
        const result = createStandaloneTocPasteNode({
            nodes: {},
        }, '[toc]');

        expect(result).toBeNull();
    });
});

describe('clipboardPlugin paste', () => {
    it('pastes inline markdown into the current empty line instead of the previous line tail', async () => {
        const editor = Editor.make()
            .config((ctx) => {
                ctx.set(defaultValueCtx, 'first');
            })
            .use(commonmark)
            .use(clipboardPlugin);

        await editor.create();
        const view = editor.ctx.get(editorViewCtx);
        insertEmptyParagraphAfterDocumentEnd(view);

        expect(simulatePasteText(view, '**bold**')).toBe(true);

        expect(view.state.doc.childCount).toBe(2);
        expect(view.state.doc.child(0).textContent).toBe('first');
        expect(view.state.doc.child(1).textContent).toBe('bold');

        await editor.destroy();
    });

    it('preserves intentional blank lines inside structural markdown paste', async () => {
        const editor = Editor.make()
            .config((ctx) => {
                ctx.set(defaultValueCtx, '');
            })
            .use(commonmark)
            .use(clipboardPlugin);

        await editor.create();
        const view = editor.ctx.get(editorViewCtx);

        expect(simulatePasteText(view, '# A\n\n\n# B')).toBe(true);

        expect(view.state.doc.childCount).toBe(3);
        expect(view.state.doc.child(0).textContent).toBe('A');
        expect(view.state.doc.child(1).textContent).toBe('\u200B\n\u200B');
        expect(view.state.doc.child(2).textContent).toBe('B');

        await editor.destroy();
    });

    it('replaces a temporary tail empty line with structural markdown paste', async () => {
        const editor = Editor.make()
            .config((ctx) => {
                ctx.set(defaultValueCtx, 'first');
            })
            .use(commonmark)
            .use(clipboardPlugin)
            .use(endBlankClickPlugin);

        await editor.create();
        const view = editor.ctx.get(editorViewCtx);

        expect(dispatchTailBlankClickAction(view)).toBe(true);
        expect(simulatePasteText(view, '- item')).toBe(true);

        expect(view.state.doc.childCount).toBe(2);
        expect(view.state.doc.child(0).textContent).toBe('first');
        expect(view.state.doc.child(1).type.name).toBe('bullet_list');
        expect(view.state.doc.child(1).textContent).toBe('item');

        await editor.destroy();
    });
});
