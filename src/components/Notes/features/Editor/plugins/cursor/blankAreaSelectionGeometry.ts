import {
  resolveVerticalEdgeAutoScrollDelta,
} from './edgeAutoScroll';
import type { BlockRect, BlockRange, RectBounds } from './blockSelectionUtils';

const EXTERNAL_BLANK_AREA_SELECTION_MIN_BLOCK_OVERLAP_PX = 12;

function getBlockRangeKey(range: BlockRange): string {
  return `${range.from}:${range.to}`;
}

function getHorizontalOverlapPx(left: RectBounds, right: RectBounds): number {
  return Math.max(0, Math.min(left.right, right.right) - Math.max(left.left, right.left));
}

export function filterExternalBlankAreaSelectionEdgeGrazes(
  blocks: readonly BlockRect[],
  selectedBlocks: readonly BlockRange[],
  selectionRect: RectBounds,
  minBlockOverlapPx = EXTERNAL_BLANK_AREA_SELECTION_MIN_BLOCK_OVERLAP_PX,
): BlockRange[] {
  if (selectedBlocks.length === 0) {
    return [];
  }

  const blockByRange = new Map(blocks.map((block) => [getBlockRangeKey(block), block]));
  return selectedBlocks.filter((range) => {
    const block = blockByRange.get(getBlockRangeKey(range));
    if (!block) {
      return false;
    }
    return getHorizontalOverlapPx(block, selectionRect) >= minBlockOverlapPx;
  });
}

export function resolveBlankAreaSelectionAutoScrollDelta(
  pointerY: number,
  scrollRootRect: Pick<DOMRect, 'top' | 'bottom'>,
): number {
  return resolveVerticalEdgeAutoScrollDelta(pointerY, scrollRootRect);
}
