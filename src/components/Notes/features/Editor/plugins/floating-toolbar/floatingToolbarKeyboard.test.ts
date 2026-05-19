import { describe, expect, it } from 'vitest';
import {
  Editor,
  defaultValueCtx,
  editorViewCtx,
} from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { TextSelection } from '@milkdown/kit/prose/state';
import { shouldHideToolbarForArrowNavigation } from './floatingToolbarPlugin';

async function createTextSelection(from: number, to: number) {
  const editor = Editor.make()
    .config((ctx) => {
      ctx.set(defaultValueCtx, 'hello world');
    })
    .use(commonmark);

  await editor.create();
  const view = editor.ctx.get(editorViewCtx);
  const selection = TextSelection.create(view.state.doc, from, to);
  await editor.destroy();
  return selection;
}

describe('floating toolbar keyboard handling', () => {
  it('handles plain ArrowLeft when a text selection is active', async () => {
    const selection = await createTextSelection(1, 6);

    expect(shouldHideToolbarForArrowNavigation(
      selection,
      new KeyboardEvent('keydown', { key: 'ArrowLeft' })
    )).toBe(true);
  });

  it('handles plain ArrowRight when a text selection is active', async () => {
    const selection = await createTextSelection(1, 6);

    expect(shouldHideToolbarForArrowNavigation(
      selection,
      new KeyboardEvent('keydown', { key: 'ArrowRight' })
    )).toBe(true);
  });

  it('handles plain ArrowUp when a text selection is active', async () => {
    const selection = await createTextSelection(1, 6);

    expect(shouldHideToolbarForArrowNavigation(
      selection,
      new KeyboardEvent('keydown', { key: 'ArrowUp' })
    )).toBe(true);
  });

  it('handles plain ArrowDown when a text selection is active', async () => {
    const selection = await createTextSelection(1, 6);

    expect(shouldHideToolbarForArrowNavigation(
      selection,
      new KeyboardEvent('keydown', { key: 'ArrowDown' })
    )).toBe(true);
  });

  it('does not hide on modified arrow key selection movement', async () => {
    const selection = await createTextSelection(1, 6);

    expect(shouldHideToolbarForArrowNavigation(
      selection,
      new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true })
    )).toBe(false);
  });

  it('does not hide for an already empty selection', async () => {
    const selection = await createTextSelection(3, 3);

    expect(shouldHideToolbarForArrowNavigation(
      selection,
      new KeyboardEvent('keydown', { key: 'ArrowRight' })
    )).toBe(false);
  });
});
