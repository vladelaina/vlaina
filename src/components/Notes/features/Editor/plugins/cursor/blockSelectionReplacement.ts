import { Selection, type Transaction } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import {
  blankAreaDragBoxPluginKey,
  CLEAR_BLOCKS_ACTION,
  getBlockSelectionPluginState,
} from './blockSelectionPluginState';
import { buildDeleteRangesForBlockSelection } from './listBlockUtils';

export function replaceVisibleBlockSelectionWithCursor(view: EditorView, tr: Transaction = view.state.tr): Transaction {
  const { selectedBlocks } = getBlockSelectionPluginState(view.state);
  if (selectedBlocks.length === 0) {
    return tr;
  }

  const deleteRanges = buildDeleteRangesForBlockSelection(view.state, selectedBlocks);
  if (deleteRanges.length === 0) {
    return tr;
  }

  const anchorHint = deleteRanges[0].from;
  for (let index = deleteRanges.length - 1; index >= 0; index -= 1) {
    tr = tr.delete(deleteRanges[index].from, deleteRanges[index].to);
  }

  if (tr.doc.content.size === 0) {
    const paragraphType = tr.doc.type.schema.nodes.paragraph;
    if (paragraphType) {
      tr = tr.insert(0, paragraphType.create());
    }
  }

  const safePos = Math.max(0, Math.min(anchorHint, tr.doc.content.size));
  return tr
    .setSelection(Selection.near(tr.doc.resolve(safePos), 1))
    .setMeta(blankAreaDragBoxPluginKey, CLEAR_BLOCKS_ACTION);
}

export function dispatchReplaceVisibleBlockSelectionWithCursor(view: EditorView): boolean {
  const tr = replaceVisibleBlockSelectionWithCursor(view);
  if (!tr.docChanged) {
    return false;
  }

  view.dispatch(tr);
  return true;
}
