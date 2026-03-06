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
