import { afterEach, describe, expect, it, vi } from 'vitest';
import { Editor, defaultValueCtx, editorViewCtx } from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import { collectSelectableBlockRanges } from './blockUnitResolver';
import { deleteSelectedBlocks } from './blockSelectionDeletion';

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
});
