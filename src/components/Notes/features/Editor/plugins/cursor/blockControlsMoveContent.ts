import { Fragment } from '@milkdown/kit/prose/model';
import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import type { EditorView } from '@milkdown/kit/prose/view';
import type { BlockRange } from './blockSelectionUtils';
import {
  getRangeKey,
  isListContainerName,
  type LiftedListGroup,
  type SelectedListItemInfo,
} from './listBlockUtils';

interface WrappedListBuffer {
  type: SelectedListItemInfo['parentType'];
  attrs: SelectedListItemInfo['parentAttrs'];
  items: Array<SelectedListItemInfo['moveItemNode']>;
}

function areNodeAttrsEqual(
  a: SelectedListItemInfo['parentAttrs'],
  b: SelectedListItemInfo['parentAttrs'],
): boolean {
  if (a === b) return true;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

export function isInsertionInsideList(doc: EditorView['state']['doc'], pos: number): boolean {
  const safePos = Math.max(0, Math.min(pos, doc.content.size));
  const $pos = doc.resolve(safePos);
  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    const node = $pos.node(depth);
    if (!isListContainerName(node.type.name)) continue;
    const nodeFrom = $pos.before(depth);
    const contentFrom = nodeFrom + 1;
    const contentTo = nodeFrom + node.nodeSize - 1;
    if (safePos >= contentFrom && safePos <= contentTo) {
      return true;
    }
  }
  return false;
}

function appendListBuffer(target: Fragment, buffer: WrappedListBuffer | null): Fragment {
  if (!buffer || buffer.items.length === 0) return target;
  const wrappedList = buffer.type.create(buffer.attrs, buffer.items);
  return target.append(Fragment.from(wrappedList));
}

export function buildLiftedSourceFragment(groups: readonly LiftedListGroup[], insertInsideList: boolean): Fragment {
  if (groups.length === 0) return Fragment.empty;

  let fragment = Fragment.empty;
  if (insertInsideList) {
    for (const group of groups) {
      for (const item of group.items) {
        fragment = fragment.append(Fragment.from(item.node));
      }
    }
    return fragment;
  }

  for (const group of groups) {
    if (group.items.length === 0) continue;
    const wrappedList = group.type.create(
      group.attrs,
      group.items.map((item) => item.node),
    );
    fragment = fragment.append(Fragment.from(wrappedList));
  }
  return fragment;
}

export function collectSourceResidualInsertions(
  selectedRanges: readonly BlockRange[],
  listItemInfoByRangeKey: ReadonlyMap<string, SelectedListItemInfo>,
): Array<{ from: number; groups: LiftedListGroup[] }> {
  if (selectedRanges.length === 0) return [];

  const selectedRangeFromSet = new Set(selectedRanges.map((range) => range.from));
  const insertions: Array<{ from: number; groups: LiftedListGroup[] }> = [];

  for (const range of selectedRanges) {
    const info = listItemInfoByRangeKey.get(getRangeKey(range));
    if (!info || info.liftedListGroups.length === 0) continue;

    const groups = info.liftedListGroups
      .map((group) => ({
        type: group.type,
        attrs: group.attrs,
        items: group.items.filter((item) => !selectedRangeFromSet.has(item.from)),
      }))
      .filter((group) => group.items.length > 0);
    if (groups.length === 0) continue;

    insertions.push({
      from: info.range.from,
      groups,
    });
  }

  return insertions;
}

function createSelectedListItemInfoByFrom(
  selectedRanges: readonly BlockRange[],
  listItemInfoByRangeKey: ReadonlyMap<string, SelectedListItemInfo>,
): Map<number, SelectedListItemInfo> {
  const selectedInfoByFrom = new Map<number, SelectedListItemInfo>();
  for (const range of selectedRanges) {
    const info = listItemInfoByRangeKey.get(getRangeKey(range));
    if (!info) continue;
    selectedInfoByFrom.set(range.from, info);
  }
  return selectedInfoByFrom;
}

function collectNestedSelectedListItemStarts(
  selectedInfoByFrom: ReadonlyMap<number, SelectedListItemInfo>,
): Set<number> {
  const nestedSelectedStarts = new Set<number>();
  for (const info of selectedInfoByFrom.values()) {
    for (const group of info.liftedListGroups) {
      for (const item of group.items) {
        if (!selectedInfoByFrom.has(item.from)) continue;
        nestedSelectedStarts.add(item.from);
      }
    }
  }
  return nestedSelectedStarts;
}

function buildSelectedListItemNode(
  info: SelectedListItemInfo,
  selectedInfoByFrom: ReadonlyMap<number, SelectedListItemInfo>,
  cache: Map<number, ProseNode>,
): ProseNode {
  const cached = cache.get(info.range.from);
  if (cached) return cached;

  const children: ProseNode[] = [];
  info.moveItemNode.forEach((child) => {
    children.push(child);
  });

  for (const group of info.liftedListGroups) {
    const selectedChildNodes = group.items
      .map((item) => selectedInfoByFrom.get(item.from))
      .filter((childInfo): childInfo is SelectedListItemInfo => childInfo !== undefined)
      .map((childInfo) => buildSelectedListItemNode(childInfo, selectedInfoByFrom, cache));

    if (selectedChildNodes.length === 0) continue;
    children.push(group.type.create(group.attrs, selectedChildNodes));
  }

  const nextNode = info.moveItemNode.type.create(info.moveItemNode.attrs, children);
  cache.set(info.range.from, nextNode);
  return nextNode;
}

export function buildMovedContent(
  view: EditorView,
  selectedRanges: readonly BlockRange[],
  listItemInfoByRangeKey: Map<string, SelectedListItemInfo>,
  insertInsideList: boolean,
): Fragment {
  let content = Fragment.empty;
  let wrappedListBuffer: WrappedListBuffer | null = null;
  const selectedInfoByFrom = createSelectedListItemInfoByFrom(selectedRanges, listItemInfoByRangeKey);
  const nestedSelectedStarts = collectNestedSelectedListItemStarts(selectedInfoByFrom);
  const moveNodeCache = new Map<number, ProseNode>();

  for (const range of selectedRanges) {
    const info = listItemInfoByRangeKey.get(getRangeKey(range));
    if (info) {
      if (nestedSelectedStarts.has(range.from)) {
        continue;
      }

      const moveItemNode = buildSelectedListItemNode(info, selectedInfoByFrom, moveNodeCache);
      if (insertInsideList) {
        content = appendListBuffer(content, wrappedListBuffer);
        wrappedListBuffer = null;
        content = content.append(Fragment.from(moveItemNode));
        continue;
      }

      if (
        wrappedListBuffer
        && wrappedListBuffer.type === info.parentType
        && areNodeAttrsEqual(wrappedListBuffer.attrs, info.parentAttrs)
      ) {
        wrappedListBuffer.items.push(moveItemNode);
      } else {
        content = appendListBuffer(content, wrappedListBuffer);
        wrappedListBuffer = {
          type: info.parentType,
          attrs: info.parentAttrs,
          items: [moveItemNode],
        };
      }
      continue;
    }

    content = appendListBuffer(content, wrappedListBuffer);
    wrappedListBuffer = null;
    content = content.append(view.state.doc.slice(range.from, range.to).content);
  }

  return appendListBuffer(content, wrappedListBuffer);
}
