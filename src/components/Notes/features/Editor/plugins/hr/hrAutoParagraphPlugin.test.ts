import { describe, expect, it } from 'vitest';
import {
  defaultValueCtx,
  Editor,
  editorViewCtx,
} from '@milkdown/kit/core';
import { NodeSelection, TextSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { commonmark } from '@milkdown/kit/preset/commonmark';

import { handleHorizontalRuleShortcutEnter, hrAutoParagraphPlugin } from './hrAutoParagraphPlugin';

function createEditor(defaultValue = '') {
  return Editor.make()
    .config((ctx) => {
      ctx.set(defaultValueCtx, defaultValue);
    })
    .use(commonmark)
    .use(hrAutoParagraphPlugin);
}

function typeText(view: EditorView, input: string): void {
  for (const text of input) {
    const { from, to } = view.state.selection;
    let handled = false;

    view.someProp('handleTextInput', (handleTextInput: any) => {
      handled = handleTextInput(view, from, to, text) || handled;
    });

    if (!handled) {
      view.dispatch(view.state.tr.insertText(text, from, to));
    }
  }
}

function setTextSelection(view: EditorView, fromOffset: number, toOffset = fromOffset): void {
  view.dispatch(
    view.state.tr.setSelection(
      TextSelection.create(view.state.doc, 1 + fromOffset, 1 + toOffset),
    ),
  );
}

function pressKey(
  view: EditorView,
  key: string,
  options?: {
    altKey?: boolean;
    ctrlKey?: boolean;
    isComposing?: boolean;
    metaKey?: boolean;
    shiftKey?: boolean;
  },
): boolean {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    altKey: options?.altKey,
    ctrlKey: options?.ctrlKey,
    metaKey: options?.metaKey,
    shiftKey: options?.shiftKey,
  });
  if (options?.isComposing) {
    Object.defineProperty(event, 'isComposing', { value: true });
  }

  let handled = false;

  view.someProp('handleKeyDown', (handleKeyDown: any) => {
    if (handled) {
      return handled;
    }
    handled = handleKeyDown(view, event) || handled;
    return handled;
  });

  return handled;
}

function replaceLastParagraphText(view: EditorView, text: string): void {
  let paragraphPos = 0;
  view.state.doc.forEach((_node, offset, index) => {
    if (index === view.state.doc.childCount - 1) {
      paragraphPos = offset;
    }
  });

  const paragraph = view.state.doc.lastChild;
  if (!paragraph) {
    return;
  }

  const from = paragraphPos + 1;
  const to = from + paragraph.content.size;
  const tr = view.state.tr.insertText(text, from, to);
  tr.setSelection(TextSelection.create(tr.doc, from + text.length));
  view.dispatch(tr);
}

function hasHorizontalRule(view: EditorView): boolean {
  for (let index = 0; index < view.state.doc.childCount; index += 1) {
    if (view.state.doc.child(index)?.type.name === 'hr') {
      return true;
    }
  }

  return false;
}

function findHorizontalRulePos(view: EditorView): number | null {
  let foundPos: number | null = null;
  view.state.doc.forEach((node, offset) => {
    if (foundPos === null && node.type.name === 'hr') {
      foundPos = offset;
    }
  });

  return foundPos;
}

describe('hrAutoParagraphPlugin', () => {
  it('keeps --- as plain text until Enter is pressed', async () => {
    const editor = createEditor();

    await editor.create();

    const view = editor.ctx.get(editorViewCtx);

    typeText(view, '---');

    expect(view.state.doc.childCount).toBe(1);
    expect(view.state.doc.firstChild?.type.name).toBe('paragraph');
    expect(view.state.doc.firstChild?.textContent).toBe('---');

    await editor.destroy();
  });

  it('converts a standalone thematic break line on Enter outside the frontmatter slot', async () => {
    const editor = createEditor('before\n\nplaceholder');

    await editor.create();

    const view = editor.ctx.get(editorViewCtx);
    replaceLastParagraphText(view, '---');

    expect(handleHorizontalRuleShortcutEnter(view)).toBe(true);
    expect(view.state.doc.childCount).toBe(3);
    expect(view.state.doc.child(1).type.name).toBe('hr');
    expect(view.state.doc.child(2).type.name).toBe('paragraph');

    await editor.destroy();
  });

  it('converts *** on Enter as a thematic break', async () => {
    const editor = createEditor();

    await editor.create();

    const view = editor.ctx.get(editorViewCtx);
    typeText(view, '***');

    expect(handleHorizontalRuleShortcutEnter(view)).toBe(true);
    expect(view.state.doc.childCount).toBe(2);
    expect(view.state.doc.child(0).type.name).toBe('hr');
    expect(view.state.doc.child(1).type.name).toBe('paragraph');

    await editor.destroy();
  });

  it('converts ___ on Enter as a thematic break', async () => {
    const editor = createEditor();

    await editor.create();

    const view = editor.ctx.get(editorViewCtx);
    typeText(view, '___');

    expect(handleHorizontalRuleShortcutEnter(view)).toBe(true);
    expect(view.state.doc.childCount).toBe(2);
    expect(view.state.doc.child(0).type.name).toBe('hr');
    expect(view.state.doc.child(1).type.name).toBe('paragraph');

    await editor.destroy();
  });

  it('converts spaced thematic break text on Enter', async () => {
    const editor = createEditor();

    await editor.create();

    const view = editor.ctx.get(editorViewCtx);
    replaceLastParagraphText(view, '- - -');

    expect(handleHorizontalRuleShortcutEnter(view)).toBe(true);
    expect(view.state.doc.childCount).toBe(2);
    expect(view.state.doc.child(0).type.name).toBe('hr');
    expect(view.state.doc.child(1).type.name).toBe('paragraph');

    await editor.destroy();
  });

  it('does not convert non-standalone text on Enter', async () => {
    const editor = createEditor();

    await editor.create();

    const view = editor.ctx.get(editorViewCtx);

    typeText(view, '---text---');

    expect(handleHorizontalRuleShortcutEnter(view)).toBe(false);
    expect(view.state.doc.childCount).toBe(1);
    expect(view.state.doc.firstChild?.type.name).toBe('paragraph');
    expect(view.state.doc.firstChild?.textContent).toBe('---text---');

    await editor.destroy();
  });

  it('does not convert --- at the leading frontmatter slot', async () => {
    const editor = createEditor('placeholder');

    await editor.create();

    const view = editor.ctx.get(editorViewCtx);
    replaceLastParagraphText(view, '---');

    expect(handleHorizontalRuleShortcutEnter(view)).toBe(false);
    expect(view.state.doc.childCount).toBe(1);
    expect(view.state.doc.firstChild?.type.name).toBe('paragraph');
    expect(view.state.doc.firstChild?.textContent).toBe('---');

    await editor.destroy();
  });

  it('does not convert when the cursor is not at the end of the line', async () => {
    const editor = createEditor();

    await editor.create();

    const view = editor.ctx.get(editorViewCtx);
    typeText(view, '---');
    setTextSelection(view, 2);

    expect(handleHorizontalRuleShortcutEnter(view)).toBe(false);
    expect(view.state.doc.childCount).toBe(1);
    expect(view.state.doc.firstChild?.type.name).toBe('paragraph');
    expect(view.state.doc.firstChild?.textContent).toBe('---');

    await editor.destroy();
  });

  it('does not convert when a text range is selected', async () => {
    const editor = createEditor();

    await editor.create();

    const view = editor.ctx.get(editorViewCtx);
    typeText(view, '---');
    setTextSelection(view, 0, 3);

    expect(handleHorizontalRuleShortcutEnter(view)).toBe(false);
    expect(view.state.doc.childCount).toBe(1);
    expect(view.state.doc.firstChild?.type.name).toBe('paragraph');
    expect(view.state.doc.firstChild?.textContent).toBe('---');

    await editor.destroy();
  });

  it('does not convert to a thematic break while the user is composing input', async () => {
    const editor = createEditor();

    await editor.create();

    const view = editor.ctx.get(editorViewCtx);
    typeText(view, '---');

    pressKey(view, 'Enter', { isComposing: true });
    expect(hasHorizontalRule(view)).toBe(false);

    await editor.destroy();
  });

  it('does not convert to a thematic break for modified Enter shortcuts', async () => {
    const editor = createEditor();

    await editor.create();

    const view = editor.ctx.get(editorViewCtx);
    typeText(view, '---');

    pressKey(view, 'Enter', { shiftKey: true });
    expect(hasHorizontalRule(view)).toBe(false);

    await editor.destroy();
  });

  it('deletes a selected horizontal rule without leaving the editor focused on the next paragraph', async () => {
    const editor = createEditor('before\n\n---\n\nafter');

    await editor.create();

    const view = editor.ctx.get(editorViewCtx);
    const hrPos = findHorizontalRulePos(view);

    expect(hrPos).not.toBeNull();

    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, hrPos)));

    let blurCalled = false;
    const originalBlur = view.dom.blur.bind(view.dom);
    view.dom.blur = () => {
      blurCalled = true;
      originalBlur();
    };

    expect(pressKey(view, 'Delete')).toBe(true);
    expect(hasHorizontalRule(view)).toBe(false);
    expect(blurCalled).toBe(true);

    view.dom.blur = originalBlur;

    await editor.destroy();
  });
});
