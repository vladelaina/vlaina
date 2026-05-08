import { Selection, TextSelection, type Transaction } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { buildDeleteRangesForBlockSelection } from './listBlockUtils';
import { normalizeBlockRanges, type BlockRange } from './blockSelectionUtils';

function refocusEditorAfterBlockDeletion(view: EditorView): void {
  view.focus();

  const ownerWindow = view.dom.ownerDocument.defaultView;
  if (!ownerWindow) {
    return;
  }

  ownerWindow.requestAnimationFrame(() => {
    view.focus();
  });
}

function setSelectionAfterBlockDeletion(tr: Transaction, targetPos: number): Transaction {
  const docSize = tr.doc.content.size;
  const safePos = Math.max(0, Math.min(targetPos, docSize));
  const $pos = tr.doc.resolve(safePos);
  const paragraphType = tr.doc.type.schema.nodes.paragraph;

  if ($pos.parent.isTextblock) {
    return tr.setSelection(TextSelection.create(tr.doc, safePos));
  }

  if ($pos.nodeAfter?.isTextblock) {
    return tr.setSelection(TextSelection.create(tr.doc, safePos + 1));
  }

  if ($pos.nodeBefore?.isTextblock) {
    return tr.setSelection(Selection.near($pos, -1));
  }

  if (paragraphType) {
    tr = tr.insert(safePos, paragraphType.create());
    return tr.setSelection(TextSelection.create(tr.doc, safePos + 1));
  }

  return tr.setSelection(Selection.near($pos, 1));
}

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
  tr = setSelectionAfterBlockDeletion(tr, targetPos);
  tr = applyClearSelectionMeta(tr);
  view.dispatch(tr.scrollIntoView());
  refocusEditorAfterBlockDeletion(view);
  return true;
}
