import { afterEach, describe, expect, it, vi } from 'vitest';
import { Editor, defaultValueCtx, editorViewCtx } from '@milkdown/kit/core';
import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import { NodeSelection, TextSelection } from '@milkdown/kit/prose/state';
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

function createPreviewBlockNode(view: EditorView, typeName: 'math_block' | 'mermaid' | 'table'): ProseNode {
  if (typeName === 'table') {
    return createTableNode(view);
  }

  const nodeType = view.state.schema.nodes[typeName];
  if (!nodeType) {
    throw new Error(`Expected ${typeName} schema`);
  }

  return typeName === 'math_block'
    ? nodeType.create({ latex: 'x^2' })
    : nodeType.create({ code: 'graph TD\nA --> B' });
}

function findBlockByText(view: EditorView, text: string) {
  const blocks = collectSelectableBlockRanges(view.state.doc);
  return blocks.find((range) => view.state.doc.resolve(range.from).nodeAfter?.textContent === text);
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
  it('focuses the editor after deletion', async () => {
    const editor = await createEditor('A\n\nB');
    const view = editor.ctx.get(editorViewCtx);
    const blocks = collectSelectableBlockRanges(view.state.doc);

    const focusSpy = vi.spyOn(view, 'focus');
    const requestAnimationFrameSpy = vi.spyOn(window, 'requestAnimationFrame');

    expect(deleteSelectedBlocks(view, [blocks[0]], (tr) => tr)).toBe(true);
    expect(focusSpy).toHaveBeenCalledTimes(1);
    expect(requestAnimationFrameSpy).not.toHaveBeenCalled();
    expect(view.state.doc.textContent).toBe('B');

    requestAnimationFrameSpy.mockRestore();
    await editor.destroy();
  });

  it('places the cursor at the previous paragraph tail after deleting a middle block', async () => {
    const editor = await createEditor('A\n\nB\n\nC');
    const view = editor.ctx.get(editorViewCtx);
    const blocks = collectSelectableBlockRanges(view.state.doc);

    expect(deleteSelectedBlocks(view, [blocks[1]], (tr) => tr)).toBe(true);

    expect(view.state.doc.textContent).toBe('AC');
    expect(view.state.selection).toBeInstanceOf(TextSelection);
    expect(view.state.selection.$from.parent.textContent).toBe('A');
    expect(view.state.selection.$from.parentOffset).toBe(1);

    await editor.destroy();
  });

  it('places the cursor at the next paragraph start after deleting the top block', async () => {
    const editor = await createEditor('A\n\nB\n\nC');
    const view = editor.ctx.get(editorViewCtx);
    const blocks = collectSelectableBlockRanges(view.state.doc);

    expect(deleteSelectedBlocks(view, [blocks[0]], (tr) => tr)).toBe(true);

    expect(view.state.doc.textContent).toBe('BC');
    expect(view.state.selection).toBeInstanceOf(TextSelection);
    expect(view.state.selection.$from.parent.textContent).toBe('B');
    expect(view.state.selection.$from.parentOffset).toBe(0);

    await editor.destroy();
  });

  it('selects the previous horizontal rule after deleting the block below it', async () => {
    const editor = await createEditor(['Before', '', '---', '', 'Delete me', '', 'After'].join('\n'));
    const view = editor.ctx.get(editorViewCtx);
    const targetBlock = findBlockByText(view, 'Delete me');

    expect(targetBlock).toBeDefined();
    expect(deleteSelectedBlocks(view, [targetBlock!], (tr) => tr)).toBe(true);

    expect(view.state.selection).toBeInstanceOf(NodeSelection);
    expect((view.state.selection as NodeSelection).node.type.name).toBe('hr');
    expect(view.state.doc.textContent).toContain('Before');
    expect(view.state.doc.textContent).toContain('After');
    expect(view.state.doc.textContent).not.toContain('Delete me');

    await editor.destroy();
  });

  it('selects the next horizontal rule after deleting the block above it', async () => {
    const editor = await createEditor(['Delete me', '', '---', '', 'After'].join('\n'));
    const view = editor.ctx.get(editorViewCtx);
    const targetBlock = findBlockByText(view, 'Delete me');

    expect(targetBlock).toBeDefined();
    expect(deleteSelectedBlocks(view, [targetBlock!], (tr) => tr)).toBe(true);

    expect(view.state.selection).toBeInstanceOf(NodeSelection);
    expect((view.state.selection as NodeSelection).node.type.name).toBe('hr');
    expect(view.state.doc.textContent).toContain('After');
    expect(view.state.doc.textContent).not.toContain('Delete me');

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

  it('removes only a selected code block inside a list item', async () => {
    const editor = await createEditor(['- Item', '  ```ts', '  console.log(1)', '  ```', '- Next'].join('\n'));
    const view = editor.ctx.get(editorViewCtx);
    const blocks = collectSelectableBlockRanges(view.state.doc);
    const codeBlock = blocks.find((range) => view.state.doc.resolve(range.from).nodeAfter?.type.name === 'code_block');

    expect(codeBlock).toBeDefined();
    expect(deleteSelectedBlocks(view, [codeBlock!], (tr) => tr)).toBe(true);

    expect(view.state.doc.textContent).toContain('Item');
    expect(view.state.doc.textContent).toContain('Next');
    expect(view.state.doc.textContent).not.toContain('console.log');
    expect(view.state.doc.child(0).type.name).toBe('bullet_list');
    expect(view.state.doc.child(0).childCount).toBe(2);

    await editor.destroy();
  });

  it.each([
    'math_block',
    'mermaid',
    'table',
  ] as const)('removes only a selected %s block inside a list item', async (typeName) => {
    const editor = await createEditor('');
    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    replaceDocument(view, [
      schema.nodes.bullet_list.create(null, [
        schema.nodes.list_item.create(null, [
          schema.nodes.paragraph.create(null, schema.text('Item')),
          createPreviewBlockNode(view, typeName),
        ]),
        schema.nodes.list_item.create(null, [
          schema.nodes.paragraph.create(null, schema.text('Next')),
        ]),
      ]),
    ]);
    const blocks = collectSelectableBlockRanges(view.state.doc);
    const previewBlock = blocks.find((range) => view.state.doc.resolve(range.from).nodeAfter?.type.name === typeName);

    expect(previewBlock).toBeDefined();
    expect(deleteSelectedBlocks(view, [previewBlock!], (tr) => tr)).toBe(true);

    let hasDeletedType = false;
    view.state.doc.descendants((node) => {
      if (node.type.name === typeName) {
        hasDeletedType = true;
        return false;
      }
      return true;
    });

    expect(view.state.doc.textContent).toContain('Item');
    expect(view.state.doc.textContent).toContain('Next');
    expect(hasDeletedType).toBe(false);
    expect(view.state.doc.child(0).type.name).toBe('bullet_list');
    expect(view.state.doc.child(0).childCount).toBe(2);

    await editor.destroy();
  });

  it('removes a whole list item with its inner code block when the list item range is selected', async () => {
    const editor = await createEditor(['- Item', '  ```ts', '  console.log(1)', '  ```', '- Next'].join('\n'));
    const view = editor.ctx.get(editorViewCtx);
    const blocks = collectSelectableBlockRanges(view.state.doc);
    const listItem = blocks.find((range) => view.state.doc.resolve(range.from).nodeAfter?.type.name === 'list_item');

    expect(listItem).toBeDefined();
    expect(deleteSelectedBlocks(view, [listItem!], (tr) => tr)).toBe(true);

    expect(view.state.doc.textContent).not.toContain('Item');
    expect(view.state.doc.textContent).not.toContain('console.log');
    expect(view.state.doc.textContent).toContain('Next');
    expect(view.state.doc.child(0).type.name).toBe('bullet_list');
    expect(view.state.doc.child(0).childCount).toBe(1);

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
