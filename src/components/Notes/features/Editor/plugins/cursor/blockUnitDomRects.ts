import type { EditorView } from '@milkdown/kit/prose/view';
import type { BlockRange } from './blockSelectionUtils';
import { resolveTopLevelNodeAtPos } from './blockUnitRangeCollection';

export const MAX_BLOCK_UNIT_DOM_RANGE_RECTS = 1024;

function createDOMRectFromBounds(left: number, top: number, right: number, bottom: number): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
    toJSON: () => ({}),
  } as DOMRect;
}

export function resolveDOMRangeRect(view: EditorView, range: BlockRange): DOMRect | null {
  const doc = view.dom.ownerDocument;
  const domRange = doc.createRange();

  try {
    const start = view.domAtPos(range.from);
    const end = view.domAtPos(range.to);
    domRange.setStart(start.node, start.offset);
    domRange.setEnd(end.node, end.offset);

    let left = Number.POSITIVE_INFINITY;
    let top = Number.POSITIVE_INFINITY;
    let right = Number.NEGATIVE_INFINITY;
    let bottom = Number.NEGATIVE_INFINITY;
    const rects = domRange.getClientRects();

    if (rects.length > MAX_BLOCK_UNIT_DOM_RANGE_RECTS) {
      return null;
    }

    for (let index = 0; index < rects.length; index += 1) {
      const rect = rects[index];
      if (!rect) continue;
      if (rect.width <= 0 && rect.height <= 0) continue;
      left = Math.min(left, rect.left);
      top = Math.min(top, rect.top);
      right = Math.max(right, rect.right);
      bottom = Math.max(bottom, rect.bottom);
    }

    if (!Number.isFinite(left) || !Number.isFinite(top) || right <= left || bottom <= top) {
      return null;
    }

    return createDOMRectFromBounds(left, top, right, bottom);
  } catch {
    return null;
  } finally {
    domRange.detach();
  }
}

function isPartialTopLevelTextblockRange(view: EditorView, range: BlockRange): boolean {
  const topLevelNode = resolveTopLevelNodeAtPos(view.state.doc, range.from);
  if (!topLevelNode || topLevelNode.name !== 'paragraph') return false;
  return range.from > topLevelNode.from || range.to < topLevelNode.to;
}

export function resolveTargetRect(element: HTMLElement, range?: BlockRange, view?: EditorView): DOMRect {
  if (range && view && isPartialTopLevelTextblockRange(view, range)) {
    const rangeRect = resolveDOMRangeRect(view, range);
    if (rangeRect) return rangeRect;
  }

  if (element.tagName !== 'LI') return element.getBoundingClientRect();

  if (range && view) {
    try {
      const nodeDom = view.nodeDOM(range.from);
      if (nodeDom instanceof HTMLElement && element.contains(nodeDom) && nodeDom !== element) {
        return nodeDom.getBoundingClientRect();
      }
    } catch {
    }
  }

  const baseRect = element.getBoundingClientRect();
  const headElement = element.firstElementChild instanceof HTMLElement ? element.firstElementChild : null;
  if (!headElement) return baseRect;

  const headRect = headElement.getBoundingClientRect();
  const top = headRect.top;
  const bottom = headRect.bottom;
  const height = bottom - top;
  if (height <= 0 || baseRect.width <= 0) return baseRect;

  return createDOMRectFromBounds(baseRect.left, top, baseRect.right, bottom);
}
