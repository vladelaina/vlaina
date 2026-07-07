import { Selection, TextSelection, type EditorState } from '@milkdown/kit/prose/state';
import {
  type Direction,
  type TextSelectionEdge,
  type TopLevelBlock,
  TEXT_CONTAINER_STRUCTURAL_BLOCK_NODE_NAMES,
} from './atomicBlockKeyboardShared';

export function resolveTextSelectionInsideContainerBlock(
  state: EditorState,
  block: TopLevelBlock,
  direction: Direction,
  edge: TextSelectionEdge = direction === 'up' ? 'end' : 'start'
): Selection | null {
  if (!TEXT_CONTAINER_STRUCTURAL_BLOCK_NODE_NAMES.has(block.node.type.name)) {
    return null;
  }

  const boundaryPos = direction === 'up' ? block.to : block.from;
  const selection = Selection.findFrom(
    state.doc.resolve(Math.max(0, Math.min(boundaryPos, state.doc.content.size))),
    direction === 'up' ? -1 : 1,
    true
  );
  if (!(selection instanceof TextSelection)) {
    return selection;
  }

  return TextSelection.create(
    state.doc,
    edge === 'end' ? selection.$from.end() : selection.$from.start()
  );
}

export function resolveTextSelectionAtBlockEdge(
  state: EditorState,
  block: TopLevelBlock,
  direction: Direction,
  edge: TextSelectionEdge = direction === 'up' ? 'end' : 'start'
): Selection | null {
  if (block.node.isTextblock) {
    const cursorPos = edge === 'end'
      ? block.from + 1 + block.node.content.size
      : block.from + 1;
    return TextSelection.create(state.doc, cursorPos);
  }

  return resolveTextSelectionInsideContainerBlock(state, block, direction, edge);
}
