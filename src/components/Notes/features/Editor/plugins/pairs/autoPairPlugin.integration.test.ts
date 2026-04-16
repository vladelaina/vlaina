import { describe, expect, it } from 'vitest';
import { Selection } from '@milkdown/kit/prose/state';

import {
  createEditor,
  createEditorWithHistory,
  getView,
  replaceSelectionWithText,
  runRedo,
  runUndo,
  setTextSelection,
  simulateTextInput,
  typeText,
} from './autoPairPlugin.testUtils';

describe('autoPairPlugin integration flows', () => {
  it('keeps the closing bracket tracked after plain text paste inside an auto pair', async () => {
    const editor = createEditor();

    await editor.create();

    const view = getView(editor);
    typeText(view, '(');
    replaceSelectionWithText(view, 'pasted');
    typeText(view, ')');

    expect(view.state.doc.firstChild?.textContent).toBe('(pasted)');
    expect(view.state.selection.$from.parentOffset).toBe(8);

    await editor.destroy();
  });

  it('keeps the outer wrapped closer tracked after paste replaces the wrapped content', async () => {
    const editor = createEditor('demo');

    await editor.create();

    const view = getView(editor);
    setTextSelection(view, 0, 4);
    typeText(view, '(');
    setTextSelection(view, 1, 5);
    replaceSelectionWithText(view, 'pasted');
    setTextSelection(view, 7);
    typeText(view, ')');

    expect(view.state.doc.firstChild?.textContent).toBe('(pasted)');
    expect(view.state.selection.$from.parentOffset).toBe(8);

    await editor.destroy();
  });

  it('keeps tracked chinese closers aligned after pasting before nested pairs', async () => {
    const editor = createEditor();

    await editor.create();

    const view = getView(editor);
    typeText(view, '「');
    typeText(view, '《');
    typeText(view, '标题');
    typeText(view, '》');
    setTextSelection(view, 0);
    replaceSelectionWithText(view, '前缀');
    setTextSelection(view, 7);
    typeText(view, '」');

    expect(view.state.doc.firstChild?.textContent).toBe('前缀「《标题》」');
    expect(view.state.selection.$from.parentOffset).toBe(8);

    await editor.destroy();
  });

  it('restores closer skip behavior after redo when pasted text changed the pair contents', async () => {
    const editor = createEditorWithHistory();

    await editor.create();

    const view = getView(editor);
    typeText(view, '(');
    replaceSelectionWithText(view, 'pasted');

    expect(runUndo(view)).toBe(true);
    expect(runRedo(view)).toBe(true);

    setTextSelection(view, 7);
    typeText(view, ')');

    expect(view.state.doc.firstChild?.textContent).toBe('(pasted)');
    expect(view.state.selection.$from.parentOffset).toBe(8);

    await editor.destroy();
  });

  it('supports auto-pairing inside inline code text', async () => {
    const editor = createEditor('`code`');

    await editor.create();

    const view = getView(editor);
    setTextSelection(view, 2);
    typeText(view, '(');
    typeText(view, ')');

    expect(view.state.doc.firstChild?.textContent).toBe('co()de');
    expect(view.state.selection.$from.parentOffset).toBe(4);

    await editor.destroy();
  });

  it('supports auto-pairing inside emphasized markdown text', async () => {
    const editor = createEditor('**bold**');

    await editor.create();

    const view = getView(editor);
    setTextSelection(view, 4);
    typeText(view, '“');
    typeText(view, '”');

    expect(view.state.doc.firstChild?.textContent).toBe('bold“”');
    expect(view.state.selection.$from.parentOffset).toBe(6);

    await editor.destroy();
  });

  it('handles a fullwidth mobile-style pair commit as plain insertion without tracking skip state', async () => {
    const editor = createEditor();

    await editor.create();

    const view = getView(editor);
    simulateTextInput(view, '（）');
    typeText(view, '）');

    expect(view.state.doc.firstChild?.textContent).toBe('（））');
    expect(view.state.selection.$from.parentOffset).toBe(3);

    await editor.destroy();
  });

  it('treats repeated closing input from a soft keyboard as plain insertion when no auto closer is tracked', async () => {
    const editor = createEditor('）');

    await editor.create();

    const view = getView(editor);
    view.dispatch(view.state.tr.setSelection(Selection.atEnd(view.state.doc)));
    typeText(view, '）');

    expect(view.state.doc.firstChild?.textContent).toBe('））');
    expect(view.state.selection.$from.parentOffset).toBe(2);

    await editor.destroy();
  });
});
