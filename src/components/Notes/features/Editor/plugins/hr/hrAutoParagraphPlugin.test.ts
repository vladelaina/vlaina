import { describe, expect, it } from 'vitest';
import {
  defaultValueCtx,
  Editor,
  editorViewCtx,
} from '@milkdown/kit/core';
import { Selection, TextSelection } from '@milkdown/kit/prose/state';
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

function setSelectionToDocumentEnd(view: EditorView): void {
  view.dispatch(view.state.tr.setSelection(Selection.atEnd(view.state.doc)));
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
});
