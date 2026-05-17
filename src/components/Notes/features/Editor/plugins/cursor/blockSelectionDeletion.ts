import { NodeSelection, Selection, TextSelection, type Transaction } from '@milkdown/kit/prose/state';
import type { Node as ProseNode, ResolvedPos } from '@milkdown/kit/prose/model';
import type { EditorView } from '@milkdown/kit/prose/view';
import { buildDeleteRangesForBlockSelection } from './listBlockUtils';
import { normalizeBlockRanges, type BlockRange } from './blockSelectionUtils';

function isCursorTextblock(node: { isTextblock: boolean; type: { name: string } } | null | undefined): boolean {
  return Boolean(node?.isTextblock && node.type.name !== 'code_block');
}

function isHorizontalRule(node: ProseNode | null | undefined): node is ProseNode {
  return node?.type.name === 'hr';
}

function isInsideTable($pos: ResolvedPos): boolean {
  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    const nodeName = $pos.node(depth).type.name;
    if (nodeName === 'table' || nodeName === 'table_row' || nodeName === 'table_cell' || nodeName === 'table_header') {
      return true;
    }
  }
  return false;
}

function findCursorTextSelectionFrom($pos: ResolvedPos, dir: 1 | -1): Selection | null {
  const selection = Selection.findFrom($pos, dir, true);
  if (
    selection instanceof TextSelection
    && isCursorTextblock(selection.$from.parent)
    && !isInsideTable(selection.$from)
  ) {
    return selection;
  }
  return null;
}

function setSelectionAfterBlockDeletion(tr: Transaction, targetPos: number, preferPrevious: boolean): Transaction {
  const docSize = tr.doc.content.size;
  const safePos = Math.max(0, Math.min(targetPos, docSize));
  const $pos = tr.doc.resolve(safePos);
  const paragraphType = tr.doc.type.schema.nodes.paragraph;

  if (preferPrevious) {
    const nodeBefore = $pos.nodeBefore;
    if (isHorizontalRule(nodeBefore)) {
      return tr.setSelection(NodeSelection.create(tr.doc, safePos - nodeBefore.nodeSize));
    }

    const previousSelection = findCursorTextSelectionFrom($pos, -1);
    if (previousSelection) {
      return tr.setSelection(previousSelection);
    }
  }

  if (isCursorTextblock($pos.parent)) {
    return tr.setSelection(TextSelection.create(tr.doc, safePos));
  }

  if (isCursorTextblock($pos.nodeAfter)) {
    return tr.setSelection(TextSelection.create(tr.doc, safePos + 1));
  }

  if (isCursorTextblock($pos.nodeBefore)) {
    return tr.setSelection(Selection.near($pos, -1));
  }

  const nodeAfter = $pos.nodeAfter;
  if (isHorizontalRule(nodeAfter)) {
    return tr.setSelection(NodeSelection.create(tr.doc, safePos));
  }

  const nodeBefore = $pos.nodeBefore;
  if (isHorizontalRule(nodeBefore)) {
    return tr.setSelection(NodeSelection.create(tr.doc, safePos - nodeBefore.nodeSize));
  }

  const nextSelection = findCursorTextSelectionFrom($pos, 1);
  if (nextSelection) {
    return tr.setSelection(nextSelection);
  }

  const previousSelection = findCursorTextSelectionFrom($pos, -1);
  if (previousSelection) {
    return tr.setSelection(previousSelection);
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
  tr = setSelectionAfterBlockDeletion(tr, targetPos, anchorHint > 0);
  tr = applyClearSelectionMeta(tr);
  view.dispatch(tr.scrollIntoView());
  view.focus();
  return true;
}
