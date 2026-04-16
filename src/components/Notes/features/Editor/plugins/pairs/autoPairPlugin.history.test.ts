import { describe, expect, it } from 'vitest';

import {
  createEditor,
  createEditorWithHistory,
  deleteSelection,
  getView,
  pressDelete,
  runRedo,
  runUndo,
  setTextSelection,
  simulateTextInput,
  typeText,
} from './autoPairPlugin.testUtils';

describe('autoPairPlugin history and tracking', () => {
  it('restores skip behavior after redo for an auto-inserted pair', async () => {
    const editor = createEditorWithHistory();

    await editor.create();

    const view = getView(editor);
    typeText(view, '(');

    expect(runUndo(view)).toBe(true);
    expect(view.state.doc.firstChild?.textContent).toBe('');
    expect(runRedo(view)).toBe(true);

    expect(view.state.doc.firstChild?.textContent).toBe('()');
    expect(view.state.selection.$from.parentOffset).toBe(1);

    typeText(view, ')');

    expect(view.state.doc.firstChild?.textContent).toBe('()');
    expect(view.state.selection.$from.parentOffset).toBe(2);

    await editor.destroy();
  });

  it('restores paired deletion behavior after redo for an auto-inserted pair', async () => {
    const editor = createEditorWithHistory();

    await editor.create();

    const view = getView(editor);
    typeText(view, '(');

    expect(runUndo(view)).toBe(true);
    expect(runRedo(view)).toBe(true);
    expect(pressDelete(view)).toBe(true);
    expect(view.state.doc.firstChild?.textContent).toBe('');

    await editor.destroy();
  });

  it('restores wrapped closer skip behavior after redo', async () => {
    const editor = createEditorWithHistory('demo');

    await editor.create();

    const view = getView(editor);
    setTextSelection(view, 0, 4);
    typeText(view, '(');

    expect(runUndo(view)).toBe(true);
    expect(view.state.doc.firstChild?.textContent).toBe('demo');
    expect(runRedo(view)).toBe(true);
    expect(view.state.doc.firstChild?.textContent).toBe('(demo)');

    setTextSelection(view, 5);
    typeText(view, ')');

    expect(view.state.doc.firstChild?.textContent).toBe('(demo)');
    expect(view.state.selection.$from.parentOffset).toBe(6);

    await editor.destroy();
  });

  it('restores mixed quote and bracket skip behavior after redo', async () => {
    const editor = createEditorWithHistory();

    await editor.create();

    const view = getView(editor);
    typeText(view, '“');
    typeText(view, '(');
    typeText(view, 'text');
    typeText(view, ')');
    typeText(view, '”');

    expect(runUndo(view)).toBe(true);
    expect(runRedo(view)).toBe(true);
    expect(view.state.doc.firstChild?.textContent).toBe('“(text)”');

    setTextSelection(view, 7);
    typeText(view, '”');

    expect(view.state.doc.firstChild?.textContent).toBe('“(text)”');
    expect(view.state.selection.$from.parentOffset).toBe(8);

    await editor.destroy();
  });

  it('restores chinese nested quote skip behavior after redo', async () => {
    const editor = createEditorWithHistory();

    await editor.create();

    const view = getView(editor);
    typeText(view, '「');
    typeText(view, '《');
    typeText(view, '标题');
    typeText(view, '》');
    typeText(view, '」');

    expect(runUndo(view)).toBe(true);
    expect(runRedo(view)).toBe(true);
    expect(view.state.doc.firstChild?.textContent).toBe('「《标题》」');

    setTextSelection(view, 5);
    typeText(view, '」');

    expect(view.state.doc.firstChild?.textContent).toBe('「《标题》」');
    expect(view.state.selection.$from.parentOffset).toBe(6);

    await editor.destroy();
  });

  it('restores nested wrapped closers after redo', async () => {
    const editor = createEditorWithHistory('标题');

    await editor.create();

    const view = getView(editor);
    setTextSelection(view, 0, 2);
    typeText(view, '《');
    setTextSelection(view, 0, 4);
    typeText(view, '「');

    expect(view.state.doc.firstChild?.textContent).toBe('「《标题》」');
    expect(runUndo(view)).toBe(true);
    expect(runRedo(view)).toBe(true);
    expect(view.state.doc.firstChild?.textContent).toBe('「《标题》」');

    setTextSelection(view, 5);
    typeText(view, '」');

    expect(view.state.doc.firstChild?.textContent).toBe('「《标题》」');
    expect(view.state.selection.$from.parentOffset).toBe(6);

    await editor.destroy();
  });

  it('restores inner wrapped closer skip behavior after nested wrap redo', async () => {
    const editor = createEditorWithHistory('标题');

    await editor.create();

    const view = getView(editor);
    setTextSelection(view, 0, 2);
    typeText(view, '《');
    setTextSelection(view, 0, 4);
    typeText(view, '「');

    expect(runUndo(view)).toBe(true);
    expect(view.state.doc.firstChild?.textContent).toBe('标题');
    expect(runRedo(view)).toBe(true);
    expect(view.state.doc.firstChild?.textContent).toBe('「《标题》」');

    setTextSelection(view, 4);
    typeText(view, '》');

    expect(view.state.doc.firstChild?.textContent).toBe('「《标题》」');
    expect(view.state.selection.$from.parentOffset).toBe(5);

    await editor.destroy();
  });

  it('restores nested empty-pair deletion behavior after redo', async () => {
    const editor = createEditorWithHistory();

    await editor.create();

    const view = getView(editor);
    typeText(view, '((');

    expect(runUndo(view)).toBe(true);
    expect(runRedo(view)).toBe(true);
    expect(view.state.doc.firstChild?.textContent).toBe('(())');

    expect(pressDelete(view)).toBe(true);
    expect(view.state.doc.firstChild?.textContent).toBe('()');
    expect(view.state.selection.$from.parentOffset).toBe(1);

    await editor.destroy();
  });

  it('keeps skip behavior after moving the cursor away and back', async () => {
    const editor = createEditor();

    await editor.create();

    const view = getView(editor);
    typeText(view, '(');

    setTextSelection(view, 2);
    setTextSelection(view, 1);
    typeText(view, ')');

    expect(view.state.doc.firstChild?.textContent).toBe('()');
    expect(view.state.selection.$from.parentOffset).toBe(2);

    await editor.destroy();
  });

  it('keeps tracked closers aligned when text is inserted before the pair', async () => {
    const editor = createEditor();

    await editor.create();

    const view = getView(editor);
    typeText(view, '(');

    setTextSelection(view, 0);
    typeText(view, 'x');

    expect(view.state.doc.firstChild?.textContent).toBe('x()');

    setTextSelection(view, 2);
    typeText(view, ')');

    expect(view.state.doc.firstChild?.textContent).toBe('x()');
    expect(view.state.selection.$from.parentOffset).toBe(3);

    await editor.destroy();
  });

  it('keeps tracked closers aligned when text is inserted before a wrapped range', async () => {
    const editor = createEditor('demo');

    await editor.create();

    const view = getView(editor);
    setTextSelection(view, 0, 4);
    typeText(view, '(');

    setTextSelection(view, 0);
    typeText(view, 'x');

    expect(view.state.doc.firstChild?.textContent).toBe('x(demo)');

    setTextSelection(view, 6);
    typeText(view, ')');

    expect(view.state.doc.firstChild?.textContent).toBe('x(demo)');
    expect(view.state.selection.$from.parentOffset).toBe(7);

    await editor.destroy();
  });

  it('keeps tracked chinese closers aligned when text is inserted before nested pairs', async () => {
    const editor = createEditor();

    await editor.create();

    const view = getView(editor);
    typeText(view, '「');
    typeText(view, '《');
    typeText(view, '标题');
    typeText(view, '》');

    setTextSelection(view, 0);
    typeText(view, '前');

    expect(view.state.doc.firstChild?.textContent).toBe('前「《标题》」');

    setTextSelection(view, 6);
    typeText(view, '」');

    expect(view.state.doc.firstChild?.textContent).toBe('前「《标题》」');
    expect(view.state.selection.$from.parentOffset).toBe(7);

    await editor.destroy();
  });

  it('keeps tracked closers aligned after a multi-character insertion before the auto closer', async () => {
    const editor = createEditor();

    await editor.create();

    const view = getView(editor);
    typeText(view, '(');
    simulateTextInput(view, '输入法');
    typeText(view, ')');

    expect(view.state.doc.firstChild?.textContent).toBe('(输入法)');
    expect(view.state.selection.$from.parentOffset).toBe(5);

    await editor.destroy();
  });

  it('supports layered deletion for nested wrapped chinese pairs after redo', async () => {
    const editor = createEditorWithHistory('标题');

    await editor.create();

    const view = getView(editor);
    setTextSelection(view, 0, 2);
    typeText(view, '《');
    setTextSelection(view, 0, 4);
    typeText(view, '「');

    expect(runUndo(view)).toBe(true);
    expect(runRedo(view)).toBe(true);
    expect(view.state.doc.firstChild?.textContent).toBe('「《标题》」');

    setTextSelection(view, 1, 5);
    deleteSelection(view);

    expect(view.state.doc.firstChild?.textContent).toBe('「」');
    expect(view.state.selection.$from.parentOffset).toBe(1);
    expect(pressDelete(view)).toBe(true);
    expect(view.state.doc.firstChild?.textContent).toBe('');

    await editor.destroy();
  });
});
