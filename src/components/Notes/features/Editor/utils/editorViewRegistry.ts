import type { EditorView } from '@milkdown/kit/prose/view';

let currentEditorView: EditorView | null = null;

export function setCurrentEditorView(view: EditorView | null): void {
  currentEditorView = view;
}

export function getCurrentEditorView(): EditorView | null {
  return currentEditorView;
}
