import { TextSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import {
  isEditableBlankLinePlaceholderNode,
  replaceBlankLinePlaceholderWithEditableParagraph,
} from './markdownBlankLineInteraction';
import {
  type AdjacentContainerBlock,
  type Direction,
  TEXT_CONTAINER_STRUCTURAL_BLOCK_NODE_NAMES,
} from './atomicBlockKeyboardShared';
import { resolveTextSelectionAtBlockEdge } from './atomicBlockTextSelection';

function isSelectionAtTextblockVerticalBoundary(
  view: EditorView,
  selection: TextSelection,
  direction: Direction
): boolean {
  const { $from } = selection;
  if (!$from.parent.isTextblock) {
    return false;
  }

  const blockFrom = $from.before($from.depth);
  const contentStart = blockFrom + 1;
  const contentEnd = contentStart + $from.parent.content.size;
  return direction === 'up'
    ? selection.from === contentStart || Boolean(view.endOfTextblock?.('up'))
    : selection.from === contentEnd || Boolean(view.endOfTextblock?.('down'));
}

function resolveAdjacentBlockInsideTextContainer(
  selection: TextSelection,
  direction: Direction
): AdjacentContainerBlock | null {
  const { $from } = selection;

  for (let blockDepth = $from.depth; blockDepth > 1; blockDepth -= 1) {
    const parentDepth = blockDepth - 1;
    const parent = $from.node(parentDepth);
    if (!TEXT_CONTAINER_STRUCTURAL_BLOCK_NODE_NAMES.has(parent.type.name)) {
      continue;
    }

    const childIndex = $from.index(parentDepth);
    if (direction === 'up') {
      if (childIndex <= 0) {
        continue;
      }

      const node = parent.child(childIndex - 1);
      const to = $from.before(blockDepth);
      return {
        from: to - node.nodeSize,
        to,
        node,
        crossesContainerBoundary: blockDepth < $from.depth,
      };
    }

    if (childIndex >= parent.childCount - 1) {
      continue;
    }

    const node = parent.child(childIndex + 1);
    const from = $from.after(blockDepth);
    return {
      from,
      to: from + node.nodeSize,
      node,
      crossesContainerBoundary: blockDepth < $from.depth,
    };
  }

  return null;
}

export function handleTextContainerSiblingArrow(view: EditorView, direction: Direction): boolean {
  const { selection } = view.state;
  if (!(selection instanceof TextSelection) || !selection.empty) {
    return false;
  }

  if (!isSelectionAtTextblockVerticalBoundary(view, selection, direction)) {
    return false;
  }

  const adjacent = resolveAdjacentBlockInsideTextContainer(selection, direction);
  if (!adjacent) {
    return false;
  }

  if (isEditableBlankLinePlaceholderNode(adjacent.node)) {
    return replaceBlankLinePlaceholderWithEditableParagraph(view, adjacent);
  }

  if (
    !adjacent.crossesContainerBoundary &&
    !TEXT_CONTAINER_STRUCTURAL_BLOCK_NODE_NAMES.has(adjacent.node.type.name)
  ) {
    return false;
  }

  const adjacentSelection = resolveTextSelectionAtBlockEdge(view.state, adjacent, direction, 'end');
  if (!adjacentSelection) {
    return false;
  }

  view.dispatch(
    view.state.tr
      .setSelection(adjacentSelection)
      .scrollIntoView()
  );
  view.focus();
  return true;
}
