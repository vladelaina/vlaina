import { Selection, TextSelection, type Transaction } from '@milkdown/kit/prose/state';
import type { ResolvedPos } from '@milkdown/kit/prose/model';
import type { EditorView } from '@milkdown/kit/prose/view';
import { buildDeleteRangesForBlockSelection } from './listBlockUtils';
import { normalizeBlockRanges, type BlockRange } from './blockSelectionUtils';
import {
  EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER,
  isMarkdownBlankLinePlaceholderNode,
} from './markdownBlankLineInteraction';
import { markEditorUserInput } from '../shared/userInputEvents';

function isCursorTextblock(node: { isTextblock: boolean; type: { name: string } } | null | undefined): boolean {
  return Boolean(node?.isTextblock && node.type.name !== 'code_block');
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

function setTextSelectionAtBlockTail(tr: Transaction, selection: TextSelection): Transaction {
  return tr.setSelection(TextSelection.create(tr.doc, selection.$from.end()));
}

function findFollowingMarkdownBlankLineBlock(
  tr: Transaction,
  pos: number,
): { from: number; to: number } | null {
  let offset = 0;
  for (let index = 0; index < tr.doc.childCount; index += 1) {
    const node = tr.doc.child(index);
    const from = offset;
    const to = from + node.nodeSize;
    offset = to;

    if (to <= pos) continue;
    if (node.type.name === 'hr') continue;

    return isMarkdownBlankLinePlaceholderNode(node) ? { from, to } : null;
  }
  return null;
}

function setSelectionAtMarkdownBlankLine(tr: Transaction, pos: number): Transaction | null {
  const blankLine = findFollowingMarkdownBlankLineBlock(tr, pos);
  if (!blankLine) return null;

  const paragraphType = tr.doc.type.schema.nodes.paragraph;
  if (!paragraphType) return null;

  const paragraph = paragraphType.create(
    null,
    tr.doc.type.schema.text(EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER),
  );
  tr = tr.replaceWith(blankLine.from, blankLine.to, paragraph);
  return tr.setSelection(
    TextSelection.create(tr.doc, blankLine.from + 1 + EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER.length),
  );
}

function setSelectionAfterBlockDeletion(tr: Transaction, targetPos: number): Transaction {
  const docSize = tr.doc.content.size;
  const safePos = Math.max(0, Math.min(targetPos, docSize));
  const $pos = tr.doc.resolve(safePos);
  const paragraphType = tr.doc.type.schema.nodes.paragraph;
  const nodeAfter = $pos.nodeAfter;
  const nodeBefore = $pos.nodeBefore;

  if (isCursorTextblock($pos.parent)) {
    return tr.setSelection(TextSelection.create(tr.doc, $pos.end()));
  }

  if (nodeAfter && isCursorTextblock(nodeAfter)) {
    return tr.setSelection(TextSelection.create(tr.doc, safePos + 1 + nodeAfter.content.size));
  }

  const markdownBlankLineSelection = setSelectionAtMarkdownBlankLine(tr, safePos);
  if (markdownBlankLineSelection) {
    return markdownBlankLineSelection;
  }

  const nextSelection = findCursorTextSelectionFrom($pos, 1);
  if (nextSelection instanceof TextSelection) {
    return setTextSelectionAtBlockTail(tr, nextSelection);
  }

  if (isCursorTextblock(nodeBefore)) {
    return tr.setSelection(Selection.near($pos, -1));
  }

  const previousSelection = findCursorTextSelectionFrom($pos, -1);
  if (previousSelection) {
    return setTextSelectionAtBlockTail(tr, previousSelection);
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
  markEditorUserInput(view);
  view.dispatch(tr.scrollIntoView());
  view.focus();
  return true;
}
