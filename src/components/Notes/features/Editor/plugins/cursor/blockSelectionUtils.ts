import type { EditorState, Transaction } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';

export interface RectBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface BlockRect extends RectBounds {
  from: number;
  to: number;
}

export interface BlockRange {
  from: number;
  to: number;
}

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

export function isRectIntersecting(a: RectBounds, b: RectBounds): boolean {
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}

export function normalizeBlockRanges(ranges: readonly BlockRange[]): BlockRange[] {
  if (ranges.length === 0) return [];

  const sorted = [...ranges]
    .filter((range) => range.to > range.from)
    .sort((a, b) => (a.from === b.from ? a.to - b.to : a.from - b.from));

  const unique: BlockRange[] = [];
  let lastFrom = -1;
  let lastTo = -1;
  for (const range of sorted) {
    if (range.from === lastFrom && range.to === lastTo) continue;
    unique.push(range);
    lastFrom = range.from;
    lastTo = range.to;
  }
  return unique;
}

export function pruneContainedBlockRanges(ranges: readonly BlockRange[]): BlockRange[] {
  const normalized = normalizeBlockRanges(ranges);
  if (normalized.length <= 1) return normalized;

  const sorted = [...normalized].sort((a, b) => (
    a.from === b.from ? b.to - a.to : a.from - b.from
  ));

  const pruned: BlockRange[] = [];
  for (const range of sorted) {
    const previous = pruned[pruned.length - 1];
    if (previous && range.from >= previous.from && range.to <= previous.to) {
      continue;
    }
    pruned.push(range);
  }

  return pruned.sort((a, b) => (a.from === b.from ? a.to - b.to : a.from - b.from));
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

export function getBlockRangesKey(ranges: readonly BlockRange[]): string {
  if (ranges.length === 0) return '';
  return ranges.map((range) => `${range.from}:${range.to}`).join('|');
}

export function resolveStandaloneImageBlockRange(
  doc: EditorState['doc'],
  block: BlockRange,
): BlockRange | null {
  const safeFrom = Math.max(0, Math.min(block.from, doc.content.size));
  const safeTo = Math.max(0, Math.min(block.to, doc.content.size));

  try {
    const $from = doc.resolve(safeFrom);
    const nodeAfter = $from.nodeAfter;
    if (!nodeAfter || nodeAfter.type.name !== 'paragraph') return null;
    if (safeTo !== safeFrom + nodeAfter.nodeSize) return null;
    if (nodeAfter.childCount !== 1 || nodeAfter.firstChild?.type.name !== 'image') return null;

    const imageFrom = safeFrom + 1;
    return {
      from: imageFrom,
      to: imageFrom + nodeAfter.firstChild.nodeSize,
    };
  } catch {
    return null;
  }
}

export function getDisplayBlockRangesForDecorations(
  doc: EditorState['doc'],
  blocks: readonly BlockRange[],
): BlockRange[] {
  return normalizeBlockRanges(blocks.map((block) => {
    const safeFrom = Math.max(0, Math.min(block.from, doc.content.size));
    let from = block.from;
    let to = block.to;

    try {
      const $from = doc.resolve(safeFrom);
      const nodeAfter = $from.nodeAfter;
      if (nodeAfter?.type.name === 'list_item') {
        from = safeFrom;
        to = safeFrom + nodeAfter.nodeSize;
      } else {
        const imageRange = resolveStandaloneImageBlockRange(doc, block);
        if (imageRange) {
          from = imageRange.from;
          to = imageRange.to;
        }
      }
    } catch {
    }

    return { from, to };
  }));
}

export function createBlockSelectionDecorations(doc: EditorState['doc'], blocks: readonly BlockRange[]): DecorationSet {
  if (blocks.length === 0) return DecorationSet.empty;

  const displayRanges = getDisplayBlockRangesForDecorations(doc, blocks);

  const decorations = displayRanges.map((range) => Decoration.node(range.from, range.to, {
    class: 'vlaina-block-selected',
  }));

  return DecorationSet.create(doc, decorations);
}

export function mapBlockRangesThroughTransaction(blocks: readonly BlockRange[], tr: Transaction): BlockRange[] {
  if (blocks.length === 0) return [];

  const mapped = blocks
    .map((block) => ({
      from: tr.mapping.map(block.from, 1),
      to: tr.mapping.map(block.to, -1),
    }))
    .filter((block) => block.to > block.from);

  return normalizeBlockRanges(mapped);
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
    top: block.top + scrollTop,
    bottom: block.bottom + scrollTop,
  }));
}
