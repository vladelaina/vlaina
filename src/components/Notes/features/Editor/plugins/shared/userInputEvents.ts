import type { EditorView } from '@milkdown/kit/prose/view';

type UserInputEditorView = Pick<EditorView, 'dom'> | { dom?: { dispatchEvent?: (event: Event) => boolean } };

export function markEditorUserInput(view: UserInputEditorView | null | undefined): void {
  view?.dom?.dispatchEvent?.(new CustomEvent('editor:block-user-input', { bubbles: true }));
}

export function markEditorImageUserInput(view: UserInputEditorView | null | undefined): void {
  view?.dom?.dispatchEvent?.(new CustomEvent('editor:image-user-input', { bubbles: true }));
}
