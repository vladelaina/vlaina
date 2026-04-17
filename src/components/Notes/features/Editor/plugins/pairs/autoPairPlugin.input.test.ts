import { describe, expect, it, vi } from 'vitest';
import { Selection } from '@milkdown/kit/prose/state';

import {
  createEditor,
  createEditorWithHistory,
  getView,
  runRedo,
  runUndo,
  setAbsoluteSelection,
  setTextSelection,
  simulateTextInput,
  typeText,
} from './autoPairPlugin.testUtils';
import { autoPairSpecs } from './pairSpecs';

const pairCases = autoPairSpecs.map((spec) => [spec.open, spec.close] as const);
const asymmetricPairCases = autoPairSpecs.filter((spec) => !spec.symmetric).map((spec) => [spec.open, spec.close] as const);

describe('autoPairPlugin input', () => {
  it('auto-inserts a matching ascii parenthesis pair', async () => {
    const editor = createEditor();

    await editor.create();

    const view = getView(editor);
    typeText(view, '(');

    expect(view.state.doc.firstChild?.textContent).toBe('()');
    expect(view.state.selection.$from.parentOffset).toBe(1);

    await editor.destroy();
  });

  it('auto-inserts a matching fullwidth bracket pair', async () => {
    const editor = createEditor();

    await editor.create();

    const view = getView(editor);
    typeText(view, '【');

    expect(view.state.doc.firstChild?.textContent).toBe('【】');
    expect(view.state.selection.$from.parentOffset).toBe(1);

    await editor.destroy();
  });

  it('auto-inserts a matching fullwidth quote pair', async () => {
    const editor = createEditor();

    await editor.create();

    const view = getView(editor);
    typeText(view, '“');

    expect(view.state.doc.firstChild?.textContent).toBe('“”');
    expect(view.state.selection.$from.parentOffset).toBe(1);

    await editor.destroy();
  });

  it('auto-inserts a matching ascii quote pair', async () => {
    const editor = createEditor();

    await editor.create();

    const view = getView(editor);
    typeText(view, '"');

    expect(view.state.doc.firstChild?.textContent).toBe('""');
    expect(view.state.selection.$from.parentOffset).toBe(1);

    await editor.destroy();
  });

  it('auto-inserts a matching apostrophe pair at a word boundary', async () => {
    const editor = createEditor();

    await editor.create();

    const view = getView(editor);
    typeText(view, "'");

    expect(view.state.doc.firstChild?.textContent).toBe("''");
    expect(view.state.selection.$from.parentOffset).toBe(1);

    await editor.destroy();
  });


  it.each(pairCases)('auto-pairs and skips the closer for %s%s', async (open, close) => {
    const editor = createEditor();

    await editor.create();

    const view = getView(editor);
    simulateTextInput(view, open);

    expect(view.state.doc.firstChild?.textContent).toBe(open + close);
    expect(view.state.selection.$from.parentOffset).toBe(1);

    simulateTextInput(view, close);

    expect(view.state.doc.firstChild?.textContent).toBe(open + close);
    expect(view.state.selection.$from.parentOffset).toBe(2);

    await editor.destroy();
  });

  it.each(asymmetricPairCases)('delayed second closer still inserts for %s%s', async (open, close) => {
    const editor = createEditor();
    const now = vi.spyOn(performance, 'now');
    let currentTime = 100;
    now.mockImplementation(() => currentTime);

    await editor.create();

    const view = getView(editor);
    simulateTextInput(view, open);
    currentTime = 200;
    simulateTextInput(view, close);
    currentTime = 400;
    simulateTextInput(view, close);

    expect(view.state.doc.firstChild?.textContent).toBe(open + close + close);
    expect(view.state.selection.$from.parentOffset).toBe(3);

    now.mockRestore();
    await editor.destroy();
  });

  it('moves over an existing closing bracket instead of duplicating it', async () => {
    const editor = createEditor();

    await editor.create();

    const view = getView(editor);
    typeText(view, '(');
    typeText(view, ')');

    expect(view.state.doc.firstChild?.textContent).toBe('()');
    expect(view.state.selection.$from.parentOffset).toBe(2);

    await editor.destroy();
  });

  it('does not skip over a manually existing closing bracket', async () => {
    const editor = createEditor(')');

    await editor.create();

    const view = getView(editor);
    setTextSelection(view, 0);
    typeText(view, ')');

    expect(view.state.doc.firstChild?.textContent).toBe('))');
    expect(view.state.selection.$from.parentOffset).toBe(1);

    await editor.destroy();
  });

  it('wraps a text selection with a bracket pair', async () => {
    const editor = createEditor('demo');

    await editor.create();

    const view = getView(editor);
    setTextSelection(view, 0, 4);
    typeText(view, '(');

    expect(view.state.doc.firstChild?.textContent).toBe('(demo)');
    expect(view.state.selection.$from.parentOffset).toBe(6);

    await editor.destroy();
  });

  it('wraps a text selection with a quote pair', async () => {
    const editor = createEditor('demo');

    await editor.create();

    const view = getView(editor);
    setTextSelection(view, 0, 4);
    typeText(view, '“');

    expect(view.state.doc.firstChild?.textContent).toBe('“demo”');
    expect(view.state.selection.$from.parentOffset).toBe(6);

    await editor.destroy();
  });

  it('replaces a non-empty selection when typing a closing bracket', async () => {
    const editor = createEditor('abc');

    await editor.create();

    const view = getView(editor);
    setTextSelection(view, 1, 2);
    typeText(view, ')');

    expect(view.state.doc.firstChild?.textContent).toBe('a)c');
    expect(view.state.selection.$from.parentOffset).toBe(2);

    await editor.destroy();
  });

  it('does not wrap a cross-paragraph selection with a pair', async () => {
    const editor = createEditor('foo\n\nbar');

    await editor.create();

    const view = getView(editor);
    setAbsoluteSelection(view, 2, 8);
    typeText(view, '(');

    expect(view.state.doc.textContent).toContain('(');
    expect(view.state.doc.textContent).not.toContain('()');

    await editor.destroy();
  });

  it('moves over an existing closing quote instead of duplicating it', async () => {
    const editor = createEditor();

    await editor.create();

    const view = getView(editor);
    typeText(view, '“');
    typeText(view, '”');

    expect(view.state.doc.firstChild?.textContent).toBe('“”');
    expect(view.state.selection.$from.parentOffset).toBe(2);

    await editor.destroy();
  });

  it('does not skip over a manually existing closing quote', async () => {
    const editor = createEditor('”');

    await editor.create();

    const view = getView(editor);
    setTextSelection(view, 0);
    typeText(view, '”');

    expect(view.state.doc.firstChild?.textContent).toBe('””');
    expect(view.state.selection.$from.parentOffset).toBe(1);

    await editor.destroy();
  });

  it('keeps typing inside the pair and skips the closing bracket afterwards', async () => {
    const editor = createEditor();

    await editor.create();

    const view = getView(editor);
    typeText(view, '(');
    typeText(view, 'abc');
    typeText(view, ')');

    expect(view.state.doc.firstChild?.textContent).toBe('(abc)');
    expect(view.state.selection.$from.parentOffset).toBe(5);

    await editor.destroy();
  });

  it('supports nested bracket insertion', async () => {
    const editor = createEditor();

    await editor.create();

    const view = getView(editor);
    typeText(view, '((');

    expect(view.state.doc.firstChild?.textContent).toBe('(())');
    expect(view.state.selection.$from.parentOffset).toBe(2);

    await editor.destroy();
  });

  it('supports the common markdown link typing flow', async () => {
    const editor = createEditor();

    await editor.create();

    const view = getView(editor);
    typeText(view, '[');
    typeText(view, 'label');
    typeText(view, ']');
    typeText(view, '(');
    typeText(view, 'url');
    typeText(view, ')');

    expect(view.state.doc.firstChild?.textContent).toBe('[label](url)');
    expect(view.state.selection.$from.parentOffset).toBe(12);

    await editor.destroy();
  });

  it('supports mixed quote and bracket typing flows', async () => {
    const editor = createEditor();

    await editor.create();

    const view = getView(editor);
    typeText(view, '“');
    typeText(view, '(');
    typeText(view, 'text');
    typeText(view, ')');
    typeText(view, '”');

    expect(view.state.doc.firstChild?.textContent).toBe('“(text)”');
    expect(view.state.selection.$from.parentOffset).toBe(8);

    await editor.destroy();
  });

  it('supports nested chinese quote and title mark typing flows', async () => {
    const editor = createEditor();

    await editor.create();

    const view = getView(editor);
    typeText(view, '「');
    typeText(view, '《');
    typeText(view, '标题');
    typeText(view, '》');
    typeText(view, '」');

    expect(view.state.doc.firstChild?.textContent).toBe('「《标题》」');
    expect(view.state.selection.$from.parentOffset).toBe(6);

    await editor.destroy();
  });

  it('supports nested chinese quote and parenthesis typing flows', async () => {
    const editor = createEditor();

    await editor.create();

    const view = getView(editor);
    typeText(view, '（');
    typeText(view, '“');
    typeText(view, '引用');
    typeText(view, '”');
    typeText(view, '）');

    expect(view.state.doc.firstChild?.textContent).toBe('（“引用”）');
    expect(view.state.selection.$from.parentOffset).toBe(6);

    await editor.destroy();
  });

  it('supports markdown link title typing with quote auto-pairing', async () => {
    const editor = createEditor();

    await editor.create();

    const view = getView(editor);
    typeText(view, '[');
    typeText(view, 'label');
    typeText(view, ']');
    typeText(view, '(');
    typeText(view, 'url');
    typeText(view, ' ');
    typeText(view, '"');
    typeText(view, 'title');
    typeText(view, '"');
    typeText(view, ')');

    expect(view.state.doc.firstChild?.textContent).toBe('[label](url "title")');
    expect(view.state.selection.$from.parentOffset).toBe(20);

    await editor.destroy();
  });

  it('does not auto-pair apostrophes inside a word', async () => {
    const editor = createEditor('cant');

    await editor.create();

    const view = getView(editor);
    view.dispatch(view.state.tr.setSelection(Selection.near(view.state.doc.resolve(4))));
    typeText(view, "'");

    expect(view.state.doc.firstChild?.textContent).toBe("can't");
    expect(view.state.selection.$from.parentOffset).toBe(4);

    await editor.destroy();
  });

  it('does not auto-pair double quotes after a word', async () => {
    const editor = createEditor('foo');

    await editor.create();

    const view = getView(editor);
    view.dispatch(view.state.tr.setSelection(Selection.atEnd(view.state.doc)));
    typeText(view, '"');

    expect(view.state.doc.firstChild?.textContent).toBe('foo"');
    expect(view.state.selection.$from.parentOffset).toBe(4);

    await editor.destroy();
  });

  it('does not auto-pair double quotes after a chinese word', async () => {
    const editor = createEditor('标题');

    await editor.create();

    const view = getView(editor);
    view.dispatch(view.state.tr.setSelection(Selection.atEnd(view.state.doc)));
    typeText(view, '"');

    expect(view.state.doc.firstChild?.textContent).toBe('标题"');
    expect(view.state.selection.$from.parentOffset).toBe(3);

    await editor.destroy();
  });

  it('keeps the closing bracket tracked after a multi-character composition commit', async () => {
    const editor = createEditor();

    await editor.create();

    const view = getView(editor);
    typeText(view, '(');
    simulateTextInput(view, '标题');
    typeText(view, ')');

    expect(view.state.doc.firstChild?.textContent).toBe('(标题)');
    expect(view.state.selection.$from.parentOffset).toBe(4);

    await editor.destroy();
  });

  it('falls back to plain insertion when multiple characters are committed at once', async () => {
    const editor = createEditor();

    await editor.create();

    const view = getView(editor);
    simulateTextInput(view, '()');

    expect(view.state.doc.firstChild?.textContent).toBe('()');
    expect(view.state.selection.$from.parentOffset).toBe(2);

    await editor.destroy();
  });

  it('keeps mobile-style repeated fullwidth commits as plain insertion when no auto closer is tracked', async () => {
    const editor = createEditor();

    await editor.create();

    const view = getView(editor);
    simulateTextInput(view, '（）');
    simulateTextInput(view, '）');

    expect(view.state.doc.firstChild?.textContent).toBe('（））');
    expect(view.state.selection.$from.parentOffset).toBe(3);

    await editor.destroy();
  });

  it('keeps the tracked closer usable after a multi-character commit inside chinese pairs', async () => {
    const editor = createEditor();

    await editor.create();

    const view = getView(editor);
    typeText(view, '「');
    simulateTextInput(view, '引用内容');
    typeText(view, '」');

    expect(view.state.doc.firstChild?.textContent).toBe('「引用内容」');
    expect(view.state.selection.$from.parentOffset).toBe(6);

    await editor.destroy();
  });

  it('keeps closing skip behavior after moving the cursor away and back before a multi-character commit', async () => {
    const editor = createEditor();

    await editor.create();

    const view = getView(editor);
    typeText(view, '(');
    setTextSelection(view, 2);
    setTextSelection(view, 1);
    simulateTextInput(view, '标题');
    typeText(view, ')');

    expect(view.state.doc.firstChild?.textContent).toBe('(标题)');
    expect(view.state.selection.$from.parentOffset).toBe(4);

    await editor.destroy();
  });

  it('keeps closing skip behavior after redo and a multi-character commit inside a wrapped pair', async () => {
    const editor = createEditorWithHistory('demo');

    await editor.create();

    const view = getView(editor);
    setTextSelection(view, 0, 4);
    typeText(view, '（');

    expect(runUndo(view)).toBe(true);
    expect(runRedo(view)).toBe(true);

    setTextSelection(view, 1, 5);
    simulateTextInput(view, '标题');
    typeText(view, '）');

    expect(view.state.doc.firstChild?.textContent).toBe('（标题）');
    expect(view.state.selection.$from.parentOffset).toBe(4);

    await editor.destroy();
  });


  it.each(autoPairSpecs)(
    'suppresses an immediate duplicate closing input for $open$close',
    async ({ open, close }) => {
      const editor = createEditor();
      const now = vi.spyOn(performance, 'now');
      let currentTime = 100;
      now.mockImplementation(() => currentTime);

      await editor.create();

      const view = getView(editor);
      simulateTextInput(view, open);
      currentTime = 200;
      simulateTextInput(view, close);

      expect(view.state.doc.firstChild?.textContent).toBe(open + close);
      expect(view.state.selection.$from.parentOffset).toBe(2);

      currentTime = 210;
      simulateTextInput(view, close);

      expect(view.state.doc.firstChild?.textContent).toBe(open + close);
      expect(view.state.selection.$from.parentOffset).toBe(2);

      now.mockRestore();
      await editor.destroy();
    },
  );

  it('allows a real second closing bracket after the duplicate-input guard window', async () => {
    const editor = createEditor();
    const now = vi.spyOn(performance, 'now');
    let currentTime = 100;
    now.mockImplementation(() => currentTime);

    await editor.create();

    const view = getView(editor);
    simulateTextInput(view, '（');
    currentTime = 200;
    simulateTextInput(view, '）');
    currentTime = 400;
    simulateTextInput(view, '）');

    expect(view.state.doc.firstChild?.textContent).toBe('（））');
    expect(view.state.selection.$from.parentOffset).toBe(3);

    now.mockRestore();
    await editor.destroy();
  });
});
