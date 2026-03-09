import type { Node as ProseNode, NodeType } from '@milkdown/kit/prose/model';
import type { EditorState } from '@milkdown/kit/prose/state';
import { normalizeBlockRanges, type BlockRange } from './blockSelectionUtils';

const LIST_ITEM_NODE_NAME = 'list_item';

interface ParentRangeInfo {
  parentFrom: number;
  parentTo: number;
  parentChildCount: number;
  deleteFrom: number;
  deleteTo: number;
}

export interface LiftedListItemInfo {
  from: number;
  to: number;
  node: ProseNode;
}

export interface LiftedListGroup {
  type: NodeType;
  attrs: Record<string, unknown>;
  items: LiftedListItemInfo[];
}

export interface SelectedListItemInfo extends ParentRangeInfo {
  range: BlockRange;
  moveItemNode: ProseNode;
  itemFrom: number;
  itemTo: number;
  liftedListGroups: LiftedListGroup[];
  parentType: NodeType;
  parentAttrs: Record<string, unknown>;
}

export function getRangeKey(range: BlockRange): string {
  return `${range.from}:${range.to}`;
}

export function isListContainerName(name: string): boolean {
  return name === 'bullet_list' || name === 'ordered_list';
}

function collectLiftedListGroups(itemNode: ProseNode, itemFrom: number, selectedTo: number): LiftedListGroup[] {
  const contentFrom = itemFrom + 1;
  const groups: LiftedListGroup[] = [];

  itemNode.forEach((child, childOffset) => {
    if (!isListContainerName(child.type.name)) return;
    const childFrom = contentFrom + childOffset;
    if (childFrom < selectedTo) return;

    const items: LiftedListItemInfo[] = [];
    const listContentFrom = childFrom + 1;
    child.forEach((grandChild, grandChildOffset) => {
      if (grandChild.type.name !== LIST_ITEM_NODE_NAME) return;
      const from = listContentFrom + grandChildOffset;
      items.push({
        from,
        to: from + grandChild.nodeSize,
        node: grandChild,
      });
    });

    if (items.length === 0) return;
    groups.push({
      type: child.type,
      attrs: child.attrs,
      items,
    });
  });

  return groups;
}

function buildMoveItemNode(itemNode: ProseNode, itemFrom: number, selectedTo: number): ProseNode {
  if (selectedTo >= itemFrom + itemNode.nodeSize) {
    return itemNode;
  }

  const selectedContentTo = selectedTo - (itemFrom + 1);
  const moveChildren: ProseNode[] = [];
  itemNode.forEach((child, childOffset) => {
    if (childOffset + child.nodeSize > selectedContentTo) return;
    moveChildren.push(child);
  });

  if (moveChildren.length === 0) {
    return itemNode;
  }

  return itemNode.type.create(itemNode.attrs, moveChildren);
}

export function getSelectedListItemInfo(state: EditorState, range: BlockRange): SelectedListItemInfo | null {
  const safeFrom = Math.max(0, Math.min(range.from, state.doc.content.size));
  const $from = state.doc.resolve(safeFrom);
  const nodeAfter = $from.nodeAfter;
  if (!nodeAfter) return null;
  if (nodeAfter.type.name !== LIST_ITEM_NODE_NAME) return null;
  const itemFrom = range.from;
  const itemTo = itemFrom + nodeAfter.nodeSize;
  if (range.to > itemTo || range.to <= range.from) return null;
  if (!isListContainerName($from.parent.type.name)) return null;
  if ($from.depth <= 0) return null;

  const parentFrom = $from.before($from.depth);
  const parentNode = $from.parent;
  const selectedTo = Math.min(range.to, itemTo);
  const moveItemNode = buildMoveItemNode(nodeAfter, itemFrom, selectedTo);
  const liftedListGroups = collectLiftedListGroups(nodeAfter, itemFrom, selectedTo);
  return {
    range,
    moveItemNode,
    itemFrom,
    itemTo,
    liftedListGroups,
    parentFrom,
    parentTo: parentFrom + parentNode.nodeSize,
    parentType: parentNode.type,
    parentAttrs: parentNode.attrs,
    parentChildCount: parentNode.childCount,
    deleteFrom: itemFrom,
    deleteTo: itemTo,
  };
}

export function collectSelectedListItemInfo(
  state: EditorState,
  ranges: readonly BlockRange[],
): Map<string, SelectedListItemInfo> {
  const map = new Map<string, SelectedListItemInfo>();
  for (const range of ranges) {
    const info = getSelectedListItemInfo(state, range);
    if (!info) continue;
    map.set(getRangeKey(range), info);
  }
  return map;
}

export function buildDeleteRangesFromSelectedListItems(
  ranges: readonly BlockRange[],
  listItemInfoByRangeKey: ReadonlyMap<string, ParentRangeInfo>,
): BlockRange[] {
  if (ranges.length === 0) return [];
  const normalized = normalizeBlockRanges(ranges);
  if (normalized.length === 0) return [];

  const selectedCountByParent = new Map<string, number>();
  const parentInfoByKey = new Map<string, ParentRangeInfo>();

  for (const range of normalized) {
    const info = listItemInfoByRangeKey.get(getRangeKey(range));
    if (!info) continue;
    const parentKey = `${info.parentFrom}:${info.parentTo}`;
    selectedCountByParent.set(parentKey, (selectedCountByParent.get(parentKey) ?? 0) + 1);
    parentInfoByKey.set(parentKey, info);
  }

  const fullySelectedParents = new Set<string>();
  for (const [parentKey, count] of selectedCountByParent) {
    const info = parentInfoByKey.get(parentKey);
    if (!info) continue;
    if (count === info.parentChildCount) {
      fullySelectedParents.add(parentKey);
    }
  }

  const deleteRanges: BlockRange[] = [];
  for (const range of normalized) {
    const info = listItemInfoByRangeKey.get(getRangeKey(range));
    if (!info) {
      deleteRanges.push(range);
      continue;
    }

    const parentKey = `${info.parentFrom}:${info.parentTo}`;
    if (fullySelectedParents.has(parentKey)) continue;
    deleteRanges.push({
      from: info.deleteFrom,
      to: info.deleteTo,
    });
  }

  for (const parentKey of fullySelectedParents) {
    const info = parentInfoByKey.get(parentKey);
    if (!info) continue;
    deleteRanges.push({
      from: info.parentFrom,
      to: info.parentTo,
    });
  }

  const normalizedDeleteRanges = normalizeBlockRanges(deleteRanges);
  if (normalizedDeleteRanges.length <= 1) return normalizedDeleteRanges;

  const merged: BlockRange[] = [normalizedDeleteRanges[0]];
  for (let i = 1; i < normalizedDeleteRanges.length; i += 1) {
    const current = normalizedDeleteRanges[i];
    const last = merged[merged.length - 1];
    if (current.from <= last.to) {
      if (current.to > last.to) {
        last.to = current.to;
      }
      continue;
    }
    merged.push({ ...current });
  }
  return merged;
}

export function buildDeleteRangesForBlockSelection(state: EditorState, ranges: readonly BlockRange[]): BlockRange[] {
  const normalized = normalizeBlockRanges(ranges);
  if (normalized.length === 0) return [];
  const listInfo = collectSelectedListItemInfo(state, normalized);
  return buildDeleteRangesFromSelectedListItems(normalized, listInfo);
}
