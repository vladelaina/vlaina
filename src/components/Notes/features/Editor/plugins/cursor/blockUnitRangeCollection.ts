import type { EditorState } from '@milkdown/kit/prose/state';
import type { BlockRange } from './blockSelectionUtils';
import {
  COMPLEX_LIST_ITEM_CHILD_NODE_NAMES,
  LIST_CONTAINER_NODE_NAMES,
} from '../shared/blockNodeTypes';

export type EditorDoc = EditorState['doc'];

export const MAX_SELECTABLE_BLOCK_RANGE_SCAN_NODES = 20_000;
export const MAX_SELECTABLE_BLOCK_RANGES = 5_000;
export const MAX_SELECTABLE_BLOCK_LIST_DEPTH = 512;

const selectableBlockRangesCache = new WeakMap<EditorDoc, BlockRange[]>();

interface SelectableBlockRangeCollectionState {
  ranges: BlockRange[];
  scannedNodes: number;
}

export function isListContainerNode(name: string): boolean {
  return LIST_CONTAINER_NODE_NAMES.has(name);
}

export function getRangeCacheKey(from: number, to: number): string {
  return `${from}:${to}`;
}

export function resolveTopLevelNodeAtPos(
  doc: EditorState['doc'],
  pos: number,
): { from: number; to: number; name: string } | null {
  let resolved: { from: number; to: number; name: string } | null = null;

  doc.forEach((node, offset) => {
    if (resolved) return;
    const from = offset;
    const to = offset + node.nodeSize;
    if (pos < from || pos >= to) return;
    resolved = { from, to, name: node.type.name };
  });

  return resolved;
}

export function resolveTopLevelRangeAtPos(doc: EditorState['doc'], pos: number): BlockRange | null {
  const topLevelNode = resolveTopLevelNodeAtPos(doc, pos);
  return topLevelNode ? { from: topLevelNode.from, to: topLevelNode.to } : null;
}

export function resolveInlineCaretRange(doc: EditorDoc, range: BlockRange): BlockRange | null {
  const topLevelNode = resolveTopLevelNodeAtPos(doc, range.from);
  if (!topLevelNode || topLevelNode.name !== 'paragraph') return null;
  if (range.from <= topLevelNode.from && range.to >= topLevelNode.to) return null;
  const nodeBefore = doc.resolve(range.to).nodeBefore;
  const caretTo = nodeBefore && (nodeBefore.type.name === 'hardbreak' || nodeBefore.type.name === 'hard_break')
    ? range.to - nodeBefore.nodeSize : range.to;
  return { from: range.from, to: caretTo };
}

export function findFirstRangeStartingAtOrAfter(ranges: readonly BlockRange[], from: number): number {
  let low = 0;
  let high = ranges.length;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (ranges[mid].from < from) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return low;
}

function isParagraphNode(name: string): boolean {
  return name === 'paragraph';
}

function isHardBreakNode(name: string): boolean {
  return name === 'hardbreak' || name === 'hard_break';
}

export function isStandaloneImageParagraphNode(node: EditorState['doc']): boolean {
  if (node.type.name !== 'paragraph') return false;
  if (getNodeChildCount(node) !== 1) return false;
  return getNodeChild(node, 0)?.type.name === 'image';
}

function getNodeChildCount(node: EditorState['doc']): number {
  const childCount = (node as { childCount?: unknown }).childCount;
  return typeof childCount === 'number' && Number.isFinite(childCount) && childCount > 0
    ? Math.floor(childCount)
    : 0;
}

function getNodeChild(node: EditorState['doc'], index: number): EditorState['doc'] | null {
  const child = (node as { child?: unknown }).child;
  if (typeof child !== 'function') return null;
  try {
    const result = child.call(node, index);
    return result && typeof result === 'object' ? result as EditorState['doc'] : null;
  } catch {
    return null;
  }
}

function pushSelectableRange(
  collection: SelectableBlockRangeCollectionState,
  range: BlockRange,
): boolean {
  if (collection.ranges.length >= MAX_SELECTABLE_BLOCK_RANGES) return false;
  collection.ranges.push(range);
  return true;
}

function forEachSelectableChild(
  node: EditorState['doc'],
  collection: SelectableBlockRangeCollectionState,
  visit: (child: EditorState['doc'], offset: number) => boolean | void,
): boolean {
  const childCount = getNodeChildCount(node);
  if (childCount > 0) {
    let offset = 0;
    for (let index = 0; index < childCount; index += 1) {
      if (collection.scannedNodes >= MAX_SELECTABLE_BLOCK_RANGE_SCAN_NODES) return false;
      const child = getNodeChild(node, index);
      if (!child) continue;
      collection.scannedNodes += 1;
      if (visit(child, offset) === false) return false;
      offset += child.nodeSize;
      if (collection.ranges.length >= MAX_SELECTABLE_BLOCK_RANGES) return false;
    }
    return true;
  }

  let shouldContinue = true;
  node.forEach((child, offset) => {
    if (!shouldContinue) return;
    if (collection.scannedNodes >= MAX_SELECTABLE_BLOCK_RANGE_SCAN_NODES) {
      shouldContinue = false;
      return;
    }
    collection.scannedNodes += 1;
    if (visit(child, offset) === false) shouldContinue = false;
    if (collection.ranges.length >= MAX_SELECTABLE_BLOCK_RANGES) shouldContinue = false;
  });
  return shouldContinue;
}

function collectParagraphLineRanges(
  node: EditorState['doc'],
  paragraphFrom: number,
  collection: SelectableBlockRangeCollectionState,
): boolean {
  const contentFrom = paragraphFrom + 1;
  const contentTo = paragraphFrom + node.nodeSize - 1;
  let lineFrom = contentFrom;
  let hasHardBreak = false;

  const completed = forEachSelectableChild(node, collection, (child, childOffset) => {
    if (!isHardBreakNode(child.type.name)) return;

    hasHardBreak = true;
    const breakTo = contentFrom + childOffset + child.nodeSize;
    if (breakTo > lineFrom) {
      if (!pushSelectableRange(collection, { from: lineFrom, to: breakTo })) return false;
    }
    lineFrom = breakTo;
  });

  if (!completed) return true;
  if (!hasHardBreak) return false;

  if (lineFrom < contentTo) {
    pushSelectableRange(collection, { from: lineFrom, to: contentTo });
  }

  return true;
}

function collectListItemRanges(
  node: EditorState['doc'],
  itemFrom: number,
  collection: SelectableBlockRangeCollectionState,
  depth: number,
): boolean {
  const contentFrom = itemFrom + 1;
  let firstChild = true;
  let headerRangeTo: number | null = null;

  const completed = forEachSelectableChild(node, collection, (child, childOffset) => {
    const childFrom = contentFrom + childOffset;
    const isList = isListContainerNode(child.type.name);

    if (isList) {
      if (headerRangeTo !== null) {
        if (!pushSelectableRange(collection, { from: itemFrom, to: headerRangeTo })) return false;
        headerRangeTo = null;
      }
      if (!collectListContainerRanges(child, childFrom, collection, depth + 1)) return false;
    } else {
      const isComplexBlock = COMPLEX_LIST_ITEM_CHILD_NODE_NAMES.has(child.type.name);

      if (firstChild) {
        if (isComplexBlock) {
          if (!pushSelectableRange(collection, { from: itemFrom, to: childFrom })) return false;
          if (!pushSelectableRange(collection, { from: childFrom, to: childFrom + child.nodeSize })) return false;
        } else {
          headerRangeTo = childFrom + child.nodeSize;
        }
        firstChild = false;
      } else if (headerRangeTo !== null && isComplexBlock) {
        if (!pushSelectableRange(collection, { from: childFrom, to: childFrom + child.nodeSize })) return false;
        headerRangeTo = childFrom + child.nodeSize;
      } else {
        if (!pushSelectableRange(collection, { from: childFrom, to: childFrom + child.nodeSize })) return false;
      }
    }
  });

  if (!completed) return false;

  if (headerRangeTo !== null) {
    return pushSelectableRange(collection, { from: itemFrom, to: itemFrom + node.nodeSize });
  } else if (firstChild) {
    return pushSelectableRange(collection, { from: itemFrom, to: itemFrom + node.nodeSize });
  }
  return true;
}

function collectListContainerRanges(
  node: EditorState['doc'],
  listFrom: number,
  collection: SelectableBlockRangeCollectionState,
  depth = 0,
): boolean {
  if (depth > MAX_SELECTABLE_BLOCK_LIST_DEPTH) return false;
  const contentFrom = listFrom + 1;
  return forEachSelectableChild(node, collection, (child, childOffset) => {
    if (child.type.name !== 'list_item') return;
    const itemFrom = contentFrom + childOffset;
    return collectListItemRanges(child, itemFrom, collection, depth);
  });
}

export function getListItemRangeEnd(doc: EditorState['doc'], from: number): number | null {
  const safeFrom = Math.max(0, Math.min(from, doc.content.size));
  try {
    const $from = doc.resolve(safeFrom);
    const nodeAfter = $from.nodeAfter;
    if (!nodeAfter || nodeAfter.type.name !== 'list_item') return null;
    return safeFrom + nodeAfter.nodeSize;
  } catch {
    return null;
  }
}

function collectSelectableBlockRangesUncached(doc: EditorDoc): BlockRange[] {
  const collection: SelectableBlockRangeCollectionState = {
    ranges: [],
    scannedNodes: 0,
  };
  forEachSelectableChild(doc, collection, (node, offset) => {
    if (isListContainerNode(node.type.name)) {
      return collectListContainerRanges(node, offset, collection);
    }

    if (isParagraphNode(node.type.name) && collectParagraphLineRanges(node, offset, collection)) {
      return;
    }

    return pushSelectableRange(collection, {
      from: offset,
      to: offset + node.nodeSize,
    });
  });
  return collection.ranges;
}

export function collectSelectableBlockRanges(doc: EditorDoc): BlockRange[] {
  const cached = selectableBlockRangesCache.get(doc);
  if (cached) return cached;

  const ranges = collectSelectableBlockRangesUncached(doc);
  selectableBlockRangesCache.set(doc, ranges);
  return ranges;
}
