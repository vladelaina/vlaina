import { describe, expect, it } from 'vitest';
import {
  Editor,
  defaultValueCtx,
  editorViewCtx,
  remarkStringifyOptionsCtx,
  serializerCtx,
} from '@milkdown/kit/core';
import type { EditorView } from '@milkdown/kit/prose/view';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';

import { notesRemarkStringifyOptions } from '../../config/stringifyOptions';
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

function getAncestorNodeNames(view: EditorView): string[] {
  const { $from } = view.state.selection;
  const names: string[] = [];
  for (let depth = $from.depth; depth >= 0; depth -= 1) {
    names.push($from.node(depth).type.name);
  }
  return names;
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
});
