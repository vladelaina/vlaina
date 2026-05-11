import '@testing-library/jest-dom/vitest';
import {
  Editor,
  defaultValueCtx,
  editorViewCtx,
  remarkStringifyOptionsCtx,
} from '@milkdown/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import { Selection as ProseSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { describe, expect, it } from 'vitest';
import { listTabIndentPlugin } from './listTabIndentPlugin';

function createEditorWithContent(content: string) {
  const editor = Editor.make() as any;
  editor
    .config((ctx: any) => {
      ctx.set(defaultValueCtx, content);
      ctx.update(remarkStringifyOptionsCtx, (prev: any) => ({
        ...prev,
        bullet: '-',
      }));
    })
    .use(commonmark)
    .use(gfm)
    .use(listTabIndentPlugin);
  return editor;
}

function moveCursorToDocumentEnd(view: EditorView) {
  const selection = (ProseSelection as any).atEnd((view.state as any).doc);
  view.dispatch((view.state as any).tr.setSelection(selection));
}

function pressTab(view: EditorView, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', {
    key: 'Tab',
    bubbles: true,
    cancelable: true,
    ...init,
  });

  let handled = false;
  view.someProp('handleKeyDown', (handleKeyDown: any) => {
    handled = handleKeyDown(view, event) || handled;
  });

  return { event, handled };
}

describe('listTabIndentPlugin', () => {
  it('prevents focus from leaving the editor when tab has no editor action', async () => {
    const editor = createEditorWithContent('Plain paragraph');
    await editor.create();

    const view = editor.ctx.get(editorViewCtx);
    moveCursorToDocumentEnd(view);

    const { event, handled } = pressTab(view);

    expect(handled).toBe(true);
    expect(event.defaultPrevented).toBe(true);
  });

  it('prevents focus jumps when a list item cannot be indented further', async () => {
    const editor = createEditorWithContent('- first item');
    await editor.create();

    const view = editor.ctx.get(editorViewCtx);
    moveCursorToDocumentEnd(view);

    const { event, handled } = pressTab(view);

    expect(handled).toBe(true);
    expect(event.defaultPrevented).toBe(true);
  });

  it('leaves modified tab shortcuts to the app and browser', async () => {
    const editor = createEditorWithContent('Plain paragraph');
    await editor.create();

    const view = editor.ctx.get(editorViewCtx);
    moveCursorToDocumentEnd(view);

    const { event, handled } = pressTab(view, { ctrlKey: true });

    expect(handled).toBe(false);
    expect(event.defaultPrevented).toBe(false);
  });
});
