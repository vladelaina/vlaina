import { normalizeBlockRanges, type BlockRange } from './blockSelectionUtils';

export interface RectLike {
  top: number;
  bottom: number;
  height: number;
}

export interface PointerBlockTarget {
  rect: RectLike;
}

export interface BlockMovePlan {
  selectedRanges: BlockRange[];
  targetPos: number;
}

export interface TopLevelRangeResolver {
  (pos: number): BlockRange | null;
}

export function pickPointerBlock<T extends PointerBlockTarget>(
  blocks: readonly T[],
  pointerY: number | null,
): T | null {
  if (blocks.length === 0) return null;
  if (pointerY === null) return blocks[0];

  const directHit = blocks.find((block) => pointerY >= block.rect.top && pointerY <= block.rect.bottom);
  if (directHit) return directHit;

  let nearest: T | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const block of blocks) {
    const centerY = block.rect.top + block.rect.height / 2;
    const distance = Math.abs(pointerY - centerY);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = block;
    }
  }
  return nearest;
}

export function createBlockMovePlan(
  ranges: readonly BlockRange[],
  insertPos: number,
): BlockMovePlan | null {
  const selectedRanges = normalizeBlockRanges(ranges);
  if (selectedRanges.length === 0) return null;

  for (const range of selectedRanges) {
    if (insertPos >= range.from && insertPos <= range.to) {
      return null;
    }
  }

  const deletedBeforeInsert = selectedRanges.reduce((total, range) => (
    range.to <= insertPos ? total + (range.to - range.from) : total
  ), 0);
  const targetPos = insertPos - deletedBeforeInsert;
  if (targetPos === selectedRanges[0].from) return null;

  return {
    selectedRanges,
    targetPos,
  };
}

export function mapRangesToTopLevelBlocks(
  ranges: readonly BlockRange[],
  resolveTopLevelRange: TopLevelRangeResolver,
): BlockRange[] {
  if (ranges.length === 0) return [];
  const resolved = ranges
    .map((range) => resolveTopLevelRange(range.from))
    .filter((range): range is BlockRange => range !== null);
  return normalizeBlockRanges(resolved);
}
