import { afterEach, describe, expect, it, vi } from 'vitest';
import { Editor, defaultValueCtx, editorViewCtx } from '@milkdown/kit/core';
import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import { TextSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import { collectSelectableBlockRanges } from './blockUnitResolver';
import { deleteSelectedBlocks } from './blockSelectionDeletion';
import { codePlugin } from '../code';
import { createTableNodeFromPipeCells } from '../table/pipeTableShortcut';
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

function replaceDocument(view: EditorView, nodes: ProseNode[]): void {
  view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size, nodes));
}

function createTableNode(view: EditorView): ProseNode {
  const table = createTableNodeFromPipeCells(view.state.schema, ['A', 'B']);
  if (!table) {
    throw new Error('Expected table schema');
  }
  return table;
}

function createCodeBlockNode(view: EditorView, text = 'const value = 1;'): ProseNode {
  const codeBlockType = view.state.schema.nodes.code_block;
  if (!codeBlockType) {
    throw new Error('Expected code block schema');
  }
  return codeBlockType.create({ language: 'ts' }, view.state.schema.text(text));
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('deleteSelectedBlocks', () => {
  it('restores text input focus after deletion', async () => {
    const editor = await createEditor('A\n\nB');
    const view = editor.ctx.get(editorViewCtx);
    const blocks = collectSelectableBlockRanges(view.state.doc);

    const focusSpy = vi.spyOn(view, 'focus');
    const blurSpy = vi.spyOn(view.dom, 'blur');
    const requestAnimationFrameSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });

    expect(deleteSelectedBlocks(view, [blocks[0]], (tr) => tr)).toBe(true);
    expect(focusSpy).toHaveBeenCalledTimes(2);
    expect(requestAnimationFrameSpy).toHaveBeenCalledTimes(1);
    expect(blurSpy).not.toHaveBeenCalled();
    expect(view.state.doc.textContent).toBe('B');

    requestAnimationFrameSpy.mockRestore();
    await editor.destroy();
  });

  it('keeps the cursor out of a following code block after block-deleting text below a table', async () => {
    const editor = await createEditor('');
    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    replaceDocument(view, [
      createTableNode(view),
      schema.nodes.paragraph.create(null, schema.text('delete me')),
      createCodeBlockNode(view),
    ]);
    const blocks = collectSelectableBlockRanges(view.state.doc);

    expect(blocks.map((block) => view.state.doc.nodeAt(block.from)?.type.name)).toEqual([
      'table',
      'paragraph',
      'code_block',
    ]);
    expect(deleteSelectedBlocks(view, [blocks[1]], (tr) => tr)).toBe(true);

    expect(view.state.doc.childCount).toBe(3);
    expect(view.state.doc.child(0).type.name).toBe('table');
    expect(view.state.doc.child(1).type.name).toBe('paragraph');
    expect(view.state.doc.child(1).textContent).toBe('');
    expect(view.state.doc.child(2).type.name).toBe('code_block');
    expect(view.state.selection).toBeInstanceOf(TextSelection);
    expect(view.state.selection.$from.parent.type.name).toBe('paragraph');

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
});
