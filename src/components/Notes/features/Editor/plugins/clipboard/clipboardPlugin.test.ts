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

    it('keeps a pasted ordered list separate after an inline-code paragraph', async () => {
        const editor = Editor.make()
            .config((ctx) => {
                ctx.set(defaultValueCtx, '');
            })
            .use(commonmark)
            .use(gfm)
            .use(clipboardPlugin);

        await editor.create();
        const view = editor.ctx.get(editorViewCtx);

        expect(simulatePasteText(view, [
            '`mindmap支持是否完整`',
            '3. 表格看看是否需要调整大小',
            '4. ',
            '5. 斜杠工具栏',
            '6. 文件的拖入star',
        ].join('\n'))).toBe(true);

        expect(view.state.doc.childCount).toBe(2);
        expect(view.state.doc.child(0).type.name).toBe('paragraph');
        expect(view.state.doc.child(0).textContent).toBe('mindmap支持是否完整');

        const list = view.state.doc.child(1);
        expect(list.type.name).toBe('ordered_list');
        expect(list.attrs).toMatchObject({ order: 3 });
        expect(list.childCount).toBe(4);
        expect(list.child(0).textContent).toBe('表格看看是否需要调整大小');
        expect(list.child(1).textContent).toBe('');
        expect(list.child(2).textContent).toBe('斜杠工具栏');
        expect(list.child(3).textContent).toBe('文件的拖入star');

        await editor.destroy();
    });

    it('keeps the ordered-list tail separate in a realistic pasted Chinese task note', async () => {
        const editor = Editor.make()
            .config((ctx) => {
                ctx.set(defaultValueCtx, '');
            })
            .use(commonmark)
            .use(gfm)
            .use(clipboardPlugin);

        await editor.create();
        const view = editor.ctx.get(editorViewCtx);

        expect(simulatePasteText(view, [
            '# 3',
            '',
            '1输入不要固定的高度，',
            '',
            ' 测试yt那些',
            '',
            '1. 输入反斜杠东西出来的有点慢',
            '',
            '1. 右键单击图表，将其另存为本地磁盘上的 SVG、PNG 或 JPG 文件。',
            '2. 不同的主题',
            '',
            '1. 表格的渲染太慢了，打开的时候可以看到loadign',
            '2. 检查对',
            '',
            '`mindmap支持是否完整`',
            '3. 表格看看是否需要调整大小',
            '4. ',
            '5. 斜杠工具栏',
            '6. 文件的拖入star',
            '7. todo之后就是会换行',
            '8. 从外部拖动文件进来，就是变成和我们一样的拖动文件的样式',
            '9. 给所有的换图标',
            '10. 这个md的解析和使用直接诶是乱套了',
            '11. 这个merger表格根本用不了',
            '    1. 在他下面弄个反斜杠直接消失了',
            '12. 自动生成的目录部分的高度需要调整',
            '13. 角注需要处理',
            '14. 链接到其他文件',
            '15. 少了直接创建mermed',
            '16. html语法的支持情况',
            '17. 那个图表的话就是记得有主题的lobchat有',
            '18. 在两个公式或图标中怎么插入空行',
            '    1. 然后箭头的移动应该选中',
        ].join('\n'))).toBe(true);

        let mindmapIndex = -1;
        for (let index = 0; index < view.state.doc.childCount; index += 1) {
            if (view.state.doc.child(index).textContent === 'mindmap支持是否完整') {
                mindmapIndex = index;
                break;
            }
        }

        expect(mindmapIndex).toBeGreaterThanOrEqual(0);
        expect(view.state.doc.child(mindmapIndex).type.name).toBe('paragraph');

        const list = view.state.doc.child(mindmapIndex + 1);
        expect(list.type.name).toBe('ordered_list');
        expect(list.attrs).toMatchObject({ order: 3 });
        expect(list.childCount).toBe(16);
        expect(list.textContent).toContain('表格看看是否需要调整大小');
        expect(list.textContent).toContain('然后箭头的移动应该选中');
        expect(list.child(8).textContent).toContain('在他下面弄个反斜杠直接消失了');
        expect(list.child(9).textContent).toBe('自动生成的目录部分的高度需要调整');

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
