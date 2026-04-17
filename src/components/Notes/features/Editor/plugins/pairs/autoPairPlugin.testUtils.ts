import {
  defaultValueCtx,
  Editor,
  editorViewCtx,
} from '@milkdown/kit/core';
import { history } from '@milkdown/kit/plugin/history';
import { redo, undo } from '@milkdown/kit/prose/history';
import { TextSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { commonmark } from '@milkdown/kit/preset/commonmark';

import { autoPairPlugin } from './autoPairPlugin';
import { clipboardPlugin } from '../clipboard';

export function createEditor(defaultValue = '') {
  return Editor.make()
    .config((ctx) => {
      ctx.set(defaultValueCtx, defaultValue);
    })
    .use(commonmark)
    .use(autoPairPlugin);
}

export function createEditorWithHistory(defaultValue = '') {
  return Editor.make()
    .config((ctx) => {
      ctx.set(defaultValueCtx, defaultValue);
    })
    .use(commonmark)
    .use(history)
    .use(autoPairPlugin);
}

export function createEditorWithClipboard(defaultValue = '') {
  return Editor.make()
    .config((ctx) => {
      ctx.set(defaultValueCtx, defaultValue);
    })
    .use(commonmark)
    .use(clipboardPlugin)
    .use(autoPairPlugin);
}

export function createEditorWithClipboardHistory(defaultValue = '') {
  return Editor.make()
    .config((ctx) => {
      ctx.set(defaultValueCtx, defaultValue);
    })
    .use(commonmark)
    .use(history)
    .use(clipboardPlugin)
    .use(autoPairPlugin);
}

export function getView(editor: { ctx: { get: (key: typeof editorViewCtx) => EditorView } }): EditorView {
  return editor.ctx.get(editorViewCtx);
}

export function simulateTextInput(view: EditorView, text: string): boolean {
  const { from, to } = view.state.selection;
  let handled = false;

  view.someProp('handleTextInput', (handleTextInput: any) => {
    handled = handleTextInput(view, from, to, text) || handled;
  });

  if (!handled) {
    view.dispatch(view.state.tr.insertText(text, from, to));
  }

  return handled;
}

export function typeText(view: EditorView, input: string): void {
  for (const text of input) {
    simulateTextInput(view, text);
  }
}

export function setTextSelection(view: EditorView, fromOffset: number, toOffset = fromOffset): void {
  view.dispatch(
    view.state.tr.setSelection(
      TextSelection.create(view.state.doc, 1 + fromOffset, 1 + toOffset),
    ),
  );
}

export function setAbsoluteSelection(view: EditorView, from: number, to = from): void {
  view.dispatch(
    view.state.tr.setSelection(TextSelection.create(view.state.doc, from, to)),
  );
}

export function pressBackspace(view: EditorView): boolean {
  return pressKey(view, 'Backspace');
}

export function pressDelete(view: EditorView): boolean {
  return pressKey(view, 'Delete');
}

export function pressKey(
  view: EditorView,
  key: 'Backspace' | 'Delete',
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

export function deleteCharBeforeCursor(view: EditorView): void {
  const { from } = view.state.selection;
  view.dispatch(view.state.tr.delete(from - 1, from));
}

export function deleteSelection(view: EditorView): void {
  view.dispatch(view.state.tr.deleteSelection());
}

export function deleteTextRange(view: EditorView, fromOffset: number, toOffset: number): void {
  view.dispatch(view.state.tr.delete(1 + fromOffset, 1 + toOffset));
}

export function replaceSelectionWithText(view: EditorView, text: string): void {
  const { from, to } = view.state.selection;
  view.dispatch(view.state.tr.insertText(text, from, to));
}

export function simulatePasteText(view: EditorView, text: string): boolean {
  const event = {
    clipboardData: {
      getData(type: string) {
        return type === 'text/plain' ? text : '';
      },
    },
    preventDefault() {},
  };

  let handled = false;

  view.someProp('handlePaste', (handlePaste: any) => {
    handled = handlePaste(view, event, null) || handled;
  });

  if (!handled) {
    replaceSelectionWithText(view, text);
  }

  return handled;
}

export function runUndo(view: EditorView): boolean {
  return undo(view.state, view.dispatch);
}

export function runRedo(view: EditorView): boolean {
  return redo(view.state, view.dispatch);
}
