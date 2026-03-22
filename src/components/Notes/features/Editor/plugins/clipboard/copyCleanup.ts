import { Selection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { floatingToolbarKey } from '../floating-toolbar/floatingToolbarPlugin';
import { TOOLBAR_ACTIONS } from '../floating-toolbar/types';

export function collapseSelectionAndHideFloatingToolbar(view: EditorView): void {
  const { state } = view;
  const { selection } = state;
  if (selection.empty) {
    return;
  }

  const nextPos = Math.max(0, Math.min(selection.to, state.doc.content.size));
  let tr = state.tr;

  try {
    tr = tr.setSelection(Selection.near(state.doc.resolve(nextPos), -1));
  } catch {
  }

  tr = tr.setMeta(floatingToolbarKey, {
    type: TOOLBAR_ACTIONS.HIDE,
  });

  view.dispatch(tr);
  view.focus();
}
