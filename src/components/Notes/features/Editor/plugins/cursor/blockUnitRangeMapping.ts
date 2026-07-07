import { normalizeBlockRanges, type BlockRange } from './blockSelectionUtils';
import {
  collectSelectableBlockRanges,
  findFirstRangeStartingAtOrAfter,
  getListItemRangeEnd,
  resolveTopLevelNodeAtPos,
  resolveTopLevelRangeAtPos,
  type EditorDoc,
} from './blockUnitRangeCollection';

export function isInlineSelectableBlockRange(doc: EditorDoc, range: BlockRange): boolean {
  const topLevelNode = resolveTopLevelNodeAtPos(doc, range.from);
  if (!topLevelNode || topLevelNode.name !== 'paragraph') return false;
  return range.from > topLevelNode.from || range.to < topLevelNode.to;
}

export function isNonDraggableBlockRange(doc: EditorDoc, range: BlockRange): boolean {
  if (range.to <= range.from) return true;

  try {
    const $from = doc.resolve(Math.max(0, Math.min(range.from, doc.content.size)));
    const nodeAfter = $from.nodeAfter;
    return nodeAfter?.type.name === 'list_item' && range.to <= range.from + 1;
  } catch {
    return false;
  }
}

export function mapInlineSelectableRangesToMovableBlocks(
  doc: EditorDoc,
  ranges: readonly BlockRange[],
): BlockRange[] {
  if (ranges.length === 0) return [];
  const movableRanges = ranges.map((range) => {
    if (!isInlineSelectableBlockRange(doc, range)) return range;
    return resolveTopLevelRangeAtPos(doc, range.from) ?? range;
  });
  return normalizeBlockRanges(movableRanges);
}

export function collectMovableBlockTargetRanges(doc: EditorDoc): BlockRange[] {
  return mapInlineSelectableRangesToMovableBlocks(doc, collectSelectableBlockRanges(doc));
}

function findFirstRangeStartingAfter(ranges: readonly BlockRange[], pos: number): number {
  let low = 0;
  let high = ranges.length;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (ranges[mid].from <= pos) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return low;
}

export function resolveSelectableBlockRange(doc: EditorDoc, pos: number): BlockRange | null {
  const docSize = doc.content.size;
  const safePos = Math.max(0, Math.min(pos, docSize));
  const ranges = collectSelectableBlockRanges(doc);
  if (ranges.length === 0) return null;

  let bestRange: BlockRange | null = null;
  let minSize = Number.POSITIVE_INFINITY;
  const firstAfterPos = findFirstRangeStartingAfter(ranges, safePos);

  for (let index = firstAfterPos - 1; index >= 0; index -= 1) {
    const range = ranges[index];
    if (safePos >= range.from && safePos < range.to) {
      const size = range.to - range.from;
      if (size < minSize) {
        minSize = size;
        bestRange = range;
      }
      continue;
    }

    if (range.to <= safePos && bestRange) break;
  }

  if (bestRange) {
    return bestRange;
  }

  const nextRange = ranges[firstAfterPos];
  if (nextRange && safePos < nextRange.from) {
    return nextRange;
  }
  const last = ranges[ranges.length - 1];
  return last;
}

export function mapRangesToSelectableBlocks(
  doc: EditorDoc,
  ranges: readonly BlockRange[],
): BlockRange[] {
  if (ranges.length === 0) return [];
  const resolved = ranges
    .map((range) => {
      const topLevelRange = resolveTopLevelRangeAtPos(doc, range.from);
      if (topLevelRange && topLevelRange.from === range.from && topLevelRange.to === range.to) {
        return range;
      }
      return resolveSelectableBlockRange(doc, range.from);
    })
    .filter((range): range is BlockRange => range !== null);
  return normalizeBlockRanges(resolved);
}

export function expandListItemHeaderRanges(
  doc: EditorDoc,
  ranges: readonly BlockRange[],
): BlockRange[] {
  const normalized = mapRangesToSelectableBlocks(doc, ranges);
  if (normalized.length === 0) return [];

  const selectableRanges = collectSelectableBlockRanges(doc);
  const expanded: BlockRange[] = [...normalized];
  for (const range of normalized) {
    const listItemTo = getListItemRangeEnd(doc, range.from);
    if (listItemTo === null || range.to >= listItemTo) continue;

    for (const candidate of selectableRanges) {
      if (candidate.from < range.to) continue;
      if (candidate.to > listItemTo) continue;
      expanded.push(candidate);
    }
  }
  return normalizeBlockRanges(expanded);
}

export function expandKnownSelectableListItemHeaderRanges(
  doc: EditorDoc,
  ranges: readonly BlockRange[],
  selectableRanges: readonly BlockRange[],
): BlockRange[] {
  const normalized = normalizeBlockRanges(ranges);
  if (normalized.length === 0) return [];

  const sortedSelectableRanges = normalizeBlockRanges(selectableRanges);
  const expanded: BlockRange[] = [...normalized];
  for (const range of normalized) {
    const listItemTo = getListItemRangeEnd(doc, range.from);
    if (listItemTo === null || range.to >= listItemTo) continue;

    const startIndex = findFirstRangeStartingAtOrAfter(sortedSelectableRanges, range.to);
    for (let index = startIndex; index < sortedSelectableRanges.length; index += 1) {
      const candidate = sortedSelectableRanges[index];
      if (candidate.from < range.to) continue;
      if (candidate.from >= listItemTo) break;
      if (candidate.to > listItemTo) continue;
      expanded.push(candidate);
    }
  }
  return normalizeBlockRanges(expanded);
}
