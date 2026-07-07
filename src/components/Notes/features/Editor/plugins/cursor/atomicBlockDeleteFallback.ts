import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import { Selection, TextSelection, type Transaction } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import type { AdjacentEmptyParagraphDeleteRange } from '../shared/emptyParagraphNearBlockDeletion';
import {
  EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER,
  isMarkdownBlankLinePlaceholderNode,
} from './markdownBlankLineInteraction';
import {
  TEXT_CONTAINER_STRUCTURAL_BLOCK_NODE_NAMES,
  findTopLevelBlockAwayFromDeletedEmptyParagraph,
  setTransientInputParagraphSelection,
} from './atomicBlockKeyboardShared';

function createSafeSelectionAfterStructuralGapDelete(
  state: EditorView['state'],
  tr: Transaction,
  range: AdjacentEmptyParagraphDeleteRange,
  mappedBlockFrom: number,
  block: ProseNode
): Transaction | null {
  const blockTo = mappedBlockFrom + block.nodeSize;
  const boundaryPos = range.searchDir < 0 ? blockTo : mappedBlockFrom;
  const textSelection = Selection.findFrom(
    tr.doc.resolve(Math.max(0, Math.min(boundaryPos, tr.doc.content.size))),
    range.searchDir < 0 ? -1 : 1,
    true
  ) ?? Selection.findFrom(
    tr.doc.resolve(Math.max(0, Math.min(boundaryPos, tr.doc.content.size))),
    range.searchDir < 0 ? 1 : -1,
    true
  );
  if (textSelection instanceof TextSelection) {
    return tr.setSelection(textSelection);
  }

  return setTransientInputParagraphSelection(state, tr, boundaryPos);
}

export function dispatchDefaultStructuralGapDelete(
  view: EditorView,
  tr: Transaction,
  range: AdjacentEmptyParagraphDeleteRange,
  mappedBlockFrom: number,
  nextNode: ProseNode | null,
): void {
  if (nextNode && TEXT_CONTAINER_STRUCTURAL_BLOCK_NODE_NAMES.has(nextNode.type.name)) {
    const blockTo = mappedBlockFrom + nextNode.nodeSize;
    const adjacentSelection = range.searchDir < 0
      ? Selection.findFrom(tr.doc.resolve(blockTo), -1, true)
      : Selection.findFrom(tr.doc.resolve(mappedBlockFrom), 1, true);

    view.dispatch((adjacentSelection ? tr.setSelection(adjacentSelection) : tr).scrollIntoView());
    view.focus();
    return;
  }

  if (nextNode) {
    const blockTo = mappedBlockFrom + nextNode.nodeSize;
    const adjacentAwayFromBlock = findTopLevelBlockAwayFromDeletedEmptyParagraph(
      tr.doc,
      range,
      mappedBlockFrom,
      nextNode
    );
    const adjacentSelection = adjacentAwayFromBlock?.node.type.name === 'paragraph'
      ? Selection.findFrom(
        tr.doc.resolve(range.searchDir < 0 ? blockTo : mappedBlockFrom),
        range.searchDir < 0 ? 1 : -1,
        true
      )
      : null;

    if (adjacentSelection instanceof TextSelection) {
      view.dispatch(tr.setSelection(adjacentSelection).scrollIntoView());
      view.focus();
      return;
    }

    if (adjacentAwayFromBlock && isMarkdownBlankLinePlaceholderNode(adjacentAwayFromBlock.node)) {
      const paragraphType = view.state.schema.nodes.paragraph;
      if (paragraphType) {
        const paragraph = paragraphType.create(
          null,
          view.state.schema.text(EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER)
        );
        tr = tr.replaceWith(adjacentAwayFromBlock.from, adjacentAwayFromBlock.to, paragraph);
        view.dispatch(
          tr
            .setSelection(TextSelection.create(
              tr.doc,
              adjacentAwayFromBlock.from + 1 + EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER.length
            ))
            .scrollIntoView()
        );
        view.focus();
        return;
      }
    }

    const safeSelectionTr = createSafeSelectionAfterStructuralGapDelete(
      view.state,
      tr,
      range,
      mappedBlockFrom,
      nextNode
    );
    if (safeSelectionTr) {
      view.dispatch(safeSelectionTr.scrollIntoView());
      view.focus();
      return;
    }
  }

  const nextSelection = Selection.findFrom(
    tr.doc.resolve(Math.max(0, Math.min(mappedBlockFrom, tr.doc.content.size))),
    range.searchDir,
    true
  );

  view.dispatch((nextSelection instanceof TextSelection ? tr.setSelection(nextSelection) : tr).scrollIntoView());
  view.focus();
}
