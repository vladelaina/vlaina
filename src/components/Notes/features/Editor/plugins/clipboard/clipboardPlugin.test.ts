import { describe, expect, it, vi } from 'vitest';
import { Editor, defaultValueCtx, editorViewCtx } from '@milkdown/kit/core';
import { TextSelection } from '@milkdown/kit/prose/state';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import { clipboardPlugin } from './clipboardPlugin';
import { createStandaloneTocPasteNode } from './clipboardPlugin';
import { dispatchTailBlankClickAction, endBlankClickPlugin } from '../cursor/endBlankClickPlugin';
import { mermaidPlugin } from '../mermaid';

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
        expect(view.state.doc.child(1).textContent).toBe('');
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

    it('recognizes spreadsheet tab separated paste as a table', async () => {
        const editor = Editor.make()
            .config((ctx) => {
                ctx.set(defaultValueCtx, '');
            })
            .use(commonmark)
            .use(gfm)
            .use(clipboardPlugin);

        await editor.create();
        const view = editor.ctx.get(editorViewCtx);

        expect(simulatePasteText(view, 'Name\tScore\nAda\t10\nLinus\t9')).toBe(true);

        const table = view.state.doc.firstChild;
        expect(table?.type.name).toBe('table');
        expect(table?.childCount).toBe(3);
        expect(table?.firstChild?.childCount).toBe(2);
        expect(table?.firstChild?.firstChild?.textContent).toBe('Name');
        expect(table?.firstChild?.child(1).textContent).toBe('Score');
        expect(table?.child(1).firstChild?.textContent).toBe('Ada');
        expect(table?.child(1).child(1).textContent).toBe('10');

        await editor.destroy();
    });

    it('recognizes standalone mermaid alias fences before falling back to code block paste', async () => {
        const editor = Editor.make()
            .config((ctx) => {
                ctx.set(defaultValueCtx, '');
            })
            .use(commonmark)
            .use(clipboardPlugin)
            .use(mermaidPlugin);

        await editor.create();
        const view = editor.ctx.get(editorViewCtx);

        expect(simulatePasteText(view, [
            '```sequence',
            'Alice->Bob: Hello Bob, how are you?',
            'Note right of Bob: Bob thinks',
            'Bob-->Alice: I am good thanks!',
            '```',
        ].join('\n'))).toBe(true);

        const mermaid = view.state.doc.firstChild;
        expect(mermaid?.type.name).toBe('mermaid');
        expect(mermaid?.attrs.code).toBe([
            'sequenceDiagram',
            'Alice->Bob: Hello Bob, how are you?',
            'Note right of Bob: Bob thinks',
            'Bob-->Alice: I am good thanks!',
        ].join('\n'));

        await editor.destroy();
    });
});
