import type { BlockRange, BlockRect, BlockRectYIndex, RectBounds } from './blockSelectionTypes';
import { normalizeBlockRanges } from './blockSelectionRanges';

export function createDragSelectionRect(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): RectBounds {
  return {
    left: Math.min(startX, endX),
    top: Math.min(startY, endY),
    right: Math.max(startX, endX),
    bottom: Math.max(startY, endY),
  };
}

function isAxisIntersecting(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  const aSize = aEnd - aStart;
  const bSize = bEnd - bStart;

  if (aSize === 0 && bSize === 0) {
    return false;
  }
  if (aSize === 0) {
    return aStart > bStart && aStart < bEnd;
  }
  if (bSize === 0) {
    return bStart > aStart && bStart < aEnd;
  }
  return aEnd > bStart && aStart < bEnd;
}

export function isRectIntersecting(a: RectBounds, b: RectBounds): boolean {
  return (
    isAxisIntersecting(a.left, a.right, b.left, b.right) &&
    isAxisIntersecting(a.top, a.bottom, b.top, b.bottom)
  );
}

export function resolveIntersectedBlockRanges(
  blocks: readonly BlockRect[],
  selectionRect: RectBounds,
): BlockRange[] {
  const selected = blocks
    .filter((block) => isRectIntersecting(block, selectionRect))
    .map((block) => ({ from: block.from, to: block.to }));

  return normalizeBlockRanges(selected);
}

function findFirstBlockWithTopAtOrAfter(blocks: readonly BlockRect[], top: number): number {
  let low = 0;
  let high = blocks.length;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (blocks[mid].top < top) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return low;
}

export function createBlockRectYIndex(blocks: readonly BlockRect[]): BlockRectYIndex {
  return {
    blocks,
    sortedByTop: [...blocks].sort((left, right) => (
      left.top === right.top ? left.bottom - right.bottom : left.top - right.top
    )),
  };
}

export function resolveIntersectedBlockRangesFromYIndex(
  index: BlockRectYIndex,
  selectionRect: RectBounds,
): BlockRange[] {
  if (index.blocks.length === 0) return [];

  const maybeIntersectingEnd = findFirstBlockWithTopAtOrAfter(index.sortedByTop, selectionRect.bottom);
  const selected: BlockRange[] = [];

  for (let i = 0; i < maybeIntersectingEnd; i += 1) {
    const block = index.sortedByTop[i];
    if (block.bottom <= selectionRect.top) continue;
    if (!isRectIntersecting(block, selectionRect)) continue;
    selected.push({ from: block.from, to: block.to });
  }

  return normalizeBlockRanges(selected);
}

function resolveDragPointerCoordinate(start: number, min: number, max: number): number {
  return start === min ? max : min;
}

export function convertViewportDragRectToDocumentRect(
  viewportRect: RectBounds,
  startX: number,
  startY: number,
  startScrollLeft: number,
  startScrollTop: number,
  currentScrollLeft: number,
  currentScrollTop: number,
): RectBounds {
  const currentX = resolveDragPointerCoordinate(startX, viewportRect.left, viewportRect.right);
  const currentY = resolveDragPointerCoordinate(startY, viewportRect.top, viewportRect.bottom);
  const startDocX = startX + startScrollLeft;
  const startDocY = startY + startScrollTop;
  const currentDocX = currentX + currentScrollLeft;
  const currentDocY = currentY + currentScrollTop;
  return createDragSelectionRect(startDocX, startDocY, currentDocX, currentDocY);
}

export function convertDocumentRectToViewportRect(
  documentRect: RectBounds,
  currentScrollLeft: number,
  currentScrollTop: number,
): RectBounds {
  return {
    left: documentRect.left - currentScrollLeft,
    right: documentRect.right - currentScrollLeft,
    top: documentRect.top - currentScrollTop,
    bottom: documentRect.bottom - currentScrollTop,
  };
}

export function resolveDisplayedDragViewportRect(
  rawViewportRect: RectBounds,
  startX: number,
  startY: number,
  startScrollLeft: number,
  startScrollTop: number,
  currentScrollLeft: number,
  currentScrollTop: number,
): RectBounds {
  const documentRect = convertViewportDragRectToDocumentRect(
    rawViewportRect,
    startX,
    startY,
    startScrollLeft,
    startScrollTop,
    currentScrollLeft,
    currentScrollTop,
  );

  return convertDocumentRectToViewportRect(documentRect, currentScrollLeft, currentScrollTop);
}

export function clampViewportRectTop(rect: RectBounds, minTop: number): RectBounds {
  if (rect.top >= minTop) return rect;

  return {
    ...rect,
    top: minTop,
    bottom: Math.max(rect.bottom, minTop),
  };
}

export function convertBlockRectsToDocumentSpace(
  blockRects: readonly BlockRect[],
  scrollLeft: number,
  scrollTop: number,
): BlockRect[] {
  if (scrollLeft === 0 && scrollTop === 0) {
    return [...blockRects];
  }

  return blockRects.map((block) => ({
    ...block,
    left: block.left + scrollLeft,
    right: block.right + scrollLeft,
    ...(block.contentLeft === undefined ? {} : { contentLeft: block.contentLeft + scrollLeft }),
    ...(block.contentRight === undefined ? {} : { contentRight: block.contentRight + scrollLeft }),
    top: block.top + scrollTop,
    bottom: block.bottom + scrollTop,
  }));
}
