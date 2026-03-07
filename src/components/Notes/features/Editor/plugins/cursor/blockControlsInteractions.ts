import { Fragment, type Node as ProseNode, type NodeType } from '@milkdown/kit/prose/model';
import { Selection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import type { BlockRange } from './blockSelectionUtils';
import { createBlockMovePlan, pickPointerBlock } from './blockControlsUtils';
import {
  collectSelectableBlockTargets,
  mapRangesToSelectableBlocks,
  resolveSelectableBlockTargetByPos,
} from './blockUnitResolver';

export interface HandleBlockTarget {
  pos: number;
  rect: DOMRect;
}

export interface DropTarget {
  insertPos: number;
  lineY: number;
  lineLeft: number;
  lineWidth: number;
}

const BLOCK_DRAG_DEBUG_FLAG = '__NEKO_DEBUG_BLOCK_DRAG__';
const LIST_ITEM_NODE_NAME = 'list_item';

interface SelectedListItemInfo {
  range: BlockRange;
  itemNode: ProseNode;
  parentFrom: number;
  parentTo: number;
  parentType: NodeType;
  parentAttrs: Record<string, unknown>;
  parentChildCount: number;
}

interface WrappedListBuffer {
  type: SelectedListItemInfo['parentType'];
  attrs: SelectedListItemInfo['parentAttrs'];
  items: Array<SelectedListItemInfo['itemNode']>;
}

function logBlockDragDebug(message: string, error?: unknown): void {
  if (typeof window === 'undefined') return;
  const debugEnabled = Boolean((window as unknown as Record<string, unknown>)[BLOCK_DRAG_DEBUG_FLAG]);
  if (!debugEnabled) return;
  if (error) {
    console.warn('[BlockDrag]', message, error);
    return;
  }
  console.warn('[BlockDrag]', message);
}

function getRangeKey(range: BlockRange): string {
  return `${range.from}:${range.to}`;
}

function isListContainerName(name: string): boolean {
  return name === 'bullet_list' || name === 'ordered_list';
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

function getSelectedListItemInfo(
  view: EditorView,
  range: BlockRange,
): SelectedListItemInfo | null {
  const { doc } = view.state;
  const safeFrom = Math.max(0, Math.min(range.from, doc.content.size));
  const $from = doc.resolve(safeFrom);
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

function buildDeleteRanges(
  selectedRanges: readonly BlockRange[],
  listItemInfoByRangeKey: Map<string, SelectedListItemInfo>,
): BlockRange[] {
  if (selectedRanges.length === 0) return [];

  const selectedCountByParent = new Map<string, number>();
  const parentInfoByKey = new Map<string, SelectedListItemInfo>();
  for (const range of selectedRanges) {
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
  for (const range of selectedRanges) {
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

  deleteRanges.sort((a, b) => (a.from === b.from ? a.to - b.to : a.from - b.from));
  return deleteRanges;
}

function isInsertPosInsideRanges(insertPos: number, ranges: readonly BlockRange[]): boolean {
  return ranges.some((range) => insertPos >= range.from && insertPos <= range.to);
}

function resolveAdjustedTargetPos(insertPos: number, deleteRanges: readonly BlockRange[]): number {
  const deletedBeforeInsert = deleteRanges.reduce((total, range) => (
    range.to <= insertPos ? total + (range.to - range.from) : total
  ), 0);
  return insertPos - deletedBeforeInsert;
}

function isInsertionInsideList(doc: EditorView['state']['doc'], pos: number): boolean {
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

function buildMovedContent(
  view: EditorView,
  selectedRanges: readonly BlockRange[],
  listItemInfoByRangeKey: Map<string, SelectedListItemInfo>,
  insertInsideList: boolean,
): Fragment {
  let content = Fragment.empty;
  let wrappedListBuffer: WrappedListBuffer | null = null;

  for (const range of selectedRanges) {
    const info = listItemInfoByRangeKey.get(getRangeKey(range));
    if (info && !insertInsideList) {
      if (
        wrappedListBuffer
        && wrappedListBuffer.type === info.parentType
        && areNodeAttrsEqual(wrappedListBuffer.attrs, info.parentAttrs)
      ) {
        wrappedListBuffer.items.push(info.itemNode);
      } else {
        content = appendListBuffer(content, wrappedListBuffer);
        wrappedListBuffer = {
          type: info.parentType,
          attrs: info.parentAttrs,
          items: [info.itemNode],
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

export function resolveBlockTargetByPos(view: EditorView, blockPos: number): HandleBlockTarget | null {
  const target = resolveSelectableBlockTargetByPos(view, blockPos);
  if (!target) return null;
  return { pos: target.range.from, rect: target.rect };
}

export function setControlsPosition(
  controls: HTMLElement,
  target: HandleBlockTarget,
  controlsLeftOffset: number,
): void {
  const left = Math.max(8, target.rect.left - controlsLeftOffset);
  const top = target.rect.top + target.rect.height / 2;
  controls.style.left = `${Math.round(left)}px`;
  controls.style.top = `${Math.round(top)}px`;
}

export function getDraggableBlockRanges(view: EditorView, selectedRanges: readonly BlockRange[]): BlockRange[] {
  return mapRangesToSelectableBlocks(view.state.doc, selectedRanges);
}

export function resolveDropTarget(view: EditorView, clientX: number, clientY: number): DropTarget | null {
  const editorRect = view.dom.getBoundingClientRect();
  const pos = view.posAtCoords({ left: clientX, top: clientY });
  if (!pos && clientY >= editorRect.top && clientY <= editorRect.bottom) {
    return null;
  }

  const blockTargets = collectSelectableBlockTargets(view);
  const target = pickPointerBlock(blockTargets, clientY);
  if (!target) return null;

  const rect = target.rect;
  const insertBefore = clientY < rect.top + rect.height / 2;
  return {
    insertPos: insertBefore ? target.range.from : target.range.to,
    lineY: insertBefore ? rect.top : rect.bottom,
    lineLeft: rect.left,
    lineWidth: rect.width,
  };
}

export function applyBlockMove(view: EditorView, selectedRanges: readonly BlockRange[], insertPos: number): boolean {
  const { state } = view;
  const movePlan = createBlockMovePlan(selectedRanges, insertPos);
  if (!movePlan) return false;

  try {
    const listItemInfoByRangeKey = new Map<string, SelectedListItemInfo>();
    for (const range of movePlan.selectedRanges) {
      const info = getSelectedListItemInfo(view, range);
      if (!info) continue;
      listItemInfoByRangeKey.set(getRangeKey(range), info);
    }

    const deleteRanges = buildDeleteRanges(movePlan.selectedRanges, listItemInfoByRangeKey);
    if (deleteRanges.length === 0) return false;
    if (isInsertPosInsideRanges(insertPos, deleteRanges)) return false;

    const targetPos = resolveAdjustedTargetPos(insertPos, deleteRanges);

    let tr = state.tr;
    for (let i = deleteRanges.length - 1; i >= 0; i -= 1) {
      const range = deleteRanges[i];
      tr = tr.delete(range.from, range.to);
    }

    const insertInsideList = isInsertionInsideList(tr.doc, targetPos);
    const movedContent = buildMovedContent(view, movePlan.selectedRanges, listItemInfoByRangeKey, insertInsideList);
    if (movedContent.size === 0) return false;

    tr = tr.insert(targetPos, movedContent);

    const selectionAnchor = Math.max(0, Math.min(targetPos + 1, tr.doc.content.size));
    tr = tr.setSelection(Selection.near(tr.doc.resolve(selectionAnchor), 1)).scrollIntoView();
    view.dispatch(tr);
    view.focus();
    return true;
  } catch (error) {
    logBlockDragDebug('applyBlockMove failed', error);
    return false;
  }
}
