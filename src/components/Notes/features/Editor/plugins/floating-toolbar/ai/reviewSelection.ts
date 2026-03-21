import { TextSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';

function isInlineRangeSelection(selection: EditorView['state']['selection'], from: number, to: number) {
  return (
    !selection.empty &&
    selection.from === from &&
    selection.to === to &&
    selection.$from.parent.inlineContent &&
    selection.$to.parent.inlineContent
  );
}

export function ensureReviewSelectionVisible(view: EditorView, from: number, to: number) {
  const maxPos = view.state.doc.content.size;
  const nextFrom = Math.max(0, Math.min(from, maxPos));
  const nextTo = Math.max(nextFrom, Math.min(to, maxPos));
  if (nextFrom === nextTo) {
    return;
  }

  const currentSelection = view.state.selection;
  const hasMatchingSelection = isInlineRangeSelection(currentSelection, nextFrom, nextTo);

  if (!view.hasFocus()) {
    view.focus();
  }

  if (hasMatchingSelection) {
    return;
  }

  view.dispatch(
    view.state.tr
      .setSelection(TextSelection.create(view.state.doc, nextFrom, nextTo))
      .setMeta('addToHistory', false)
  );
}
