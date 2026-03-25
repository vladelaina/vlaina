import type { EditorState } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { normalizeBlockRanges, type BlockRange } from './blockSelectionUtils';
import { resolveBlockElementAtPos, resolveTopLevelBlockElement } from './topLevelBlockDom';

export interface SelectableBlockTarget {
  range: BlockRange;
  element: HTMLElement;
  rect: DOMRect;
}

function isNonDraggableBlockNode(name: string): boolean {
  return name === 'frontmatter';
}

function isListContainerNode(name: string): boolean {
  return name === 'bullet_list' || name === 'ordered_list';
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

function collectListItemRanges(node: EditorState['doc'], itemFrom: number, ranges: BlockRange[]): void {
  const contentFrom = itemFrom + 1;
  let headTo = itemFrom + node.nodeSize;

  node.forEach((child, childOffset) => {
    if (!isListContainerNode(child.type.name)) return;
    const candidateHeadTo = contentFrom + childOffset;
    if (candidateHeadTo > itemFrom && candidateHeadTo < headTo) {
      headTo = candidateHeadTo;
    }
  });

  ranges.push({
    from: itemFrom,
    to: headTo,
  });

  node.forEach((child, childOffset) => {
    if (!isListContainerNode(child.type.name)) return;
    const listFrom = contentFrom + childOffset;
    collectListContainerRanges(child, listFrom, ranges);
  });
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

function resolveRangeElement(view: EditorView, range: BlockRange): HTMLElement | null {
  const listItemTo = getListItemRangeEnd(view.state.doc, range.from);
  if (listItemTo !== null) {
    const element = resolveListItemElement(view, range.from, range.to);
    if (element) return element;
  }

  const topLevelElement = resolveTopLevelBlockElement(view, range.from);
  if (topLevelElement) return topLevelElement;

  return resolveBlockElementAtPos(view, range.from);
}

function resolveTargetRect(element: HTMLElement): DOMRect {
  if (element.tagName !== 'LI') return element.getBoundingClientRect();

  const baseRect = element.getBoundingClientRect();
  const headElement = element.firstElementChild instanceof HTMLElement ? element.firstElementChild : null;
  if (!headElement) return baseRect;

  const headRect = headElement.getBoundingClientRect();
  const top = headRect.top;
  const bottom = headRect.bottom;
  const height = bottom - top;
  if (height <= 0 || baseRect.width <= 0) return baseRect;

  return {
    x: baseRect.left,
    y: top,
    left: baseRect.left,
    top,
    right: baseRect.right,
    bottom,
    width: baseRect.width,
    height,
    toJSON: () => ({}),
  } as DOMRect;
}

export function collectSelectableBlockRanges(doc: EditorState['doc']): BlockRange[] {
  const ranges: BlockRange[] = [];
  doc.forEach((node, offset) => {
    if (isListContainerNode(node.type.name)) {
      collectListContainerRanges(node, offset, ranges);
      return;
    }

    ranges.push({
      from: offset,
      to: offset + node.nodeSize,
    });
  });
  return ranges;
}

export function resolveSelectableBlockRange(doc: EditorState['doc'], pos: number): BlockRange | null {
  const docSize = doc.content.size;
  const safePos = Math.max(0, Math.min(pos, docSize));
  const ranges = collectSelectableBlockRanges(doc);
  if (ranges.length === 0) return null;

  for (const range of ranges) {
    if (safePos >= range.from && safePos < range.to) return range;
    if (safePos < range.from) return range;
  }
  return ranges[ranges.length - 1];
}

export function mapRangesToSelectableBlocks(
  doc: EditorState['doc'],
  ranges: readonly BlockRange[],
): BlockRange[] {
  if (ranges.length === 0) return [];
  const resolved = ranges
    .map((range) => resolveSelectableBlockRange(doc, range.from))
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

  const rect = resolveTargetRect(element);
  if (rect.width <= 0 || rect.height <= 0) return null;
  return { range, element, rect };
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

    const rect = resolveTargetRect(element);
    if (rect.width <= 0 || rect.height <= 0) continue;

    targets.push({ range, element, rect });
  }
  return targets;
}
