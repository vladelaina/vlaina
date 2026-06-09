import { describe, expect, it, vi } from 'vitest';

import { handleAutoPairBackspace } from './pairBackspace';
import { autoPairPluginKey } from './pairState';
import {
  createEditor,
  deleteCharBeforeCursor,
  deleteTextRange,
  getView,
  pressBackspace,
  pressDelete,
  pressKey,
  setTextSelection,
  typeText,
} from './autoPairPlugin.testUtils';

describe('autoPairPlugin deletion', () => {
  it('uses local textBetween reads when checking empty auto-pair deletion', () => {
    const getStateSpy = vi
      .spyOn(autoPairPluginKey, 'getState')
      .mockReturnValue([{ close: ')', pos: 1 }]);
    const tr = {
      delete: vi.fn(() => tr),
    };
    const dispatch = vi.fn();
    const parent = {
      isTextblock: true,
      content: { size: 2 },
      textBetween: vi.fn((from: number, to: number) => {
        if (from === 0 && to === 1) return '(';
        if (from === 1 && to === 2) return ')';
        return '';
      }),
      get textContent() {
        throw new Error('textContent should not be read for empty pair deletion');
      },
    };
    const state = {
      selection: {
        empty: true,
        from: 1,
        $from: {
          parent,
          parentOffset: 1,
        },
      },
      tr,
    };
    const event = new KeyboardEvent('keydown', {
      key: 'Backspace',
      bubbles: true,
      cancelable: true,
    });

    expect(handleAutoPairBackspace({ state, dispatch } as never, event)).toBe(true);
    expect(parent.textBetween).toHaveBeenCalledWith(0, 1, '\0', '\0');
    expect(parent.textBetween).toHaveBeenCalledWith(1, 2, '\0', '\0');
    expect(tr.delete).toHaveBeenCalledWith(0, 2);
    expect(dispatch).toHaveBeenCalledWith(tr);
    expect(event.defaultPrevented).toBe(true);

    getStateSpy.mockRestore();
  });

  it('keeps auto-pair tracking stable through inner edits', async () => {
    const editor = createEditor();

    await editor.create();

    const view = getView(editor);
    typeText(view, '(');
    typeText(view, 'a');
    deleteCharBeforeCursor(view);

    expect(view.state.doc.firstChild?.textContent).toBe('()');
    expect(view.state.selection.$from.parentOffset).toBe(1);
    expect(pressDelete(view)).toBe(true);
    expect(view.state.doc.firstChild?.textContent).toBe('');

    await editor.destroy();
  });

  it('deletes both sides when backspacing inside an empty bracket pair', async () => {
    const editor = createEditor();

    await editor.create();

    const view = getView(editor);
    typeText(view, '(');

    expect(pressBackspace(view)).toBe(true);
    expect(view.state.doc.firstChild?.textContent).toBe('');
    expect(view.state.selection.$from.parentOffset).toBe(0);

    await editor.destroy();
  });

  it('deletes both sides when pressing Delete inside an empty bracket pair', async () => {
    const editor = createEditor();

    await editor.create();

    const view = getView(editor);
    typeText(view, '(');

    expect(pressDelete(view)).toBe(true);
    expect(view.state.doc.firstChild?.textContent).toBe('');
    expect(view.state.selection.$from.parentOffset).toBe(0);

    await editor.destroy();
  });

  it('deletes both sides when pressing Delete inside an empty quote pair', async () => {
    const editor = createEditor();

    await editor.create();

    const view = getView(editor);
    typeText(view, '“');

    expect(pressDelete(view)).toBe(true);
    expect(view.state.doc.firstChild?.textContent).toBe('');
    expect(view.state.selection.$from.parentOffset).toBe(0);

    await editor.destroy();
  });

  it('deletes both sides when backspacing inside an empty quote pair', async () => {
    const editor = createEditor();

    await editor.create();

    const view = getView(editor);
    typeText(view, '“');

    expect(pressBackspace(view)).toBe(true);
    expect(view.state.doc.firstChild?.textContent).toBe('');
    expect(view.state.selection.$from.parentOffset).toBe(0);

    await editor.destroy();
  });

  it('does not delete both sides when the pair contains text', async () => {
    const editor = createEditor();

    await editor.create();

    const view = getView(editor);
    typeText(view, '(');
    typeText(view, 'a');

    expect(pressBackspace(view)).toBe(false);
    expect(view.state.doc.firstChild?.textContent).toBe('(a)');

    await editor.destroy();
  });

  it('does not delete both sides when a text range is selected inside an empty pair', async () => {
    const editor = createEditor();

    await editor.create();

    const view = getView(editor);
    typeText(view, '(');
    setTextSelection(view, 0, 1);

    pressBackspace(view);

    expect(view.state.doc.firstChild?.textContent).toBe(')');

    await editor.destroy();
  });

  it('does not intercept Backspace after the auto-inserted closer', async () => {
    const editor = createEditor();

    await editor.create();

    const view = getView(editor);
    typeText(view, '(');
    typeText(view, ')');

    expect(pressBackspace(view)).toBe(false);
    expect(view.state.doc.firstChild?.textContent).toBe('()');

    await editor.destroy();
  });

  it('does not treat a plain existing pair from the document as an auto pair on Backspace', async () => {
    const editor = createEditor('()');

    await editor.create();

    const view = getView(editor);
    setTextSelection(view, 1);

    expect(pressBackspace(view)).toBe(false);
    expect(view.state.doc.firstChild?.textContent).toBe('()');

    await editor.destroy();
  });

  it('does not treat a plain existing pair from the document as an auto pair on Delete', async () => {
    const editor = createEditor('()');

    await editor.create();

    const view = getView(editor);
    setTextSelection(view, 1);

    expect(pressDelete(view)).toBe(false);
    expect(view.state.doc.firstChild?.textContent).toBe('()');

    await editor.destroy();
  });

  it('stops skipping a closer after the auto-inserted closer is manually deleted', async () => {
    const editor = createEditor();

    await editor.create();

    const view = getView(editor);
    typeText(view, '(');
    deleteTextRange(view, 1, 2);
    setTextSelection(view, 1);
    typeText(view, ')');
    setTextSelection(view, 1);
    typeText(view, ')');

    expect(view.state.doc.firstChild?.textContent).toBe('())');
    expect(view.state.selection.$from.parentOffset).toBe(2);

    await editor.destroy();
  });

  it('stops paired deletion after the auto-inserted closer is manually deleted', async () => {
    const editor = createEditor();

    await editor.create();

    const view = getView(editor);
    typeText(view, '(');
    deleteTextRange(view, 1, 2);
    setTextSelection(view, 1);

    expect(pressBackspace(view)).toBe(false);
    expect(view.state.doc.firstChild?.textContent).toBe('(');

    await editor.destroy();
  });

  it('does not intercept Backspace when a modifier key is pressed inside an empty pair', async () => {
    const editor = createEditor();

    await editor.create();

    const view = getView(editor);
    typeText(view, '(');

    expect(pressKey(view, 'Backspace', { ctrlKey: true })).toBe(false);
    expect(view.state.doc.firstChild?.textContent).toBe('()');

    await editor.destroy();
  });

  it('does not intercept Delete while the user is composing input inside an empty pair', async () => {
    const editor = createEditor();

    await editor.create();

    const view = getView(editor);
    typeText(view, '（');

    expect(pressKey(view, 'Delete', { isComposing: true })).toBe(false);
    expect(view.state.doc.firstChild?.textContent).toBe('（）');

    await editor.destroy();
  });

  it('keeps paired deletion behavior after moving the cursor away and back', async () => {
    const editor = createEditor();

    await editor.create();

    const view = getView(editor);
    typeText(view, '(');

    setTextSelection(view, 2);
    setTextSelection(view, 1);

    expect(pressDelete(view)).toBe(true);
    expect(view.state.doc.firstChild?.textContent).toBe('');

    await editor.destroy();
  });

  it('supports layered deletion for nested empty chinese pairs', async () => {
    const editor = createEditor();

    await editor.create();

    const view = getView(editor);
    typeText(view, '「');
    typeText(view, '《');

    expect(view.state.doc.firstChild?.textContent).toBe('「《》」');
    expect(pressDelete(view)).toBe(true);
    expect(view.state.doc.firstChild?.textContent).toBe('「」');
    expect(view.state.selection.$from.parentOffset).toBe(1);

    expect(pressDelete(view)).toBe(true);
    expect(view.state.doc.firstChild?.textContent).toBe('');
    expect(view.state.selection.$from.parentOffset).toBe(0);

    await editor.destroy();
  });
});
