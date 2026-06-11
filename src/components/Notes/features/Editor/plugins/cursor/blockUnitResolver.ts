import type { EditorState } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import {
  normalizeBlockRanges,
  resolveStandaloneImageBlockRange,
  type BlockRange,
} from './blockSelectionUtils';
import { resolveBlockElementAtPos, resolveTopLevelBlockElement } from './topLevelBlockDom';
import {
  COMPLEX_LIST_ITEM_CHILD_NODE_NAMES,
  LIST_CONTAINER_NODE_NAMES,
} from '../shared/blockNodeTypes';

type EditorDoc = EditorState['doc'];

export const MAX_BLOCK_UNIT_DOM_RANGE_RECTS = 1024;
export const MAX_SELECTABLE_BLOCK_RANGE_SCAN_NODES = 20_000;
export const MAX_SELECTABLE_BLOCK_RANGES = 5_000;
export const MAX_SELECTABLE_BLOCK_LIST_DEPTH = 512;

export interface SelectableBlockTarget {
  range: BlockRange;
  element: HTMLElement;
  subElement?: HTMLElement;
  rect: DOMRect;
}

const selectableBlockRangesCache = new WeakMap<EditorDoc, BlockRange[]>();
const directTopLevelBlockRangeKeysCache = new WeakMap<EditorDoc, Set<string>>();

interface SelectableBlockRangeCollectionState {
  ranges: BlockRange[];
  scannedNodes: number;
}

function isNonDraggableBlockNode(name: string): boolean {
  return name === 'frontmatter';
}

function isListContainerNode(name: string): boolean {
  return LIST_CONTAINER_NODE_NAMES.has(name);
}

function getRangeCacheKey(from: number, to: number): string {
  return `${from}:${to}`;
}

function resolveTopLevelNodeAtPos(
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

function resolveTopLevelRangeAtPos(doc: EditorState['doc'], pos: number): BlockRange | null {
  const topLevelNode = resolveTopLevelNodeAtPos(doc, pos);
  return topLevelNode ? { from: topLevelNode.from, to: topLevelNode.to } : null;
}

function findFirstRangeStartingAtOrAfter(ranges: readonly BlockRange[], from: number): number {
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

function isStandaloneImageParagraphNode(node: EditorState['doc']): boolean {
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

function resolveListItemElement(view: EditorView, from: number, to: number): HTMLElement | null {
  const docSize = view.state.doc.content.size;
  const rangeStart = Math.max(1, Math.min(from + 1, docSize));
  const rangeEnd = Math.max(rangeStart, Math.min(Math.max(from + 1, to - 1), docSize));
  const rangeMiddle = Math.max(rangeStart, Math.min(Math.floor((rangeStart + rangeEnd) / 2), docSize));
  const probePositions = Array.from(new Set([rangeStart, rangeMiddle, rangeEnd]));

  const resolveItemFromNode = (node: Node | null): HTMLElement | null => {
    if (!node) return null;
    const base = node instanceof HTMLElement ? node : node.parentElement;
    const item = base?.closest('li') ?? null;
    if (!(item instanceof HTMLElement)) return null;
    if (!view.dom.contains(item)) return null;
    return item;
  };

  for (const pos of probePositions) {
    try {
      const domPos = view.domAtPos(pos);
      const item = resolveItemFromNode(domPos.node);
      if (item) return item;
    } catch {
    }
  }

  for (const pos of probePositions) {
    const nodeDom = view.nodeDOM(pos);
    const item = resolveItemFromNode(nodeDom as Node | null);
    if (item) return item;
  }

  const fromNode = view.nodeDOM(from);
  const fromItem = resolveItemFromNode(fromNode as Node | null);
  if (fromItem) return fromItem;

  try {
    const domPos = view.domAtPos(rangeStart);
    const item = resolveItemFromNode(domPos.node);
    if (item) return item;
  } catch {
  }

  return null;
}

function resolveStandaloneImageElement(view: EditorView, range: BlockRange): HTMLElement | null {
  const imageRange = resolveStandaloneImageBlockRange(view.state.doc, range);
  if (!imageRange) return null;

  const resolveImageContainer = (node: Node | null): HTMLElement | null => {
    if (!node) return null;
    const base = node instanceof HTMLElement ? node : node.parentElement;
    const container = base?.closest('.image-block-container') ?? null;
    if (!(container instanceof HTMLElement)) return null;
    if (!view.dom.contains(container)) return null;
    return container;
  };

  const nodeDom = view.nodeDOM(imageRange.from);
  const directContainer = resolveImageContainer(nodeDom as Node | null);
  if (directContainer) return directContainer;

  try {
    const domPos = view.domAtPos(imageRange.from);
    const domContainer = resolveImageContainer(domPos.node);
    if (domContainer) return domContainer;
  } catch {
  }

  return null;
}

function resolveInListItemChildElement(view: EditorView, range: BlockRange): HTMLElement | null {
  const safeFrom = Math.max(0, Math.min(range.from, view.state.doc.content.size));
  try {
    const $from = view.state.doc.resolve(safeFrom);
    if ($from.parent.type.name !== 'list_item') return null;
    const nodeDom = view.nodeDOM(range.from);
    if (nodeDom instanceof HTMLElement && view.dom.contains(nodeDom)) return nodeDom;
    if (nodeDom?.parentElement && view.dom.contains(nodeDom.parentElement)) return nodeDom.parentElement;
  } catch {
  }
  return null;
}

function resolveRangeElement(view: EditorView, range: BlockRange): HTMLElement | null {
  const listItemTo = getListItemRangeEnd(view.state.doc, range.from);
  if (listItemTo !== null) {
    const element = resolveListItemElement(view, range.from, range.to);
    if (element) return element;
  }

  const inListItemChild = resolveInListItemChildElement(view, range);
  if (inListItemChild) return inListItemChild;

  const imageElement = resolveStandaloneImageElement(view, range);
  if (imageElement) return imageElement;

  const topLevelElement = resolveTopLevelBlockElement(view, range.from);
  if (topLevelElement) return topLevelElement;

  return resolveBlockElementAtPos(view, range.from);
}

function collectDirectTopLevelBlockRangeKeysUncached(doc: EditorDoc): Set<string> {
  const keys = new Set<string>();
  doc.forEach((node, offset) => {
    const nodeName = node.type.name;
    if (
      isListContainerNode(nodeName) ||
      nodeName === 'list_item' ||
      nodeName === 'image' ||
      isStandaloneImageParagraphNode(node)
    ) {
      return;
    }

    keys.add(getRangeCacheKey(offset, offset + node.nodeSize));
  });
  return keys;
}

function collectDirectTopLevelBlockRangeKeys(doc: EditorDoc): Set<string> {
  const cached = directTopLevelBlockRangeKeysCache.get(doc);
  if (cached) return cached;

  const keys = collectDirectTopLevelBlockRangeKeysUncached(doc);
  directTopLevelBlockRangeKeysCache.set(doc, keys);
  return keys;
}

function resolveKnownTopLevelBlockElement(view: EditorView, blockPos: number): HTMLElement | null {
  const docSize = view.state.doc.content.size;
  const probePos = Math.max(1, Math.min(blockPos + 1, docSize));

  try {
    const domPos = view.domAtPos(probePos);
    let element = domPos.node instanceof HTMLElement ? domPos.node : domPos.node.parentElement;
    while (element && element.parentElement !== view.dom) {
      element = element.parentElement;
    }
    if (element && element.parentElement === view.dom) return element;
  } catch {
  }

  const nodeDom = view.nodeDOM(blockPos);
  if (!(nodeDom instanceof HTMLElement)) return null;

  let element: HTMLElement | null = nodeDom;
  while (element && element.parentElement !== view.dom) {
    element = element.parentElement;
  }
  return element && element.parentElement === view.dom ? element : null;
}

function resolveDirectTopLevelTarget(view: EditorView, range: BlockRange): SelectableBlockTarget | null {
  const directTopLevelRangeKeys = collectDirectTopLevelBlockRangeKeys(view.state.doc);
  if (!directTopLevelRangeKeys.has(getRangeCacheKey(range.from, range.to))) {
    return null;
  }

  const element = resolveKnownTopLevelBlockElement(view, range.from);
  if (!element) return null;

  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;

  return { range, element, rect };
}

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

function resolveTargetRect(element: HTMLElement, range?: BlockRange, view?: EditorView): DOMRect {
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

export function isInlineSelectableBlockRange(doc: EditorDoc, range: BlockRange): boolean {
  const topLevelNode = resolveTopLevelNodeAtPos(doc, range.from);
  if (!topLevelNode || topLevelNode.name !== 'paragraph') return false;
  return range.from > topLevelNode.from || range.to < topLevelNode.to;
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

export function isNonDraggableBlockRange(doc: EditorDoc, range: BlockRange): boolean {
  const topLevelNode = resolveTopLevelNodeAtPos(doc, range.from);
  if (!topLevelNode) return false;
  return topLevelNode.from === range.from && isNonDraggableBlockNode(topLevelNode.name);
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

export function resolveSelectableBlockTargetByPos(view: EditorView, blockPos: number): SelectableBlockTarget | null {
  const range = resolveSelectableBlockRange(view.state.doc, blockPos);
  if (!range) return null;

  const directTarget = resolveDirectTopLevelTarget(view, range);
  if (directTarget) return directTarget;

  const element = resolveRangeElement(view, range);
  if (!element) return null;

  let subElement: HTMLElement | undefined;
  if (element.tagName === 'LI') {
    try {
      const nodeDom = view.nodeDOM(range.from);
      if (nodeDom instanceof HTMLElement && element.contains(nodeDom) && nodeDom !== element) {
        subElement = nodeDom;
      }
    } catch {
    }
  }

  const rect = resolveTargetRect(element, range, view);
  if (rect.width <= 0 || rect.height <= 0) return null;
  return { range, element, subElement, rect };
}

export function collectSelectableBlockTargets(
  view: EditorView,
  ranges?: readonly BlockRange[],
): SelectableBlockTarget[] {
  const targetRanges = ranges
    ? mapRangesToSelectableBlocks(view.state.doc, ranges)
    : collectSelectableBlockRanges(view.state.doc);
  if (targetRanges.length === 0) return [];

  const targets: SelectableBlockTarget[] = [];
  for (const range of targetRanges) {
    const directTarget = resolveDirectTopLevelTarget(view, range);
    if (directTarget) {
      targets.push(directTarget);
      continue;
    }

    const element = resolveRangeElement(view, range);
    if (!element) continue;

    let subElement: HTMLElement | undefined;
    if (element.tagName === 'LI') {
      try {
        const nodeDom = view.nodeDOM(range.from);
        if (nodeDom instanceof HTMLElement && element.contains(nodeDom) && nodeDom !== element) {
          subElement = nodeDom;
        }
      } catch {
      }
    }

    const rect = resolveTargetRect(element, range, view);
    if (rect.width <= 0 || rect.height <= 0) continue;

    targets.push({ range, element, subElement, rect });
  }
  return targets;
}
