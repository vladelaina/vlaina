import type { EditorView } from '@milkdown/kit/prose/view';
import type { PointerCaretTarget } from './textSelectionOverlayViewTypes';

export function getDomCaretTarget(
  view: EditorView,
  target: PointerCaretTarget
): PointerCaretTarget | null {
  if (target.node && target.offset !== undefined && view.dom.contains(target.node)) {
    return target;
  }

  try {
    const nextPos = Math.max(0, Math.min(view.state.doc.content.size, target.pos));
    const domTarget = view.domAtPos(nextPos);
    if (domTarget.node !== view.dom && !view.dom.contains(domTarget.node)) {
      return null;
    }

    return {
      node: domTarget.node,
      offset: domTarget.offset,
      pos: nextPos,
    };
  } catch {
    return null;
  }
}

export function syncNativeSelectionToCaretTarget(
  view: EditorView,
  target: PointerCaretTarget
): void {
  const domTarget = getDomCaretTarget(view, target);
  if (!domTarget?.node || domTarget.offset === undefined) return;
  const ownerDocument = view.dom.ownerDocument;
  const nativeSelection = ownerDocument.defaultView?.getSelection();
  if (!nativeSelection) return;

  const range = ownerDocument.createRange();
  try {
    range.setStart(domTarget.node, domTarget.offset);
    range.collapse(true);
    nativeSelection.removeAllRanges();
    nativeSelection.addRange(range);
  } catch {
  } finally {
    range.detach();
  }
}

function getTextNodeCaretTargetFromPoint(
  view: EditorView,
  event: MouseEvent
): PointerCaretTarget | null {
  const ownerDocument = view.dom.ownerDocument;
  const hitElement = ownerDocument.elementFromPoint(event.clientX, event.clientY);
  const root = hitElement && view.dom.contains(hitElement) ? hitElement : view.dom;
  const walker = ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const range = ownerDocument.createRange();
  let best: {
    distance: number;
    horizontalDistance: number;
    node: Text;
    offset: number;
  } | null = null;

  try {
    while (walker.nextNode()) {
      const textNode = walker.currentNode as Text;
      if (!textNode.data) continue;

      range.selectNodeContents(textNode);
      const textNodeRects = Array.from(range.getClientRects());
      const isOnClickedLine = textNodeRects.some((rect) =>
        rect.width > 0 &&
        rect.height > 0 &&
        event.clientY >= rect.top - 3 &&
        event.clientY <= rect.bottom + 3
      );
      if (!isOnClickedLine) continue;

      for (let offset = 0; offset < textNode.data.length; offset += 1) {
        range.setStart(textNode, offset);
        range.setEnd(textNode, offset + 1);
        for (const rect of Array.from(range.getClientRects())) {
          if (rect.width <= 0 || rect.height <= 0) continue;
          const verticalDistance = event.clientY < rect.top
            ? rect.top - event.clientY
            : event.clientY > rect.bottom
              ? event.clientY - rect.bottom
              : 0;
          if (verticalDistance > Math.max(4, rect.height / 2)) continue;

          const horizontalDistance = event.clientX < rect.left
            ? rect.left - event.clientX
            : event.clientX > rect.right
              ? event.clientX - rect.right
              : 0;
          const centerY = rect.top + rect.height / 2;
          const distance = horizontalDistance + Math.abs(event.clientY - centerY) * 2;
          if (best && distance >= best.distance) continue;

          best = {
            distance,
            horizontalDistance,
            node: textNode,
            offset: event.clientX <= rect.left + rect.width / 2 ? offset : offset + 1,
          };
        }
      }
    }
  } finally {
    range.detach();
  }

  if (!best) return null;
  if (best.horizontalDistance > 8) return null;
  try {
    return {
      node: best.node,
      offset: best.offset,
      pos: view.posAtDOM(best.node, best.offset),
    };
  } catch {
    return null;
  }
}

export function getCaretTargetFromPoint(
  view: EditorView,
  event: MouseEvent
): PointerCaretTarget | null {
  const ownerDocument = view.dom.ownerDocument as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  const textNodeTarget = getTextNodeCaretTargetFromPoint(view, event);
  if (textNodeTarget !== null) {
    return textNodeTarget;
  }

  const caretPosition = ownerDocument.caretPositionFromPoint?.(event.clientX, event.clientY);
  const caretRange = caretPosition
    ? null
    : ownerDocument.caretRangeFromPoint?.(event.clientX, event.clientY);
  const node = caretPosition?.offsetNode ?? caretRange?.startContainer ?? null;
  const offset = caretPosition?.offset ?? caretRange?.startOffset ?? null;

  if (node && offset !== null && view.dom.contains(node)) {
    try {
      return {
        node,
        offset,
        pos: view.posAtDOM(node, offset),
      };
    } catch {
    }
  }

  return null;
}
