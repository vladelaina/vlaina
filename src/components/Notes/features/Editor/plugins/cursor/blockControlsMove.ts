import { Selection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import type { BlockRange } from './blockSelectionUtils';
import { prepareBlockMove, resolveBlockMoveContext } from './blockControlsMoveCore';

export function canApplyBlockMove(view: EditorView, selectedRanges: readonly BlockRange[], insertPos: number): boolean {
  const moveContext = resolveBlockMoveContext(view, selectedRanges, insertPos);
  if (!moveContext) return false;
  return prepareBlockMove(view, moveContext) !== null;
}

export function applyBlockMove(view: EditorView, selectedRanges: readonly BlockRange[], insertPos: number): boolean {
  const moveContext = resolveBlockMoveContext(view, selectedRanges, insertPos);
  if (!moveContext) return false;

  try {
    const preparedMove = prepareBlockMove(view, moveContext);
    if (!preparedMove) return false;

    let tr = preparedMove.tr.insert(preparedMove.targetPos, preparedMove.movedContent);
    const selectionAnchor = Math.max(0, Math.min(preparedMove.targetPos + 1, tr.doc.content.size));
    tr = tr.setSelection(Selection.near(tr.doc.resolve(selectionAnchor), 1)).scrollIntoView();
    view.dispatch(tr);
    view.focus();
    return true;
  } catch {
    return false;
  }
}
