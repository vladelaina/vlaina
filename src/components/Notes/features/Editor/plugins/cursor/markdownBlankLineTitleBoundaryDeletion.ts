import { Selection, TextSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { focusNoteTitleInputAtEnd } from '../../utils/titleInputDom';
import {
  EDITABLE_LIST_GAP_PLACEHOLDER,
  isInternalListGapPlaceholderNode,
} from '../task-list/listTabIndentPlugin';
import { blankAreaDragBoxPluginKey, CLEAR_BLOCKS_ACTION } from './blockSelectionPluginState';
import {
  createTextSelectionNearDocumentPosition,
  findTopLevelBlockAfter,
  findTopLevelBlockAt,
  findTopLevelBlockBefore,
  isEditableMarkdownBlankLineNode,
  isMarkdownBlankLinePlaceholderNode,
} from './markdownBlankLineShared';

function resolveEditableBlankLineAdjacentBlocks(view: EditorView, direction: -1 | 1) {
  const { selection } = view.state;
  if (!(selection instanceof TextSelection) || !selection.empty) return null;

  const $from = selection.$from;
  if ($from.depth !== 1 || !isEditableMarkdownBlankLineNode($from.parent)) return null;

  const blockFrom = $from.before(1);
  const blockTo = $from.after(1);
  const primaryAdjacent = direction < 0
    ? findTopLevelBlockBefore(view.state.doc, blockFrom)
    : findTopLevelBlockAfter(view.state.doc, blockTo);
  return { blockFrom, blockTo, primaryAdjacent };
}

function handleEditableMarkdownBlankLineAtDocumentStartDelete(view: EditorView): boolean {
  const resolved = resolveEditableBlankLineAdjacentBlocks(view, -1);
  if (!resolved || resolved.blockFrom !== 0) return false;
  if (!focusNoteTitleInputAtEnd()) return false;

  const nextBlock = findTopLevelBlockAfter(view.state.doc, resolved.blockTo);
  if (!nextBlock) return true;

  let tr = view.state.tr
    .delete(resolved.blockFrom, resolved.blockTo)
    .setMeta(blankAreaDragBoxPluginKey, CLEAR_BLOCKS_ACTION);
  const nextSelection = createTextSelectionNearDocumentPosition(tr.doc, 0, 1)
    ?? Selection.near(tr.doc.resolve(0), 1);
  tr = tr.setSelection(nextSelection);
  view.dispatch(tr.scrollIntoView());
  focusNoteTitleInputAtEnd();
  return true;
}

function handleBackspaceAfterDocumentStartMarkdownBlankLine(view: EditorView): boolean {
  const { selection } = view.state;
  if (!(selection instanceof TextSelection) || !selection.empty) return false;

  const { $from } = selection;
  if ($from.parentOffset !== 0) return false;

  const currentBlock = findTopLevelBlockAt(view.state.doc, selection.from);
  if (!currentBlock || currentBlock.from === 0) return false;

  const previousBlock = findTopLevelBlockBefore(view.state.doc, currentBlock.from);
  if (previousBlock?.from !== 0 || !isMarkdownBlankLinePlaceholderNode(previousBlock.node)) {
    return false;
  }

  if (!focusNoteTitleInputAtEnd()) return false;

  let tr = view.state.tr
    .delete(previousBlock.from, previousBlock.to)
    .setMeta(blankAreaDragBoxPluginKey, CLEAR_BLOCKS_ACTION);
  const mappedCurrentBlockFrom = tr.mapping.map(currentBlock.from, -1);
  const nextSelection = Selection.findFrom(
    tr.doc.resolve(Math.max(0, Math.min(mappedCurrentBlockFrom, tr.doc.content.size))),
    1,
    true,
  ) ?? Selection.near(tr.doc.resolve(0), 1);
  tr = tr.setSelection(nextSelection);
  view.dispatch(tr.scrollIntoView());
  focusNoteTitleInputAtEnd();
  return true;
}

function isListGapPlaceholderParagraph(node: { textBetween?: (from: number, to: number, blockSeparator?: string, leafText?: string) => string; content?: { size?: number }; type?: { name?: string } }): boolean {
  return node.type?.name === 'paragraph'
    && node.content?.size === EDITABLE_LIST_GAP_PLACEHOLDER.length
    && node.textBetween?.(0, EDITABLE_LIST_GAP_PLACEHOLDER.length, '\0', '\0') === EDITABLE_LIST_GAP_PLACEHOLDER;
}

function isEmptyDocumentStartListItem(node: { child?: (index: number) => { content?: { size?: number }; type?: { name?: string } }; childCount?: number; type?: { name?: string } }): boolean {
  if (node.type?.name !== 'list_item' || node.childCount !== 1) return false;
  const paragraph = node.child?.(0);
  return paragraph?.type?.name === 'paragraph' && paragraph.content?.size === 0;
}

function handleBackspaceAtDocumentStartListGap(view: EditorView): boolean {
  const { selection } = view.state;
  if (!(selection instanceof TextSelection) || !selection.empty) return false;

  const { $from } = selection;
  if ($from.parentOffset !== 0) return false;

  const currentBlock = findTopLevelBlockAt(view.state.doc, selection.from);
  if (!currentBlock || currentBlock.from !== 0) return false;

  if (
    currentBlock.node.type.name === 'paragraph'
    && isListGapPlaceholderParagraph(currentBlock.node)
    && focusNoteTitleInputAtEnd()
  ) {
    const nextBlock = findTopLevelBlockAfter(view.state.doc, currentBlock.to);
    if (!nextBlock) return true;

    let tr = view.state.tr
      .delete(currentBlock.from, currentBlock.to)
      .setMeta(blankAreaDragBoxPluginKey, CLEAR_BLOCKS_ACTION);
    const nextSelection = createTextSelectionNearDocumentPosition(tr.doc, 0, 1)
      ?? Selection.near(tr.doc.resolve(0), 1);
    tr = tr.setSelection(nextSelection);
    view.dispatch(tr.scrollIntoView());
    focusNoteTitleInputAtEnd();
    return true;
  }

  if (
    (currentBlock.node.type.name !== 'ordered_list' && currentBlock.node.type.name !== 'bullet_list')
    || view.state.doc.childCount !== 1
    || currentBlock.node.childCount !== 1
    || (
      !isInternalListGapPlaceholderNode(currentBlock.node.child(0))
      && !isEmptyDocumentStartListItem(currentBlock.node.child(0))
    )
  ) {
    return false;
  }

  if (!focusNoteTitleInputAtEnd()) return false;

  const paragraphType = view.state.schema.nodes.paragraph;
  if (!paragraphType) return true;

  let tr = view.state.tr
    .replaceWith(currentBlock.from, currentBlock.to, paragraphType.create())
    .setMeta(blankAreaDragBoxPluginKey, CLEAR_BLOCKS_ACTION);
  tr = tr.setSelection(TextSelection.create(tr.doc, 1));
  view.dispatch(tr.scrollIntoView());
  focusNoteTitleInputAtEnd();
  return true;
}

export function handleDocumentStartTitleBoundaryDelete(
  view: EditorView,
  direction: -1 | 1,
): boolean {
  return handleEditableMarkdownBlankLineAtDocumentStartDelete(view)
    || (
      direction < 0
      && (
        handleBackspaceAfterDocumentStartMarkdownBlankLine(view)
        || handleBackspaceAtDocumentStartListGap(view)
      )
    );
}
