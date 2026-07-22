import { Selection, TextSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';

export function collapseSelectionAfterToolbarApply(view: EditorView): void {
  const { selection } = view.state;
  if (selection.empty) {
    view.focus();
    return;
  }

  const tr = view.state.tr;
  const clampedPos = Math.max(0, Math.min(selection.to, tr.doc.content.size));
  const $pos = tr.doc.resolve(clampedPos);

  if ($pos.parent.inlineContent) {
    tr.setSelection(TextSelection.create(tr.doc, clampedPos));
  } else {
    tr.setSelection(Selection.near($pos, -1));
  }

  view.dispatch(tr.setMeta('addToHistory', false));
  view.focus();
}
