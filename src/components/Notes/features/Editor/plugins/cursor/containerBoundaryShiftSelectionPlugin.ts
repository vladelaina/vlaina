import { $prose } from '@milkdown/kit/utils';
import type { Node as ProseNode, ResolvedPos } from '@milkdown/kit/prose/model';
import { Plugin, TextSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';

type ShiftSelectionDirection = 'up' | 'down';

type TextblockBoundary = {
  contentEnd: number;
  contentStart: number;
  rootIndex: number;
  $pos: ResolvedPos;
};

function getShiftSelectionDirection(event: KeyboardEvent): ShiftSelectionDirection | null {
  if (!event.shiftKey || event.metaKey || event.ctrlKey || event.altKey || event.isComposing) {
    return null;
  }

  if (event.key === 'ArrowUp') return 'up';
  if (event.key === 'ArrowDown') return 'down';
  return null;
}

function getTopLevelTextblockBoundary(view: EditorView, pos: number): TextblockBoundary | null {
  const $pos = view.state.doc.resolve(pos);
  if ($pos.depth !== 1 || !$pos.parent.isTextblock) {
    return null;
  }

  const blockStart = $pos.before(1);
  return {
    $pos,
    contentStart: blockStart + 1,
    contentEnd: blockStart + 1 + $pos.parent.content.size,
    rootIndex: $pos.index(0),
  };
}

function isSameTopLevelTextblock(view: EditorView, firstPos: number, secondPos: number): boolean {
  const first = getTopLevelTextblockBoundary(view, firstPos);
  const second = getTopLevelTextblockBoundary(view, secondPos);
  return Boolean(first && second && first.contentStart === second.contentStart && first.contentEnd === second.contentEnd);
}

function isContainerBlock(node: ProseNode | null | undefined): boolean {
  return Boolean(node && !node.isTextblock && !node.isAtom && node.content.size > 0);
}

function hasAdjacentContainerBlock(
  view: EditorView,
  boundary: TextblockBoundary,
  direction: ShiftSelectionDirection
): boolean {
  const adjacentIndex = direction === 'up' ? boundary.rootIndex - 1 : boundary.rootIndex + 1;
  if (adjacentIndex < 0 || adjacentIndex >= view.state.doc.childCount) {
    return false;
  }

  return isContainerBlock(view.state.doc.child(adjacentIndex));
}

function isAtVisualTextblockBoundary(
  view: EditorView,
  direction: ShiftSelectionDirection,
  boundary: TextblockBoundary
): boolean {
  const targetPos = direction === 'up' ? boundary.contentStart : boundary.contentEnd;
  if (boundary.$pos.pos === targetPos) {
    return true;
  }

  if (typeof view.endOfTextblock !== 'function') {
    return direction === 'up'
      ? boundary.$pos.parentOffset === 0
      : boundary.$pos.parentOffset === boundary.$pos.parent.content.size;
  }

  return view.endOfTextblock(direction);
}

export function handleContainerBoundaryShiftSelection(view: EditorView, event: KeyboardEvent): boolean {
  const direction = getShiftSelectionDirection(event);
  if (!direction) {
    return false;
  }

  const { selection } = view.state;
  if (!(selection instanceof TextSelection)) {
    return false;
  }

  if (!selection.empty && !isSameTopLevelTextblock(view, selection.anchor, selection.head)) {
    return false;
  }

  const boundary = getTopLevelTextblockBoundary(view, selection.head);
  if (!boundary || !hasAdjacentContainerBlock(view, boundary, direction)) {
    return false;
  }

  const targetPos = direction === 'up' ? boundary.contentStart : boundary.contentEnd;
  if (!selection.empty && selection.head === targetPos) {
    return false;
  }

  if (!isAtVisualTextblockBoundary(view, direction, boundary)) {
    return false;
  }

  event.preventDefault();
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, selection.anchor, targetPos)));
  return true;
}

export const containerBoundaryShiftSelectionPlugin = $prose(() => {
  return new Plugin({
    props: {
      handleKeyDown(view, event) {
        return handleContainerBoundaryShiftSelection(view, event);
      },
    },
  });
});
