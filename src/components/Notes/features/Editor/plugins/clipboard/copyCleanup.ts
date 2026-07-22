import { Selection, TextSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { floatingToolbarKey } from '../floating-toolbar/floatingToolbarKey';
import { TOOLBAR_ACTIONS } from '../floating-toolbar/types';
import { requestCodeBlockSelectionSync } from '../code/codeBlockSelectionSync';

export function hideFloatingToolbar(view: EditorView): void {
  view.dispatch(
    view.state.tr
      .setMeta(floatingToolbarKey, {
        type: TOOLBAR_ACTIONS.HIDE,
      })
      .setMeta('addToHistory', false)
  );
}

export function collapseSelectionAndHideFloatingToolbar(view: EditorView): void {
  const { state } = view;
  const { selection } = state;
  if (selection.empty) {
    hideFloatingToolbar(view);
    return;
  }

  const nextPos = Math.max(0, Math.min(selection.to, state.doc.content.size));
  let tr = state.tr;

  try {
    const $nextPos = state.doc.resolve(nextPos);
    tr = tr.setSelection(
      $nextPos.parent.inlineContent
        ? TextSelection.create(state.doc, nextPos)
        : Selection.near($nextPos, -1)
    );
  } catch {
  }

  tr = tr
    .setMeta(floatingToolbarKey, {
      type: TOOLBAR_ACTIONS.HIDE,
    })
    .setMeta('addToHistory', false);

  view.dispatch(tr);
  requestCodeBlockSelectionSync(view.dom?.ownerDocument ?? null);
  view.focus();
}
