import { Selection, type Transaction } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { buildDeleteRangesForBlockSelection } from './listBlockUtils';
import { normalizeBlockRanges, type BlockRange } from './blockSelectionUtils';

export function deleteSelectedBlocks(
  view: EditorView,
  blocks: readonly BlockRange[],
  applyClearSelectionMeta: (tr: Transaction) => Transaction,
): boolean {
  const normalized = normalizeBlockRanges(blocks);
  if (normalized.length === 0) return false;

  const deleteRanges = buildDeleteRangesForBlockSelection(view.state, normalized);
  if (deleteRanges.length === 0) return false;

  const anchorHint = deleteRanges[0].from;
  let tr = view.state.tr;
  for (let i = deleteRanges.length - 1; i >= 0; i -= 1) {
    tr = tr.delete(deleteRanges[i].from, deleteRanges[i].to);
  }

  if (tr.doc.content.size === 0) {
    const paragraphType = tr.doc.type.schema.nodes.paragraph;
    if (paragraphType) {
      tr = tr.insert(0, paragraphType.create());
    }
  }

  const targetPos = Math.max(0, Math.min(anchorHint, tr.doc.content.size));
  tr = tr.setSelection(Selection.near(tr.doc.resolve(targetPos), -1));
  tr = applyClearSelectionMeta(tr);
  view.dispatch(tr.scrollIntoView());
  view.dom.blur();
  return true;
}
