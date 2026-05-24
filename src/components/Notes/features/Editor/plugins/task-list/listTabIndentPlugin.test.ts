import '@testing-library/jest-dom/vitest';
import {
  Editor,
  defaultValueCtx,
  editorViewCtx,
  remarkStringifyOptionsCtx,
  serializerCtx,
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

function pressEnter(view: EditorView) {
  const event = new KeyboardEvent('keydown', {
    key: 'Enter',
    bubbles: true,
    cancelable: true,
  });

  let handled = false;
  view.someProp('handleKeyDown', (handleKeyDown: any) => {
    handled = handleKeyDown(view, event) || handled;
  });

  return { event, handled };
}

function getMarkdown(editor: any): string {
  return editor.action((ctx: any) => {
    const view = ctx.get(editorViewCtx);
    const serializer = ctx.get(serializerCtx);
    return serializer(view.state.doc);
  });
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

  it('treats an internal list gap placeholder item as empty when pressing enter', async () => {
    const editor = createEditorWithContent(['- first', '- \u2800'].join('\n'));
    await editor.create();

    const view = editor.ctx.get(editorViewCtx);
    moveCursorToDocumentEnd(view);

    const { event, handled } = pressEnter(view);
    const markdown = getMarkdown(editor);

    expect(handled).toBe(true);
    expect(event.defaultPrevented).toBe(true);
    expect(markdown).toContain('- first');
    expect(markdown).not.toContain('\u2800');
    expect(markdown).not.toContain('- <br />');
  });

  it('marks internal list gap placeholder items for blank-line styling', async () => {
    const editor = createEditorWithContent(['- first', '- \u2800', '- second'].join('\n'));
    await editor.create();

    const view = editor.ctx.get(editorViewCtx);

    expect(view.dom.querySelectorAll('li.vlaina-list-gap-placeholder-item')).toHaveLength(1);
  });
});
