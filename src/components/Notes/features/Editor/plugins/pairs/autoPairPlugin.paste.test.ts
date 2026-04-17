import { describe, expect, it } from 'vitest';
import { Selection } from '@milkdown/kit/prose/state';

import {
  createEditorWithClipboard,
  createEditorWithClipboardHistory,
  getView,
  runRedo,
  runUndo,
  setTextSelection,
  simulatePasteText,
  typeText,
} from './autoPairPlugin.testUtils';

describe('autoPairPlugin paste flows', () => {
  it('keeps the closing bracket tracked after a real plain-text paste inside an auto pair', async () => {
    const editor = createEditorWithClipboard();

    await editor.create();

    const view = getView(editor);
    typeText(view, '(');
    simulatePasteText(view, 'pasted');
    typeText(view, ')');

    expect(view.state.doc.firstChild?.textContent).toBe('(pasted)');
    expect(view.state.selection.$from.parentOffset).toBe(8);

    await editor.destroy();
  });

  it('keeps the outer wrapped closer tracked after a real paste replaces the wrapped content', async () => {
    const editor = createEditorWithClipboard('demo');

    await editor.create();

    const view = getView(editor);
    setTextSelection(view, 0, 4);
    typeText(view, '(');
    setTextSelection(view, 1, 5);
    simulatePasteText(view, 'pasted');
    setTextSelection(view, 7);
    typeText(view, ')');

    expect(view.state.doc.firstChild?.textContent).toBe('(pasted)');
    expect(view.state.selection.$from.parentOffset).toBe(8);

    await editor.destroy();
  });

  it('keeps tracked chinese closers aligned after a real paste before nested pairs', async () => {
    const editor = createEditorWithClipboard();

    await editor.create();

    const view = getView(editor);
    typeText(view, '「');
    typeText(view, '《');
    typeText(view, '标题');
    typeText(view, '》');
    setTextSelection(view, 0);
    simulatePasteText(view, '前缀');
    setTextSelection(view, 7);
    typeText(view, '」');

    expect(view.state.doc.firstChild?.textContent).toBe('前缀「《标题》」');
    expect(view.state.selection.$from.parentOffset).toBe(8);

    await editor.destroy();
  });

  it('restores closer skip behavior after redo when real paste changed the pair contents', async () => {
    const editor = createEditorWithClipboardHistory();

    await editor.create();

    const view = getView(editor);
    typeText(view, '(');
    simulatePasteText(view, 'pasted');

    expect(runUndo(view)).toBe(true);
    expect(runRedo(view)).toBe(true);

    setTextSelection(view, 7);
    typeText(view, ')');

    expect(view.state.doc.firstChild?.textContent).toBe('(pasted)');
    expect(view.state.selection.$from.parentOffset).toBe(8);

    await editor.destroy();
  });

  it('preserves the surrounding pair structure after markdown emphasis paste', async () => {
    const editor = createEditorWithClipboard();

    await editor.create();

    const view = getView(editor);
    typeText(view, '(');
    expect(simulatePasteText(view, '**bold**')).toBe(true);

    expect(view.state.doc.textContent).toBe('(bold)');
    expect(view.state.doc.childCount).toBe(1);
    expect(view.state.doc.textContent.split(')').length - 1).toBe(1);

    await editor.destroy();
  });

  it('keeps closing skip behavior after markdown emphasis paste inside an auto pair', async () => {
    const editor = createEditorWithClipboard();

    await editor.create();

    const view = getView(editor);
    typeText(view, '(');
    expect(simulatePasteText(view, '**bold**')).toBe(true);
    typeText(view, ')');

    expect(view.state.doc.textContent).toBe('(bold)');
    expect(view.state.selection.$from.parentOffset).toBe(6);

    await editor.destroy();
  });

  it('preserves the surrounding pair structure after markdown link paste inside an auto pair', async () => {
    const editor = createEditorWithClipboard();

    await editor.create();

    const view = getView(editor);
    typeText(view, '(');
    expect(simulatePasteText(view, '[label](https://example.com)')).toBe(true);

    expect(view.state.doc.textContent).toBe('(label)');
    expect(view.state.doc.childCount).toBe(1);
    expect(view.state.doc.textContent.split(')').length - 1).toBe(1);

    await editor.destroy();
  });

  it('keeps closing skip behavior after markdown link paste inside an auto pair', async () => {
    const editor = createEditorWithClipboard();

    await editor.create();

    const view = getView(editor);
    typeText(view, '(');
    expect(simulatePasteText(view, '[label](https://example.com)')).toBe(true);
    typeText(view, ')');

    expect(view.state.doc.textContent).toBe('(label)');
    expect(view.state.selection.$from.parentOffset).toBe(7);

    await editor.destroy();
  });

  it('supports auto-pairing after markdown blockquote paste moved the cursor into the pasted block', async () => {
    const editor = createEditorWithClipboard();

    await editor.create();

    const view = getView(editor);
    expect(simulatePasteText(view, '> quote')).toBe(true);
    typeText(view, '(');
    typeText(view, ')');

    expect(view.state.doc.textContent).toBe('quote()');
    expect(view.state.selection.$from.parentOffset).toBe(7);

    await editor.destroy();
  });

  it('supports chinese auto-pairing after marked blockquote paste', async () => {
    const editor = createEditorWithClipboard();

    await editor.create();

    const view = getView(editor);
    expect(simulatePasteText(view, '> **quote**')).toBe(true);
    typeText(view, '「');
    typeText(view, '」');

    expect(view.state.doc.textContent).toBe('quote「」');
    expect(view.state.selection.$from.parentOffset).toBe(7);

    await editor.destroy();
  });

  it('preserves the surrounding pair structure after nested blockquote list paste inside an auto pair', async () => {
    const editor = createEditorWithClipboard();

    await editor.create();

    const view = getView(editor);
    typeText(view, '(');
    expect(simulatePasteText(view, '> - **child**')).toBe(true);

    expect(view.state.doc.textContent).toBe('(child)');
    expect(view.state.doc.textContent.split(')').length - 1).toBe(1);

    await editor.destroy();
  });

  it('supports auto-pairing after markdown list paste moved the cursor into the pasted item', async () => {
    const editor = createEditorWithClipboard();

    await editor.create();

    const view = getView(editor);
    expect(simulatePasteText(view, '- item')).toBe(true);
    typeText(view, '「');
    typeText(view, '」');

    expect(view.state.doc.textContent).toBe('item「」');
    expect(view.state.selection.$from.parentOffset).toBe(6);

    await editor.destroy();
  });

  it('supports auto-pairing after nested markdown list paste moved the cursor into the deepest item', async () => {
    const editor = createEditorWithClipboard();

    await editor.create();

    const view = getView(editor);
    expect(simulatePasteText(view, '- parent\n  - child')).toBe(true);
    typeText(view, '(');
    typeText(view, ')');

    expect(view.state.doc.textContent).toBe('parentchild()');
    expect(view.state.selection.$from.parentOffset).toBe(7);

    await editor.destroy();
  });

  it('supports auto-pairing after markdown list item with link paste', async () => {
    const editor = createEditorWithClipboard();

    await editor.create();

    const view = getView(editor);
    expect(simulatePasteText(view, '- [label](https://example.com)')).toBe(true);
    typeText(view, '《');
    typeText(view, '》');

    expect(view.state.doc.textContent).toBe('label《》');
    expect(view.state.selection.$from.parentOffset).toBe(7);

    await editor.destroy();
  });

  it('supports auto-pairing after nested markdown list item with blockquote paste', async () => {
    const editor = createEditorWithClipboard();

    await editor.create();

    const view = getView(editor);
    expect(simulatePasteText(view, '- parent\n  > quote')).toBe(true);
    typeText(view, '（');
    typeText(view, '）');

    expect(view.state.doc.textContent).toBe('parentquote（）');
    expect(view.state.selection.$from.parentOffset).toBe(7);

    await editor.destroy();
  });

  it('treats repeated mobile-style closing input as plain insertion after a structural markdown paste', async () => {
    const editor = createEditorWithClipboard();

    await editor.create();

    const view = getView(editor);
    expect(simulatePasteText(view, '> quote')).toBe(true);
    view.dispatch(view.state.tr.setSelection(Selection.atEnd(view.state.doc)));
    typeText(view, '）');

    expect(view.state.doc.textContent).toBe('quote）');
    expect(view.state.selection.$from.parentOffset).toBe(6);

    await editor.destroy();
  });
});
