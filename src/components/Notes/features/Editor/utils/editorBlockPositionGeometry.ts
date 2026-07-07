import type { EditorView } from '@milkdown/kit/prose/view';
import type {
  EditorBlockPositionEntry,
  EditorBlockPositionSnapshot,
} from './editorBlockPositionTypes';

export function getBlockRangeKey(from: number, to: number): string {
  return `${from}:${to}`;
}

export function createBlockIndex(blocks: readonly EditorBlockPositionEntry[]): Map<string, EditorBlockPositionEntry> {
  return new Map(blocks.map((block) => [getBlockRangeKey(block.from, block.to), block]));
}

export function resolveDocumentTop(rect: DOMRect, scrollRootTop: number | null, scrollTop: number): number {
  if (scrollRootTop === null) {
    return rect.top;
  }

  return rect.top - scrollRootTop + scrollTop;
}

export function resolveDocumentBottom(rect: DOMRect, scrollRootTop: number | null, scrollTop: number): number {
  if (scrollRootTop === null) {
    return rect.bottom;
  }

  return rect.bottom - scrollRootTop + scrollTop;
}

export function resolveDocumentLeft(rect: DOMRect, scrollRootLeft: number | null, scrollLeft: number): number {
  if (scrollRootLeft === null) {
    return rect.left;
  }

  return rect.left - scrollRootLeft + scrollLeft;
}

export function resolveDocumentRight(rect: DOMRect, scrollRootLeft: number | null, scrollLeft: number): number {
  if (scrollRootLeft === null) {
    return rect.right;
  }

  return rect.right - scrollRootLeft + scrollLeft;
}

export function collectTopLevelBlockRanges(doc: EditorView['state']['doc']): Array<{ from: number; to: number }> {
  const ranges: Array<{ from: number; to: number }> = [];
  doc.forEach((node, offset) => {
    ranges.push({
      from: offset,
      to: offset + node.nodeSize,
    });
  });
  return ranges;
}

export function resolveViewportRectFromDocumentPosition(
  block: EditorBlockPositionEntry,
  scrollRootRect: DOMRect | null,
  scrollLeft: number,
  scrollTop: number,
): DOMRect {
  if (!scrollRootRect) {
    return block.rect;
  }

  const left = block.documentLeft === undefined
    ? block.rect.left
    : block.documentLeft + scrollRootRect.left - scrollLeft;
  const right = block.documentRight === undefined
    ? block.rect.right
    : block.documentRight + scrollRootRect.left - scrollLeft;
  const top = block.documentTop + scrollRootRect.top - scrollTop;
  const bottom = block.documentBottom + scrollRootRect.top - scrollTop;
  return {
    bottom,
    height: bottom - top,
    left,
    right,
    top,
    width: right - left,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

export function createScrollAdjustedSnapshot(
  snapshot: EditorBlockPositionSnapshot,
  scrollLeft: number,
  scrollTop: number,
  version: number,
): EditorBlockPositionSnapshot {
  return {
    ...snapshot,
    version,
    scrollLeft,
    scrollTop,
  };
}

export function findFirstBlockStartingAfter(
  blocks: readonly EditorBlockPositionEntry[],
  documentY: number,
): number {
  let low = 0;
  let high = blocks.length;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (blocks[mid].documentTop <= documentY) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return low;
}
