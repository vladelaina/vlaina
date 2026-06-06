import { describe, expect, it } from 'vitest';
import { Editor, defaultValueCtx, editorViewCtx } from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import { createEditableMarkdownBlankLineDecorations } from './markdownBlankLineInteraction';

async function createEditor(markdown: string) {
  const editor = Editor.make()
    .config((ctx) => {
      ctx.set(defaultValueCtx, markdown);
    })
    .use(commonmark)
    .use(gfm);

  await editor.create();
  return editor;
}

describe('markdownBlankLineInteraction', () => {
  it('caches editable markdown blank line decorations for the same doc instance', async () => {
    const editor = await createEditor('Alpha');
    const view = editor.ctx.get(editorViewCtx);

    const first = createEditableMarkdownBlankLineDecorations(view.state.doc);
    const second = createEditableMarkdownBlankLineDecorations(view.state.doc);

    expect(second).toBe(first);

    await editor.destroy();
  });
});
