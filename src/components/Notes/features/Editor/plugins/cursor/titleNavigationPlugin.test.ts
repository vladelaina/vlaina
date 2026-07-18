import { describe, expect, it, vi } from 'vitest';
import { defaultValueCtx, Editor, editorViewCtx } from '@milkdown/kit/core';
import type { EditorView } from '@milkdown/kit/prose/view';
import { commonmark } from '@milkdown/kit/preset/commonmark';

const mocks = vi.hoisted(() => ({
  focusNoteTitleInputAtEnd: vi.fn(() => true),
}));

vi.mock('../../utils/titleInputDom', () => ({
  focusNoteTitleInputAtEnd: mocks.focusNoteTitleInputAtEnd,
}));

import { titleNavigationPlugin } from './titleNavigationPlugin';

async function createEditor() {
  const editor = Editor.make()
    .config((ctx) => {
      ctx.set(defaultValueCtx, 'first line');
    })
    .use(commonmark)
    .use(titleNavigationPlugin);
  await editor.create();
  const view = editor.ctx.get(editorViewCtx);
  vi.spyOn(view, 'endOfTextblock').mockReturnValue(true);
  return { editor, view };
}

function pressArrowUp(view: EditorView, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', {
    key: 'ArrowUp',
    bubbles: true,
    cancelable: true,
    ...init,
  });
  let handled = false;
  view.someProp('handleKeyDown', (handleKeyDown: any) => {
    handled = handleKeyDown(view, event) || handled;
    return handled;
  });
  return { event, handled };
}

describe('titleNavigationPlugin', () => {
  it('moves to the title for plain ArrowUp at the first visual line', async () => {
    const { editor, view } = await createEditor();

    const result = pressArrowUp(view);

    expect(result.handled).toBe(true);
    expect(result.event.defaultPrevented).toBe(true);
    expect(mocks.focusNoteTitleInputAtEnd).toHaveBeenCalledOnce();
    await editor.destroy();
  });

  it.each([
    { shiftKey: true },
    { ctrlKey: true },
    { metaKey: true },
    { altKey: true },
  ])('leaves modified ArrowUp to text selection: %o', async (init) => {
    mocks.focusNoteTitleInputAtEnd.mockClear();
    const { editor, view } = await createEditor();

    const result = pressArrowUp(view, init);

    expect(result.handled).toBe(false);
    expect(result.event.defaultPrevented).toBe(false);
    expect(mocks.focusNoteTitleInputAtEnd).not.toHaveBeenCalled();
    await editor.destroy();
  });
});
