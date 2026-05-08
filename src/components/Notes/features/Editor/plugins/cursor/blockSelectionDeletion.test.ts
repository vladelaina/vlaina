import { afterEach, describe, expect, it, vi } from 'vitest';
import { Editor, defaultValueCtx, editorViewCtx } from '@milkdown/kit/core';
import { TextSelection } from '@milkdown/kit/prose/state';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import type { EditorView } from '@milkdown/kit/prose/view';
import { collectSelectableBlockRanges } from './blockUnitResolver';
import { deleteSelectedBlocks } from './blockSelectionDeletion';
import { codePlugin } from '../code';
import { mathPlugin } from '../math';
import { mermaidPlugin } from '../mermaid';

async function createEditor(markdown: string) {
  const editor = Editor.make()
    .config((ctx) => {
      ctx.set(defaultValueCtx, markdown);
    })
    .use(commonmark)
    .use(gfm)
    .use(mathPlugin)
    .use(mermaidPlugin)
    .use(codePlugin);

  await editor.create();
  return editor;
}

afterEach(() => {
  document.body.innerHTML = '';
});

function replaceWithOrderedListGapAndTaskList(view: EditorView): void {
  const { schema } = view.state;
  const orderedItem = schema.nodes.list_item.create(null, [
    schema.nodes.paragraph.create(null, schema.text('1')),
  ]);
  const taskItem = schema.nodes.list_item.create({ checked: false }, [
    schema.nodes.paragraph.create(null, schema.text('1')),
  ]);

  view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size, [
    schema.nodes.ordered_list.create(null, [orderedItem]),
    schema.nodes.paragraph.create(),
    schema.nodes.bullet_list.create(null, [taskItem]),
  ]));
}

describe('deleteSelectedBlocks', () => {
  it('removes editor DOM focus after deletion', async () => {
    const editor = await createEditor('A\n\nB');
    const view = editor.ctx.get(editorViewCtx);
    const blocks = collectSelectableBlockRanges(view.state.doc);

    const focusSpy = vi.spyOn(view, 'focus');
    const blurSpy = vi.spyOn(view.dom, 'blur');
    const requestAnimationFrameSpy = vi.spyOn(window, 'requestAnimationFrame');

    expect(deleteSelectedBlocks(view, [blocks[0]], (tr) => tr)).toBe(true);
    expect(focusSpy).not.toHaveBeenCalled();
    expect(requestAnimationFrameSpy).not.toHaveBeenCalled();
    expect(blurSpy).toHaveBeenCalledTimes(1);
    expect(view.state.doc.textContent).toBe('B');

    requestAnimationFrameSpy.mockRestore();
    await editor.destroy();
  });

  it('places the cursor on the deleted line after cutting the last adjacent formula block', async () => {
    const editor = await createEditor(['$$', 'a', '$$', '', '$$', 'b', '$$', '', '$$', 'c', '$$'].join('\n'));
    const view = editor.ctx.get(editorViewCtx);
    const blocks = collectSelectableBlockRanges(view.state.doc);

    expect(blocks).toHaveLength(3);
    expect(deleteSelectedBlocks(view, [blocks[2]], (tr) => tr)).toBe(true);

    expect(view.state.doc.childCount).toBe(3);
    expect(view.state.doc.child(0).type.name).toBe('math_block');
    expect(view.state.doc.child(1).type.name).toBe('math_block');
    expect(view.state.doc.child(2).type.name).toBe('paragraph');
    expect(view.state.selection).toBeInstanceOf(TextSelection);
    expect(view.state.selection.from).toBe(view.state.doc.content.size - 1);

    await editor.destroy();
  });

  it('places the cursor on the deleted line after cutting the last adjacent diagram block', async () => {
    const editor = await createEditor([
      '```mermaid',
      'graph TD',
      'A',
      '```',
      '',
      '```mermaid',
      'graph TD',
      'B',
      '```',
      '',
      '```mermaid',
      'graph TD',
      'C',
      '```',
    ].join('\n'));
    const view = editor.ctx.get(editorViewCtx);
    const blocks = collectSelectableBlockRanges(view.state.doc);

    expect(blocks).toHaveLength(3);
    expect(deleteSelectedBlocks(view, [blocks[2]], (tr) => tr)).toBe(true);

    expect(view.state.doc.childCount).toBe(3);
    expect(view.state.doc.child(0).type.name).toBe('mermaid');
    expect(view.state.doc.child(1).type.name).toBe('mermaid');
    expect(view.state.doc.child(2).type.name).toBe('paragraph');
    expect(view.state.selection).toBeInstanceOf(TextSelection);
    expect(view.state.selection.from).toBe(view.state.doc.content.size - 1);

    await editor.destroy();
  });

  it('removes a selected ordered list item without leaving an empty paragraph', async () => {
    const editor = await createEditor(['1. 1', '2. 2', '3. 3'].join('\n'));
    const view = editor.ctx.get(editorViewCtx);
    const blocks = collectSelectableBlockRanges(view.state.doc);

    expect(blocks).toHaveLength(3);
    expect(deleteSelectedBlocks(view, [blocks[1]], (tr) => tr)).toBe(true);

    expect(view.state.doc.childCount).toBe(1);
    const list = view.state.doc.child(0);
    expect(list.type.name).toBe('ordered_list');
    expect(list.childCount).toBe(2);
    expect(list.child(0).textContent).toBe('1');
    expect(list.child(1).textContent).toBe('3');
    expect(view.state.selection).toBeInstanceOf(TextSelection);

    await editor.destroy();
  });

  it('removes a selected task list item without leaving an empty paragraph', async () => {
    const editor = await createEditor(['- [ ] 1', '- [ ] 2', '- [ ] 3'].join('\n'));
    const view = editor.ctx.get(editorViewCtx);
    const blocks = collectSelectableBlockRanges(view.state.doc);

    expect(blocks).toHaveLength(3);
    expect(deleteSelectedBlocks(view, [blocks[1]], (tr) => tr)).toBe(true);

    expect(view.state.doc.childCount).toBe(1);
    const list = view.state.doc.child(0);
    expect(list.type.name).toBe('bullet_list');
    expect(list.childCount).toBe(2);
    expect(list.child(0).type.name).toBe('list_item');
    expect(list.child(0).attrs.checked).toBe(false);
    expect(list.child(0).textContent).toBe('1');
    expect(list.child(1).attrs.checked).toBe(false);
    expect(list.child(1).textContent).toBe('3');
    expect(view.state.selection).toBeInstanceOf(TextSelection);

    await editor.destroy();
  });

  it('removes a selected empty paragraph between ordered and task lists', async () => {
    const editor = await createEditor('');
    const view = editor.ctx.get(editorViewCtx);
    replaceWithOrderedListGapAndTaskList(view);
    const blocks = collectSelectableBlockRanges(view.state.doc);

    expect(blocks).toHaveLength(3);
    expect(deleteSelectedBlocks(view, [blocks[1]], (tr) => tr)).toBe(true);

    expect(view.state.doc.childCount).toBe(2);
    expect(view.state.doc.child(0).type.name).toBe('ordered_list');
    expect(view.state.doc.child(1).type.name).toBe('bullet_list');
    expect(view.state.doc.child(0).textContent).toBe('1');
    expect(view.state.doc.child(1).textContent).toBe('1');
    expect(view.state.selection).toBeInstanceOf(TextSelection);

    await editor.destroy();
  });
});
