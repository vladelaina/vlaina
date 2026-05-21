import { describe, expect, it } from 'vitest';
import { Editor, defaultValueCtx, editorViewCtx } from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { TextSelection } from '@milkdown/kit/prose/state';
import { hasUsableTextRange, hasUsableTextSelection } from './selectionValidity';

async function createEditor(markdown: string) {
  const editor = Editor.make()
    .config((ctx) => {
      ctx.set(defaultValueCtx, markdown);
    })
    .use(commonmark);

  await editor.create();
  return editor;
}

describe('selectionValidity', () => {
  it('treats a real text selection as usable', async () => {
    const editor = await createEditor('hello');
    const view = editor.ctx.get(editorViewCtx);
    const selection = TextSelection.create(view.state.doc, 1, 6);

    expect(hasUsableTextSelection(selection, view.state.doc)).toBe(true);

    await editor.destroy();
  });

  it('rejects a non-empty range that only covers an empty paragraph boundary', async () => {
    const editor = await createEditor('');
    const view = editor.ctx.get(editorViewCtx);

    expect(hasUsableTextRange(view.state.doc, 0, view.state.doc.content.size)).toBe(false);

    await editor.destroy();
  });

  it('rejects whitespace-only text selections', async () => {
    const editor = await createEditor('a   b');
    const view = editor.ctx.get(editorViewCtx);
    const selection = TextSelection.create(view.state.doc, 2, 5);

    expect(hasUsableTextSelection(selection, view.state.doc)).toBe(false);

    await editor.destroy();
  });
});
