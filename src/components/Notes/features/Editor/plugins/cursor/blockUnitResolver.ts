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

export interface SelectableBlockTarget {
  range: BlockRange;
  element: HTMLElement;
  subElement?: HTMLElement;
  rect: DOMRect;
}

function isNonDraggableBlockNode(name: string): boolean {
  return name === 'frontmatter';
}

function isListContainerNode(name: string): boolean {
  return LIST_CONTAINER_NODE_NAMES.has(name);
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

function isParagraphNode(name: string): boolean {
  return name === 'paragraph';
}

function isHardBreakNode(name: string): boolean {
  return name === 'hardbreak' || name === 'hard_break';
}

function collectParagraphLineRanges(node: EditorState['doc'], paragraphFrom: number): BlockRange[] | null {
  const contentFrom = paragraphFrom + 1;
  const contentTo = paragraphFrom + node.nodeSize - 1;
  let lineFrom = contentFrom;
  let hasHardBreak = false;
  const ranges: BlockRange[] = [];

  node.forEach((child, childOffset) => {
    if (!isHardBreakNode(child.type.name)) return;

    hasHardBreak = true;
    const breakTo = contentFrom + childOffset + child.nodeSize;
    if (breakTo > lineFrom) {
      ranges.push({ from: lineFrom, to: breakTo });
    }
    lineFrom = breakTo;
  });

  if (!hasHardBreak) return null;

  if (lineFrom < contentTo) {
    ranges.push({ from: lineFrom, to: contentTo });
  }

  return ranges.length > 0 ? ranges : null;
}

function collectListItemRanges(node: EditorState['doc'], itemFrom: number, ranges: BlockRange[]): void {
  const contentFrom = itemFrom + 1;
  let firstChild = true;
  let headerRangeTo: number | null = null;

  node.forEach((child, childOffset) => {
    const childFrom = contentFrom + childOffset;
    const isList = isListContainerNode(child.type.name);

    if (isList) {
      if (headerRangeTo !== null) {
        ranges.push({ from: itemFrom, to: headerRangeTo });
        headerRangeTo = null;
      }
      collectListContainerRanges(child, childFrom, ranges);
    } else {
      const isComplexBlock = COMPLEX_LIST_ITEM_CHILD_NODE_NAMES.has(child.type.name);

      if (firstChild) {
        if (isComplexBlock) {
          ranges.push({ from: itemFrom, to: childFrom });
          ranges.push({ from: childFrom, to: childFrom + child.nodeSize });
        } else {
          headerRangeTo = childFrom + child.nodeSize;
        }
        firstChild = false;
      } else if (headerRangeTo !== null && isComplexBlock) {
        ranges.push({ from: childFrom, to: childFrom + child.nodeSize });
        headerRangeTo = childFrom + child.nodeSize;
      } else {
        ranges.push({ from: childFrom, to: childFrom + child.nodeSize });
      }
    }
  });

  if (headerRangeTo !== null) {
    ranges.push({ from: itemFrom, to: itemFrom + node.nodeSize });
  } else if (firstChild) {
    ranges.push({ from: itemFrom, to: itemFrom + node.nodeSize });
  }
}

function collectListContainerRanges(node: EditorState['doc'], listFrom: number, ranges: BlockRange[]): void {
  const contentFrom = listFrom + 1;
  node.forEach((child, childOffset) => {
    if (child.type.name !== 'list_item') return;
    const itemFrom = contentFrom + childOffset;
    collectListItemRanges(child, itemFrom, ranges);
  });
}

function getListItemRangeEnd(doc: EditorState['doc'], from: number): number | null {
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

function resolveDOMRangeRect(view: EditorView, range: BlockRange): DOMRect | null {
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

    for (const rect of Array.from(domRange.getClientRects())) {
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

export function collectSelectableBlockRanges(doc: EditorState['doc']): BlockRange[] {
  const ranges: BlockRange[] = [];
  doc.forEach((node, offset) => {
    if (isListContainerNode(node.type.name)) {
      collectListContainerRanges(node, offset, ranges);
      return;
    }

    const paragraphLineRanges = isParagraphNode(node.type.name)
      ? collectParagraphLineRanges(node, offset)
      : null;
    if (paragraphLineRanges) {
      ranges.push(...paragraphLineRanges);
      return;
    }

    ranges.push({
      from: offset,
      to: offset + node.nodeSize,
    });
  });
  return ranges;
}

export function isInlineSelectableBlockRange(doc: EditorState['doc'], range: BlockRange): boolean {
  const topLevelNode = resolveTopLevelNodeAtPos(doc, range.from);
  if (!topLevelNode || topLevelNode.name !== 'paragraph') return false;
  return range.from > topLevelNode.from || range.to < topLevelNode.to;
}

export function mapInlineSelectableRangesToMovableBlocks(
  doc: EditorState['doc'],
  ranges: readonly BlockRange[],
): BlockRange[] {
  if (ranges.length === 0) return [];
  const movableRanges = ranges.map((range) => {
    if (!isInlineSelectableBlockRange(doc, range)) return range;
    return resolveTopLevelRangeAtPos(doc, range.from) ?? range;
  });
  return normalizeBlockRanges(movableRanges);
}

export function collectMovableBlockTargetRanges(doc: EditorState['doc']): BlockRange[] {
  return mapInlineSelectableRangesToMovableBlocks(doc, collectSelectableBlockRanges(doc));
}

export function resolveSelectableBlockRange(doc: EditorState['doc'], pos: number): BlockRange | null {
  const docSize = doc.content.size;
  const safePos = Math.max(0, Math.min(pos, docSize));
  const ranges = collectSelectableBlockRanges(doc);
  if (ranges.length === 0) return null;

  let bestRange: BlockRange | null = null;
  let minSize = Number.POSITIVE_INFINITY;

  for (const range of ranges) {
    if (safePos >= range.from && safePos < range.to) {
      const size = range.to - range.from;
      if (size < minSize) {
        minSize = size;
        bestRange = range;
      }
    }
  }

  if (bestRange) {
    return bestRange;
  }

  for (const range of ranges) {
    if (safePos < range.from) {
      return range;
    }
  }
  const last = ranges[ranges.length - 1];
  return last;
}

export function mapRangesToSelectableBlocks(
  doc: EditorState['doc'],
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

export function isNonDraggableBlockRange(doc: EditorState['doc'], range: BlockRange): boolean {
  const topLevelNode = resolveTopLevelNodeAtPos(doc, range.from);
  if (!topLevelNode) return false;
  return topLevelNode.from === range.from && isNonDraggableBlockNode(topLevelNode.name);
}

export function expandListItemHeaderRanges(
  doc: EditorState['doc'],
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

export function resolveSelectableBlockTargetByPos(view: EditorView, blockPos: number): SelectableBlockTarget | null {
  const range = resolveSelectableBlockRange(view.state.doc, blockPos);
  if (!range) return null;

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
