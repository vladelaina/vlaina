import { describe, expect, it, vi } from 'vitest';
import {
  Editor,
  defaultValueCtx,
  editorViewCtx,
  remarkStringifyOptionsCtx,
  serializerCtx,
} from '@milkdown/kit/core';
import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import { TextSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';

import { notesRemarkStringifyOptions } from '../../config/stringifyOptions';
import { createTableNodeFromPipeCells } from './pipeTableShortcut';
import { tableKeyboardPlugin } from './tableKeyboardPlugin';

function typeText(view: EditorView, input: string): void {
  for (const text of input) {
    const { from, to } = view.state.selection;
    let handled = false;

    view.someProp('handleTextInput', (handleTextInput: any) => {
      handled = handleTextInput(view, from, to, text) || handled;
    });

    if (!handled) {
      view.dispatch(view.state.tr.insertText(text, from, to));
    }
  }
}

function pressEnter(view: EditorView): void {
  const event = new KeyboardEvent('keydown', {
    key: 'Enter',
    bubbles: true,
    cancelable: true,
  });
  let handled = false;

  view.someProp('handleKeyDown', (handleKeyDown: any) => {
    if (handled) {
      return handled;
    }
    handled = handleKeyDown(view, event) || handled;
    return handled;
  });

  expect(handled).toBe(true);
}

function pressKey(view: EditorView, key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
  });
  let handled = false;

  view.someProp('handleKeyDown', (handleKeyDown: any) => {
    if (handled) {
      return handled;
    }
    handled = handleKeyDown(view, event) || handled;
    return handled;
  });

  expect(handled).toBe(true);
  return event;
}

function getAncestorNodeNames(view: EditorView): string[] {
  const { $from } = view.state.selection;
  const names: string[] = [];
  for (let depth = $from.depth; depth >= 0; depth -= 1) {
    names.push($from.node(depth).type.name);
  }
  return names;
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

function expectCursorAtHeadingEdge(view: EditorView, edge: 'start' | 'end'): void {
  const headingPos = topLevelNodePos(view, 'heading');
  const heading = view.state.doc.nodeAt(headingPos);
  expect(heading?.type.name).toBe('heading');
  expect(view.state.selection).toBeInstanceOf(TextSelection);
  expect(view.state.selection.empty).toBe(true);
  expect(view.state.selection.from).toBe(
    edge === 'start'
      ? headingPos + 1
      : headingPos + 1 + (heading?.content.size ?? 0)
  );
}

describe('pipe table shortcut input', () => {
  it('keeps typed pipe row content in the created table header', async () => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, '');
        ctx.update(remarkStringifyOptionsCtx, (prev) => ({
          ...prev,
          ...notesRemarkStringifyOptions,
        }));
      })
      .use(commonmark)
      .use(gfm)
      .use(tableKeyboardPlugin);

    await editor.create();

    const view = editor.ctx.get(editorViewCtx);
    const serializer = editor.ctx.get(serializerCtx);

    typeText(view, '|1|2|');
    pressEnter(view);

    const table = view.state.doc.firstChild;
    const markdown = serializer(view.state.doc);
    expect(table?.type.name).toBe('table');
    expect(table?.firstChild?.childCount).toBe(2);
    expect(table?.firstChild?.firstChild?.textContent).toBe('1');
    expect(table?.firstChild?.child(1).textContent).toBe('2');
    expect(markdown.split('\n')[0]).toContain('1');
    expect(markdown.split('\n')[0]).toContain('2');
    expect(view.state.selection.$from.parent.type.name).toBe('paragraph');
    expect(getAncestorNodeNames(view)).toContain('table_cell');

    await editor.destroy();
  });

  it('creates a pipe table without reading aggregate paragraph textContent', async () => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, '');
      })
      .use(commonmark)
      .use(gfm)
      .use(tableKeyboardPlugin);

    await editor.create();

    const view = editor.ctx.get(editorViewCtx);
    typeText(view, '|1|2|');
    const paragraph = view.state.selection.$from.parent;
    const textBetween = vi.spyOn(paragraph, 'textBetween');
    Object.defineProperty(paragraph, 'textContent', {
      configurable: true,
      get() {
        throw new Error('aggregate paragraph textContent should not be read');
      },
    });

    pressEnter(view);

    expect(textBetween).toHaveBeenCalledWith(0, paragraph.content.size, '', '');
    expect(view.state.doc.firstChild?.type.name).toBe('table');

    await editor.destroy();
  });

  it.each([
    {
      name: 'heading above on Delete',
      key: 'Delete',
      edge: 'end',
      buildNodes: (heading: ProseNode, emptyParagraph: ProseNode, table: ProseNode) => [
        heading,
        emptyParagraph,
        table,
      ],
    },
    {
      name: 'heading below on Backspace',
      key: 'Backspace',
      edge: 'start',
      buildNodes: (heading: ProseNode, emptyParagraph: ProseNode, table: ProseNode) => [
        table,
        emptyParagraph,
        heading,
      ],
    },
  ] as const)('keeps the cursor on the heading when deleting an empty paragraph between a table and heading: $name', async ({ key, edge, buildNodes }) => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, '');
      })
      .use(commonmark)
      .use(gfm)
      .use(tableKeyboardPlugin);

    await editor.create();

    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    const table = createTableNodeFromPipeCells(schema, ['A', 'B']);
    if (!table) {
      throw new Error('Expected table schema');
    }

    replaceDocument(view, buildNodes(
      schema.nodes.heading.create({ level: 2 }, schema.text('Heading')),
      schema.nodes.paragraph.create(),
      table,
    ));

    const emptyParagraphPos = topLevelNodePos(view, 'paragraph');
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, emptyParagraphPos + 1)));
    const event = pressKey(view, key);

    expect(event.defaultPrevented).toBe(true);
    expect(view.state.doc.childCount).toBe(2);
    expectCursorAtHeadingEdge(view, edge);
    expect(getAncestorNodeNames(view)).not.toContain('table');

    await editor.destroy();
  });
});
