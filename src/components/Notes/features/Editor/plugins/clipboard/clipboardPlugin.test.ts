import { describe, expect, it, vi } from 'vitest';
import { Editor, defaultValueCtx, editorViewCtx, remarkStringifyOptionsCtx } from '@milkdown/kit/core';
import { TextSelection } from '@milkdown/kit/prose/state';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import { clipboardPlugin } from './clipboardPlugin';
import { createStandaloneTocPasteNode } from './clipboardPlugin';
import { dispatchTailBlankClickAction, endBlankClickPlugin } from '../cursor/endBlankClickPlugin';
import { mermaidPlugin } from '../mermaid';
import { mathPlugin } from '../math';
import { codePlugin } from '../code';
import { notesRemarkStringifyOptions } from '../../config/stringifyOptions';

function findTextRange(doc: any, text: string): { from: number; to: number } {
    let resolved: { from: number; to: number } | null = null;

    doc.descendants((node: any, pos: number) => {
        if (resolved) return false;
        if (!node.isText || node.text !== text) return;

        resolved = {
            from: pos,
            to: pos + text.length,
        };
        return false;
    });

    if (!resolved) {
        throw new Error(`Unable to resolve text range for "${text}"`);
    }

    return resolved;
}

function simulateCopyKeydown(view: any): { handled: boolean; event: KeyboardEvent } {
    const event = new KeyboardEvent('keydown', {
        key: 'c',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
    });

    let handled = false;
    view.someProp('handleKeyDown', (handleKeyDown: any) => {
        handled = handleKeyDown(view, event) || handled;
    });

    return { handled, event };
}

function simulateCopyEvent(view: any) {
    const clipboardData = {
        setData: vi.fn(),
    };
    const event = {
        clipboardData,
        preventDefault: vi.fn(),
    };

    let handled = false;
    view.someProp('handleDOMEvents', (handleDOMEvents: any) => {
        handled = handleDOMEvents.copy?.(view, event) || handled;
    });

    return { handled, event, clipboardData };
}

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

describe('clipboardPlugin copy', () => {
    it('lets Ctrl+C reach the native copy event', async () => {
        const editor = Editor.make()
            .config((ctx) => {
                ctx.set(defaultValueCtx, '- first bullet\n- second bullet');
                ctx.update(remarkStringifyOptionsCtx, (prev) => ({
                    ...prev,
                    ...notesRemarkStringifyOptions,
                }));
            })
            .use(commonmark)
            .use(gfm)
            .use(clipboardPlugin);

        await editor.create();
        const view = editor.ctx.get(editorViewCtx);
        const firstRange = findTextRange(view.state.doc, 'first bullet');
        const secondRange = findTextRange(view.state.doc, 'second bullet');
        view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, firstRange.from, secondRange.to)));

        const { handled, event } = simulateCopyKeydown(view);

        expect(handled).toBe(false);
        expect(event.defaultPrevented).toBe(false);

        await editor.destroy();
    });

    it('copies two selected list lines in the copy event', async () => {
        const editor = Editor.make()
            .config((ctx) => {
                ctx.set(defaultValueCtx, '- first bullet\n- second bullet');
                ctx.update(remarkStringifyOptionsCtx, (prev) => ({
                    ...prev,
                    ...notesRemarkStringifyOptions,
                }));
            })
            .use(commonmark)
            .use(gfm)
            .use(clipboardPlugin);

        await editor.create();
        const view = editor.ctx.get(editorViewCtx);
        const firstRange = findTextRange(view.state.doc, 'first bullet');
        const secondRange = findTextRange(view.state.doc, 'second bullet');
        view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, firstRange.from, secondRange.to)));

        const { handled, event, clipboardData } = simulateCopyEvent(view);

        expect(handled).toBe(true);
        expect(event.preventDefault).toHaveBeenCalled();
        expect(clipboardData.setData).toHaveBeenCalledWith('text/plain', '- first bullet\n- second bullet');

        await editor.destroy();
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

    it('recognizes pasted markdown tables as table blocks', async () => {
        const editor = Editor.make()
            .config((ctx) => {
                ctx.set(defaultValueCtx, '');
            })
            .use(commonmark)
            .use(gfm)
            .use(clipboardPlugin);

        await editor.create();
        const view = editor.ctx.get(editorViewCtx);

        expect(simulatePasteText(view, ['| A | B |', '| --- | --- |', '| 1 | 2 |'].join('\n'))).toBe(true);

        const table = view.state.doc.firstChild;
        expect(table?.type.name).toBe('table');
        expect(table?.childCount).toBe(2);
        expect(table?.firstChild?.firstChild?.textContent).toBe('A');
        expect(table?.child(1).child(1).textContent).toBe('2');

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

    it('recognizes pasted inline math markdown as an inline formula', async () => {
        const editor = Editor.make()
            .config((ctx) => {
                ctx.set(defaultValueCtx, '');
            })
            .use(commonmark)
            .use(clipboardPlugin)
            .use(mathPlugin);

        await editor.create();
        const view = editor.ctx.get(editorViewCtx);

        expect(simulatePasteText(view, '$x^2$')).toBe(true);

        const paragraph = view.state.doc.firstChild;
        expect(paragraph?.type.name).toBe('paragraph');
        expect(paragraph?.firstChild?.type.name).toBe('math_inline');
        expect(paragraph?.firstChild?.attrs.latex).toBe('x^2');

        await editor.destroy();
    });

    it('recognizes pasted display math markdown as a formula block', async () => {
        const editor = Editor.make()
            .config((ctx) => {
                ctx.set(defaultValueCtx, '');
            })
            .use(commonmark)
            .use(clipboardPlugin)
            .use(mathPlugin);

        await editor.create();
        const view = editor.ctx.get(editorViewCtx);

        expect(simulatePasteText(view, '$$\ndfsdf\n$$')).toBe(true);

        const formula = view.state.doc.firstChild;
        expect(formula?.type.name).toBe('math_block');
        expect(formula?.attrs.latex).toBe('dfsdf');

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

    it('recognizes pasted fenced code as a code block', async () => {
        const editor = Editor.make()
            .config((ctx) => {
                ctx.set(defaultValueCtx, '');
            })
            .use(commonmark)
            .use(clipboardPlugin)
            .use(codePlugin);

        await editor.create();
        const view = editor.ctx.get(editorViewCtx);

        expect(simulatePasteText(view, ['```ts', 'const value = 1;', '```'].join('\n'))).toBe(true);

        const code = view.state.doc.firstChild;
        expect(code?.type.name).toBe('code_block');
        expect(code?.attrs.language).toBe('ts');
        expect(code?.textContent).toBe('const value = 1;');

        await editor.destroy();
    });

    it('recognizes pasted markdown fences as editable markdown content', async () => {
        const editor = Editor.make()
            .config((ctx) => {
                ctx.set(defaultValueCtx, '');
            })
            .use(commonmark)
            .use(clipboardPlugin);

        await editor.create();
        const view = editor.ctx.get(editorViewCtx);

        expect(simulatePasteText(view, ['```md', '# Title', '- item', '```'].join('\n'))).toBe(true);

        expect(view.state.doc.childCount).toBe(2);
        expect(view.state.doc.child(0).type.name).toBe('heading');
        expect(view.state.doc.child(0).textContent).toBe('Title');
        expect(view.state.doc.child(1).type.name).toBe('bullet_list');
        expect(view.state.doc.child(1).textContent).toBe('item');

        await editor.destroy();
    });

    it('leaves plain text paste to the browser default path', async () => {
        const editor = Editor.make()
            .config((ctx) => {
                ctx.set(defaultValueCtx, '');
            })
            .use(commonmark)
            .use(clipboardPlugin);

        await editor.create();
        const view = editor.ctx.get(editorViewCtx);

        expect(simulatePasteText(view, 'hello world')).toBe(false);

        await editor.destroy();
    });

    it.each([
        ['flow', 'flowchart TD'],
        ['flowchart-v2', 'flowchart TD'],
    ])('normalizes pasted %s alias fences that omit the Mermaid directive', async (language, directive) => {
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
            `\`\`\`${language}`,
            'A --> B',
            '```',
        ].join('\n'))).toBe(true);

        const mermaid = view.state.doc.firstChild;
        expect(mermaid?.type.name).toBe('mermaid');
        expect(mermaid?.attrs.code).toBe([
            directive,
            'A --> B',
        ].join('\n'));

        await editor.destroy();
    });
});
