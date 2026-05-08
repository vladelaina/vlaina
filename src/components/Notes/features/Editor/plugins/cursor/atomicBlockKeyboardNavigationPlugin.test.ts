import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  defaultValueCtx,
  Editor,
  editorViewCtx,
} from '@milkdown/kit/core';
import { baseKeymap } from '@milkdown/kit/prose/commands';
import { NodeSelection, TextSelection } from '@milkdown/kit/prose/state';
import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import type { EditorView } from '@milkdown/kit/prose/view';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import { mathPlugin } from '../math';
import { mermaidPlugin } from '../mermaid';
import { createTableNodeFromPipeCells } from '../table/pipeTableShortcut';
import {
  ATOMIC_BLOCK_KEYBOARD_SELECTION_CLASS,
  atomicBlockKeyboardNavigationPlugin,
} from './atomicBlockKeyboardNavigationPlugin';

function createEditor(markdown = '') {
  return Editor.make()
    .config((ctx) => {
      ctx.set(defaultValueCtx, markdown);
    })
    .use(commonmark)
    .use(gfm)
    .use(mathPlugin)
    .use(mermaidPlugin)
    .use(atomicBlockKeyboardNavigationPlugin);
}

function replaceDocument(view: EditorView, nodes: ProseNode[]): void {
  view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size, nodes));
}

function topLevelNodePos(view: EditorView, typeName: string, occurrence = 0): number {
  let seen = 0;
  let found: number | null = null;
  view.state.doc.forEach((node, offset) => {
    if (found !== null || node.type.name !== typeName) return;
    if (seen === occurrence) {
      found = offset;
      return;
    }
    seen += 1;
  });

  if (found === null) {
    throw new Error(`Expected top-level ${typeName}`);
  }
  return found;
}

function pressKey(view: EditorView, key: string, options?: { shiftKey?: boolean }): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    shiftKey: options?.shiftKey,
  });

  let handled = false;
  view.someProp('handleKeyDown', (handleKeyDown: any) => {
    if (handled) return handled;
    handled = handleKeyDown(view, event) || handled;
    return handled;
  });

  return event;
}

function createAtomicNode(view: EditorView, typeName: 'math_block' | 'mermaid'): ProseNode {
  const { schema } = view.state;
  return typeName === 'math_block'
    ? schema.nodes.math_block.create({ latex: 'x' })
    : schema.nodes.mermaid.create({ code: 'sequenceDiagram\nA->>B: Hi' });
}

function createTableNode(view: EditorView): ProseNode {
  const table = createTableNodeFromPipeCells(view.state.schema, ['A', 'B']);
  if (!table) {
    throw new Error('Expected table schema');
  }
  return table;
}

function createCodeBlockNode(view: EditorView, text = 'const value = 1;'): ProseNode {
  const { schema } = view.state;
  const codeBlockType = schema.nodes.code_block;
  if (!codeBlockType) {
    throw new Error('Expected code block schema');
  }
  return codeBlockType.create({ language: 'ts' }, schema.text(text));
}

function replaceWithOrderedListGapAndTaskList(view: EditorView): void {
  const { schema } = view.state;
  replaceDocument(view, [
    schema.nodes.ordered_list.create(null, [
      schema.nodes.list_item.create(null, [
        schema.nodes.paragraph.create(null, schema.text('1')),
      ]),
    ]),
    schema.nodes.paragraph.create(),
    schema.nodes.bullet_list.create(null, [
      schema.nodes.list_item.create({ checked: false }, [
        schema.nodes.paragraph.create(null, schema.text('1')),
      ]),
    ]),
  ]);
}

function selectionAncestorNames(view: EditorView): string[] {
  const { $from } = view.state.selection;
  const names: string[] = [];
  for (let depth = $from.depth; depth >= 0; depth -= 1) {
    names.push($from.node(depth).type.name);
  }
  return names;
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('atomicBlockKeyboardNavigationPlugin', () => {
  it('selects a diagram block when ArrowDown leaves the preceding paragraph', async () => {
    const editor = createEditor();
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    const paragraph = schema.nodes.paragraph.create(null, schema.text('before'));
    const mermaid = schema.nodes.mermaid.create({ code: 'flowchart TD\nA --> B' });
    replaceDocument(view, [paragraph, mermaid]);

    const paragraphEnd = 1 + paragraph.content.size;
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, paragraphEnd)));
    vi.spyOn(view, 'endOfTextblock').mockReturnValue(true);

    const event = pressKey(view, 'ArrowDown');

    expect(event.defaultPrevented).toBe(true);
    expect(view.state.selection).toBeInstanceOf(NodeSelection);
    expect(view.state.selection.from).toBe(topLevelNodePos(view, 'mermaid'));
    expect(view.dom.classList.contains(ATOMIC_BLOCK_KEYBOARD_SELECTION_CLASS)).toBe(true);

    await editor.destroy();
  });

  it('clears the keyboard-selected caret suppression when selection returns to text', async () => {
    const editor = createEditor();
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    replaceDocument(view, [
      schema.nodes.paragraph.create(null, schema.text('before')),
      createAtomicNode(view, 'mermaid'),
    ]);

    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, topLevelNodePos(view, 'mermaid'))));
    expect(view.dom.classList.contains(ATOMIC_BLOCK_KEYBOARD_SELECTION_CLASS)).toBe(true);

    const event = pressKey(view, 'ArrowUp');

    expect(event.defaultPrevented).toBe(true);
    expect(view.state.selection).toBeInstanceOf(TextSelection);
    expect(view.dom.classList.contains(ATOMIC_BLOCK_KEYBOARD_SELECTION_CLASS)).toBe(false);

    await editor.destroy();
  });

  it('selects a formula block when ArrowUp leaves the following paragraph', async () => {
    const editor = createEditor();
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    const math = schema.nodes.math_block.create({ latex: 'x' });
    const paragraph = schema.nodes.paragraph.create(null, schema.text('after'));
    replaceDocument(view, [math, paragraph]);

    const paragraphStart = topLevelNodePos(view, 'paragraph') + 1;
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, paragraphStart)));
    vi.spyOn(view, 'endOfTextblock').mockReturnValue(true);

    const event = pressKey(view, 'ArrowUp');

    expect(event.defaultPrevented).toBe(true);
    expect(view.state.selection).toBeInstanceOf(NodeSelection);
    expect(view.state.selection.from).toBe(0);

    await editor.destroy();
  });

  it('moves from a selected atomic block into the following paragraph without inserting a transient one', async () => {
    const editor = createEditor();
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    replaceDocument(view, [
      createAtomicNode(view, 'math_block'),
      schema.nodes.paragraph.create(null, schema.text('after')),
    ]);

    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, 0)));
    const event = pressKey(view, 'ArrowDown');

    expect(event.defaultPrevented).toBe(true);
    expect(view.state.doc.childCount).toBe(2);
    expect(view.state.selection).toBeInstanceOf(TextSelection);
    expect(view.state.selection.from).toBe(2);
    expect(view.state.doc.child(1).textContent).toBe('after');

    await editor.destroy();
  });

  it('inserts a transient empty paragraph between adjacent math and diagram blocks', async () => {
    const editor = createEditor();
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    const math = schema.nodes.math_block.create({ latex: 'x' });
    const mermaid = schema.nodes.mermaid.create({ code: 'sequenceDiagram\nA->>B: Hi' });
    replaceDocument(view, [math, mermaid]);

    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, 0)));
    const event = pressKey(view, 'ArrowDown');

    expect(event.defaultPrevented).toBe(true);
    expect(view.state.doc.childCount).toBe(3);
    expect(view.state.doc.child(1).type.name).toBe('paragraph');
    expect(view.state.doc.child(1).content.size).toBe(0);
    expect(view.state.selection).toBeInstanceOf(TextSelection);
    expect(view.state.selection.from).toBe(2);

    await editor.destroy();
  });

  it('inserts a transient paragraph for every adjacent formula and diagram pairing', async () => {
    const pairs: Array<['math_block' | 'mermaid', 'math_block' | 'mermaid']> = [
      ['math_block', 'math_block'],
      ['mermaid', 'mermaid'],
      ['math_block', 'mermaid'],
      ['mermaid', 'math_block'],
    ];

    for (const [firstType, secondType] of pairs) {
      const editor = createEditor();
      await editor.create();
      const view = editor.ctx.get(editorViewCtx);
      replaceDocument(view, [
        createAtomicNode(view, firstType),
        createAtomicNode(view, secondType),
      ]);

      view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, 0)));
      const event = pressKey(view, 'ArrowDown');

      expect(event.defaultPrevented, `${firstType} -> ${secondType}`).toBe(true);
      expect(view.state.doc.childCount, `${firstType} -> ${secondType}`).toBe(3);
      expect(view.state.doc.child(1).type.name, `${firstType} -> ${secondType}`).toBe('paragraph');
      expect(view.state.selection).toBeInstanceOf(TextSelection);

      await editor.destroy();
    }
  });

  it('removes the transient paragraph when ArrowDown continues into the next atomic block', async () => {
    const editor = createEditor();
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    replaceDocument(view, [
      schema.nodes.math_block.create({ latex: 'x' }),
      schema.nodes.mermaid.create({ code: 'sequenceDiagram\nA->>B: Hi' }),
    ]);

    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, 0)));
    pressKey(view, 'ArrowDown');
    const event = pressKey(view, 'ArrowDown');

    expect(event.defaultPrevented).toBe(true);
    expect(view.state.doc.childCount).toBe(2);
    expect(view.state.doc.child(0).type.name).toBe('math_block');
    expect(view.state.doc.child(1).type.name).toBe('mermaid');
    expect(view.state.selection).toBeInstanceOf(NodeSelection);
    expect(view.state.selection.from).toBe(1);

    await editor.destroy();
  });

  it('supports ArrowUp through adjacent atomic blocks with the same transient paragraph cleanup', async () => {
    const editor = createEditor();
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    replaceDocument(view, [
      schema.nodes.math_block.create({ latex: 'x' }),
      schema.nodes.mermaid.create({ code: 'sequenceDiagram\nA->>B: Hi' }),
    ]);

    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, 1)));
    const insertEvent = pressKey(view, 'ArrowUp');

    expect(insertEvent.defaultPrevented).toBe(true);
    expect(view.state.doc.childCount).toBe(3);
    expect(view.state.doc.child(1).type.name).toBe('paragraph');
    expect(view.state.selection).toBeInstanceOf(TextSelection);
    expect(view.state.selection.from).toBe(2);

    const continueEvent = pressKey(view, 'ArrowUp');

    expect(continueEvent.defaultPrevented).toBe(true);
    expect(view.state.doc.childCount).toBe(2);
    expect(view.state.selection).toBeInstanceOf(NodeSelection);
    expect(view.state.selection.from).toBe(0);

    await editor.destroy();
  });

  it('keeps the inserted paragraph once the user types into it', async () => {
    const editor = createEditor();
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    replaceDocument(view, [
      schema.nodes.math_block.create({ latex: 'x' }),
      schema.nodes.mermaid.create({ code: 'sequenceDiagram\nA->>B: Hi' }),
    ]);

    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, 0)));
    pressKey(view, 'ArrowDown');
    view.dispatch(view.state.tr.insertText('note'));
    vi.spyOn(view, 'endOfTextblock').mockReturnValue(true);
    pressKey(view, 'ArrowDown');

    expect(view.state.doc.childCount).toBe(3);
    expect(view.state.doc.child(1).textContent).toBe('note');
    expect(view.state.selection).toBeInstanceOf(NodeSelection);
    expect(view.state.selection.from).toBe(topLevelNodePos(view, 'mermaid'));

    await editor.destroy();
  });

  it('keeps typed transient content when selection later moves elsewhere', async () => {
    const editor = createEditor();
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    replaceDocument(view, [
      createAtomicNode(view, 'math_block'),
      createAtomicNode(view, 'mermaid'),
    ]);

    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, 0)));
    pressKey(view, 'ArrowDown');
    view.dispatch(view.state.tr.insertText('note'));
    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, topLevelNodePos(view, 'mermaid'))));

    expect(view.state.doc.childCount).toBe(3);
    expect(view.state.doc.child(1).type.name).toBe('paragraph');
    expect(view.state.doc.child(1).textContent).toBe('note');
    expect(view.state.selection).toBeInstanceOf(NodeSelection);

    await editor.destroy();
  });

  it('treats an existing empty paragraph between atomic blocks as a real editable paragraph', async () => {
    const editor = createEditor();
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    replaceDocument(view, [
      createAtomicNode(view, 'math_block'),
      schema.nodes.paragraph.create(),
      createAtomicNode(view, 'mermaid'),
    ]);

    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, 0)));
    const intoParagraph = pressKey(view, 'ArrowDown');
    const intoMermaid = pressKey(view, 'ArrowDown');

    expect(intoParagraph.defaultPrevented).toBe(true);
    expect(intoMermaid.defaultPrevented).toBe(true);
    expect(view.state.doc.childCount).toBe(3);
    expect(view.state.doc.child(1).type.name).toBe('paragraph');
    expect(view.state.selection).toBeInstanceOf(NodeSelection);
    expect(view.state.selection.from).toBe(topLevelNodePos(view, 'mermaid'));

    await editor.destroy();
  });

  it('creates a transient input paragraph below the last atomic block', async () => {
    const editor = createEditor();
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    replaceDocument(view, [
      createAtomicNode(view, 'mermaid'),
    ]);

    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, 0)));
    const event = pressKey(view, 'ArrowDown');

    expect(event.defaultPrevented).toBe(true);
    expect(view.state.doc.childCount).toBe(2);
    expect(view.state.doc.child(1).type.name).toBe('paragraph');
    expect(view.state.selection).toBeInstanceOf(TextSelection);
    expect(view.state.selection.from).toBe(2);

    const backEvent = pressKey(view, 'ArrowUp');

    expect(backEvent.defaultPrevented).toBe(true);
    expect(view.state.doc.childCount).toBe(1);
    expect(view.state.selection).toBeInstanceOf(NodeSelection);
    expect(view.state.selection.from).toBe(0);

    await editor.destroy();
  });

  it('creates a transient input paragraph above the first atomic block', async () => {
    const editor = createEditor();
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    replaceDocument(view, [
      createAtomicNode(view, 'math_block'),
    ]);

    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, 0)));
    const event = pressKey(view, 'ArrowUp');

    expect(event.defaultPrevented).toBe(true);
    expect(view.state.doc.childCount).toBe(2);
    expect(view.state.doc.child(0).type.name).toBe('paragraph');
    expect(view.state.selection).toBeInstanceOf(TextSelection);
    expect(view.state.selection.from).toBe(1);

    const downEvent = pressKey(view, 'ArrowDown');

    expect(downEvent.defaultPrevented).toBe(true);
    expect(view.state.doc.childCount).toBe(1);
    expect(view.state.selection).toBeInstanceOf(NodeSelection);
    expect(view.state.selection.from).toBe(0);

    await editor.destroy();
  });

  it('moves from an atomic block into adjacent text without letting Enter delete the atomic block', async () => {
    const editor = createEditor();
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    replaceDocument(view, [
      schema.nodes.paragraph.create(null, schema.text('above')),
      createAtomicNode(view, 'mermaid'),
    ]);

    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, topLevelNodePos(view, 'mermaid'))));
    const event = pressKey(view, 'ArrowUp');

    expect(event.defaultPrevented).toBe(true);
    expect(view.state.selection).toBeInstanceOf(TextSelection);
    expect(view.state.selection.from).toBe(6);

    expect(baseKeymap.Enter(view.state, view.dispatch, view)).toBe(true);
    expect(view.state.doc.childCount).toBe(3);
    expect(view.state.doc.child(0).textContent).toBe('above');
    expect(view.state.doc.child(1).type.name).toBe('paragraph');
    expect(view.state.doc.child(2).type.name).toBe('mermaid');

    await editor.destroy();
  });

  it('does not intercept Shift+Arrow text selection behavior', async () => {
    const editor = createEditor();
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    replaceDocument(view, [
      schema.nodes.paragraph.create(null, schema.text('before')),
      createAtomicNode(view, 'mermaid'),
    ]);

    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 6)));
    vi.spyOn(view, 'endOfTextblock').mockReturnValue(true);

    const event = pressKey(view, 'ArrowDown', { shiftKey: true });

    expect(event.defaultPrevented).toBe(false);
    expect(view.state.selection).toBeInstanceOf(TextSelection);
    expect(view.state.selection.from).toBe(6);
    expect(view.state.doc.childCount).toBe(2);

    await editor.destroy();
  });

  it('deletes an empty paragraph immediately below a table without moving to the next line first', async () => {
    const editor = createEditor();
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    replaceDocument(view, [
      createTableNode(view),
      schema.nodes.paragraph.create(),
      schema.nodes.paragraph.create(null, schema.text('after')),
    ]);

    const emptyParagraphPos = topLevelNodePos(view, 'paragraph');
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, emptyParagraphPos + 1)));
    const event = pressKey(view, 'Delete');

    expect(event.defaultPrevented).toBe(true);
    expect(view.state.doc.childCount).toBe(2);
    expect(view.state.doc.child(0).type.name).toBe('table');
    expect(view.state.doc.child(1).textContent).toBe('after');
    expect(selectionAncestorNames(view)).toContain('table');

    await editor.destroy();
  });

  it('deletes an empty paragraph immediately below a formula with the same structural block logic', async () => {
    const editor = createEditor();
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    replaceDocument(view, [
      createAtomicNode(view, 'math_block'),
      schema.nodes.paragraph.create(),
      schema.nodes.paragraph.create(null, schema.text('after')),
    ]);

    const emptyParagraphPos = topLevelNodePos(view, 'paragraph');
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, emptyParagraphPos + 1)));
    const event = pressKey(view, 'Delete');

    expect(event.defaultPrevented).toBe(true);
    expect(view.state.doc.childCount).toBe(2);
    expect(view.state.doc.child(0).type.name).toBe('math_block');
    expect(view.state.doc.child(1).textContent).toBe('after');
    expect(view.state.selection).toBeInstanceOf(NodeSelection);
    expect(view.state.selection.from).toBe(0);

    await editor.destroy();
  });

  it('deletes an empty paragraph immediately below a diagram and selects that diagram', async () => {
    const editor = createEditor();
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    replaceDocument(view, [
      createAtomicNode(view, 'mermaid'),
      schema.nodes.paragraph.create(),
      schema.nodes.paragraph.create(null, schema.text('after')),
    ]);

    const emptyParagraphPos = topLevelNodePos(view, 'paragraph');
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, emptyParagraphPos + 1)));
    const event = pressKey(view, 'Delete');

    expect(event.defaultPrevented).toBe(true);
    expect(view.state.doc.childCount).toBe(2);
    expect(view.state.doc.child(0).type.name).toBe('mermaid');
    expect(view.state.doc.child(1).textContent).toBe('after');
    expect(view.state.selection).toBeInstanceOf(NodeSelection);
    expect(view.state.selection.from).toBe(0);

    await editor.destroy();
  });

  it('deletes an empty paragraph immediately below a code block without moving the cursor into code', async () => {
    const editor = createEditor();
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    replaceDocument(view, [
      createCodeBlockNode(view),
      schema.nodes.paragraph.create(),
      schema.nodes.paragraph.create(null, schema.text('after')),
    ]);

    const emptyParagraphPos = topLevelNodePos(view, 'paragraph');
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, emptyParagraphPos + 1)));
    const event = pressKey(view, 'Delete');

    expect(event.defaultPrevented).toBe(true);
    expect(view.state.doc.childCount).toBe(2);
    expect(view.state.doc.child(0).type.name).toBe('code_block');
    expect(view.state.doc.child(1).textContent).toBe('after');
    expect(view.state.selection).toBeInstanceOf(TextSelection);
    expect(selectionAncestorNames(view)).not.toContain('code_block');
    expect(view.state.selection.from).toBe(topLevelNodePos(view, 'paragraph') + 1);

    await editor.destroy();
  });

  it('backspaces an empty paragraph immediately below a code block without moving the cursor into code', async () => {
    const editor = createEditor();
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    replaceDocument(view, [
      createCodeBlockNode(view),
      schema.nodes.paragraph.create(),
      schema.nodes.paragraph.create(null, schema.text('after')),
    ]);

    const emptyParagraphPos = topLevelNodePos(view, 'paragraph');
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, emptyParagraphPos + 1)));
    const event = pressKey(view, 'Backspace');

    expect(event.defaultPrevented).toBe(true);
    expect(view.state.doc.childCount).toBe(2);
    expect(view.state.doc.child(0).type.name).toBe('code_block');
    expect(view.state.doc.child(1).textContent).toBe('after');
    expect(view.state.selection).toBeInstanceOf(TextSelection);
    expect(selectionAncestorNames(view)).not.toContain('code_block');
    expect(view.state.selection.from).toBe(topLevelNodePos(view, 'paragraph') + 1);

    await editor.destroy();
  });

  it('deletes the only empty paragraph below a code block and keeps an outside cursor target', async () => {
    const editor = createEditor();
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    replaceDocument(view, [
      createCodeBlockNode(view),
      schema.nodes.paragraph.create(),
    ]);

    const emptyParagraphPos = topLevelNodePos(view, 'paragraph');
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, emptyParagraphPos + 1)));
    const event = pressKey(view, 'Delete');

    expect(event.defaultPrevented).toBe(true);
    expect(view.state.doc.childCount).toBe(2);
    expect(view.state.doc.child(0).type.name).toBe('code_block');
    expect(view.state.doc.child(1).type.name).toBe('paragraph');
    expect(view.state.doc.child(1).textContent).toBe('');
    expect(view.state.selection).toBeInstanceOf(TextSelection);
    expect(selectionAncestorNames(view)).not.toContain('code_block');
    expect(view.state.selection.from).toBe(topLevelNodePos(view, 'paragraph') + 1);

    await editor.destroy();
  });

  it('deletes an empty paragraph immediately above a diagram with the same structural block logic', async () => {
    const editor = createEditor();
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    replaceDocument(view, [
      schema.nodes.paragraph.create(null, schema.text('before')),
      schema.nodes.paragraph.create(),
      createAtomicNode(view, 'mermaid'),
    ]);

    const emptyParagraphPos = topLevelNodePos(view, 'paragraph', 1);
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, emptyParagraphPos + 1)));
    const event = pressKey(view, 'Backspace');

    expect(event.defaultPrevented).toBe(true);
    expect(view.state.doc.childCount).toBe(2);
    expect(view.state.doc.child(0).textContent).toBe('before');
    expect(view.state.doc.child(1).type.name).toBe('mermaid');
    expect(view.state.selection).toBeInstanceOf(NodeSelection);
    expect(view.state.selection.from).toBe(topLevelNodePos(view, 'mermaid'));

    await editor.destroy();
  });

  it('deletes an empty paragraph between ordered and task lists on Delete', async () => {
    const editor = createEditor();
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    replaceWithOrderedListGapAndTaskList(view);

    const emptyParagraphPos = topLevelNodePos(view, 'paragraph');
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, emptyParagraphPos + 1)));
    const event = pressKey(view, 'Delete');

    expect(event.defaultPrevented).toBe(true);
    expect(view.state.doc.childCount).toBe(2);
    expect(view.state.doc.child(0).type.name).toBe('ordered_list');
    expect(view.state.doc.child(1).type.name).toBe('bullet_list');
    expect(view.state.doc.child(0).textContent).toBe('1');
    expect(view.state.doc.child(1).textContent).toBe('1');
    expect(view.state.selection).toBeInstanceOf(TextSelection);
    expect(selectionAncestorNames(view)).toContain('list_item');

    await editor.destroy();
  });

  it('deletes an empty paragraph between ordered and task lists on Backspace', async () => {
    const editor = createEditor();
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    replaceWithOrderedListGapAndTaskList(view);

    const emptyParagraphPos = topLevelNodePos(view, 'paragraph');
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, emptyParagraphPos + 1)));
    const event = pressKey(view, 'Backspace');

    expect(event.defaultPrevented).toBe(true);
    expect(view.state.doc.childCount).toBe(2);
    expect(view.state.doc.child(0).type.name).toBe('ordered_list');
    expect(view.state.doc.child(1).type.name).toBe('bullet_list');
    expect(view.state.doc.child(0).textContent).toBe('1');
    expect(view.state.doc.child(1).textContent).toBe('1');
    expect(view.state.selection).toBeInstanceOf(TextSelection);
    expect(selectionAncestorNames(view)).toContain('list_item');

    await editor.destroy();
  });

  it('removes the transient paragraph when selection moves elsewhere without input', async () => {
    const editor = createEditor();
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    replaceDocument(view, [
      schema.nodes.math_block.create({ latex: 'x' }),
      schema.nodes.mermaid.create({ code: 'sequenceDiagram\nA->>B: Hi' }),
    ]);

    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, 0)));
    pressKey(view, 'ArrowDown');
    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, 3)));

    expect(view.state.doc.childCount).toBe(2);
    expect(view.state.doc.child(0).type.name).toBe('math_block');
    expect(view.state.doc.child(1).type.name).toBe('mermaid');

    await editor.destroy();
  });
});
