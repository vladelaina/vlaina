import type { Node as ProseNode, NodeType } from '@milkdown/kit/prose/model';
import type { EditorState } from '@milkdown/kit/prose/state';
import { normalizeBlockRanges, type BlockRange } from './blockSelectionUtils';

const LIST_ITEM_NODE_NAME = 'list_item';

interface ParentRangeInfo {
  parentFrom: number;
  parentTo: number;
  parentChildCount: number;
}

export interface SelectedListItemInfo extends ParentRangeInfo {
  range: BlockRange;
  itemNode: ProseNode;
  parentType: NodeType;
  parentAttrs: Record<string, unknown>;
}

export function getRangeKey(range: BlockRange): string {
  return `${range.from}:${range.to}`;
}

export function isListContainerName(name: string): boolean {
  return name === 'bullet_list' || name === 'ordered_list';
}

export function getSelectedListItemInfo(state: EditorState, range: BlockRange): SelectedListItemInfo | null {
  const safeFrom = Math.max(0, Math.min(range.from, state.doc.content.size));
  const $from = state.doc.resolve(safeFrom);
  const nodeAfter = $from.nodeAfter;
  if (!nodeAfter) return null;
  if (nodeAfter.type.name !== LIST_ITEM_NODE_NAME) return null;
  if (nodeAfter.nodeSize !== range.to - range.from) return null;
  if (!isListContainerName($from.parent.type.name)) return null;
  if ($from.depth <= 0) return null;

  const parentFrom = $from.before($from.depth);
  const parentNode = $from.parent;
  return {
    range,
    itemNode: nodeAfter,
    parentFrom,
    parentTo: parentFrom + parentNode.nodeSize,
    parentType: parentNode.type,
    parentAttrs: parentNode.attrs,
    parentChildCount: parentNode.childCount,
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
    deleteRanges.push(range);
  }

  for (const parentKey of fullySelectedParents) {
    const info = parentInfoByKey.get(parentKey);
    if (!info) continue;
    deleteRanges.push({
      from: info.parentFrom,
      to: info.parentTo,
    });
  }

  return normalizeBlockRanges(deleteRanges);
}

export function buildDeleteRangesForBlockSelection(state: EditorState, ranges: readonly BlockRange[]): BlockRange[] {
  const normalized = normalizeBlockRanges(ranges);
  if (normalized.length === 0) return [];
  const listInfo = collectSelectedListItemInfo(state, normalized);
  return buildDeleteRangesFromSelectedListItems(normalized, listInfo);
}
