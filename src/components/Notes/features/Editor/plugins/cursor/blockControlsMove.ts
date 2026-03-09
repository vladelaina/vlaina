import { Fragment } from '@milkdown/kit/prose/model';
import { Selection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import type { BlockRange } from './blockSelectionUtils';
import { createBlockMovePlan } from './blockControlsUtils';
import {
  buildDeleteRangesFromSelectedListItems,
  collectSelectedListItemInfo,
  getRangeKey,
  isListContainerName,
  type LiftedListGroup,
  type SelectedListItemInfo,
} from './listBlockUtils';

const BLOCK_DRAG_DEBUG_FLAG = '__NEKO_DEBUG_BLOCK_DRAG__';

interface WrappedListBuffer {
  type: SelectedListItemInfo['parentType'];
  attrs: SelectedListItemInfo['parentAttrs'];
  items: Array<SelectedListItemInfo['moveItemNode']>;
}

interface BlockMoveContext {
  selectedRanges: BlockRange[];
  listItemInfoByRangeKey: Map<string, SelectedListItemInfo>;
  deleteRanges: BlockRange[];
  targetPos: number;
}

interface PreparedBlockMove {
  tr: EditorView['state']['tr'];
  targetPos: number;
  movedContent: Fragment;
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

function isInsertPosInsideRanges(insertPos: number, ranges: readonly BlockRange[]): boolean {
  return ranges.some((range) => insertPos >= range.from && insertPos <= range.to);
}

function resolveAdjustedTargetPos(insertPos: number, deleteRanges: readonly BlockRange[]): number {
  const deletedBeforeInsert = deleteRanges.reduce((total, range) => (
    range.to <= insertPos ? total + (range.to - range.from) : total
  ), 0);
  return insertPos - deletedBeforeInsert;
}

function resolveBlockMoveContext(
  view: EditorView,
  selectedRanges: readonly BlockRange[],
  insertPos: number,
): BlockMoveContext | null {
  const movePlan = createBlockMovePlan(selectedRanges, insertPos);
  if (!movePlan) return null;

  const listItemInfoByRangeKey = collectSelectedListItemInfo(view.state, movePlan.selectedRanges);
  const deleteRanges = buildDeleteRangesFromSelectedListItems(movePlan.selectedRanges, listItemInfoByRangeKey);
  if (deleteRanges.length === 0) return null;
  if (isInsertPosInsideRanges(insertPos, deleteRanges)) return null;

  const targetPos = resolveAdjustedTargetPos(insertPos, deleteRanges);
  if (targetPos === deleteRanges[0].from) return null;

  return {
    selectedRanges: movePlan.selectedRanges,
    listItemInfoByRangeKey,
    deleteRanges,
    targetPos,
  };
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

function buildLiftedSourceFragment(groups: readonly LiftedListGroup[], insertInsideList: boolean): Fragment {
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

function collectSourceResidualInsertions(
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
        wrappedListBuffer.items.push(info.moveItemNode);
      } else {
        content = appendListBuffer(content, wrappedListBuffer);
        wrappedListBuffer = {
          type: info.parentType,
          attrs: info.parentAttrs,
          items: [info.moveItemNode],
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

function prepareBlockMove(
  view: EditorView,
  moveContext: BlockMoveContext,
): PreparedBlockMove | null {
  const { state } = view;
  const { selectedRanges, listItemInfoByRangeKey, deleteRanges } = moveContext;

  let tr = state.tr;
  for (let i = deleteRanges.length - 1; i >= 0; i -= 1) {
    const range = deleteRanges[i];
    tr = tr.delete(range.from, range.to);
  }

  let safeTargetPos = Math.max(0, Math.min(moveContext.targetPos, tr.doc.content.size));

  const sourceResidualInsertions = collectSourceResidualInsertions(selectedRanges, listItemInfoByRangeKey)
    .map((insertion) => ({
      pos: tr.mapping.map(insertion.from, -1),
      groups: insertion.groups,
    }))
    .sort((a, b) => a.pos - b.pos);

  let sourceInsertionOffset = 0;
  for (const insertion of sourceResidualInsertions) {
    const pos = Math.max(0, Math.min(insertion.pos + sourceInsertionOffset, tr.doc.content.size));
    const fragment = buildLiftedSourceFragment(insertion.groups, isInsertionInsideList(tr.doc, pos));
    if (fragment.size === 0) continue;

    const $pos = tr.doc.resolve(pos);
    const index = $pos.index();
    if (!$pos.parent.canReplace(index, index, fragment)) continue;

    tr = tr.insert(pos, fragment);
    sourceInsertionOffset += fragment.size;
    if (pos <= safeTargetPos) {
      safeTargetPos += fragment.size;
    }
  }

  safeTargetPos = Math.max(0, Math.min(safeTargetPos, tr.doc.content.size));
  const insertInsideList = isInsertionInsideList(tr.doc, safeTargetPos);
  const movedContent = buildMovedContent(view, selectedRanges, listItemInfoByRangeKey, insertInsideList);
  if (movedContent.size === 0) return null;

  const $target = tr.doc.resolve(safeTargetPos);
  const targetIndex = $target.index();
  if (!$target.parent.canReplace(targetIndex, targetIndex, movedContent)) return null;

  return {
    tr,
    targetPos: safeTargetPos,
    movedContent,
  };
}

export function canApplyBlockMove(view: EditorView, selectedRanges: readonly BlockRange[], insertPos: number): boolean {
  const moveContext = resolveBlockMoveContext(view, selectedRanges, insertPos);
  if (!moveContext) return false;
  return prepareBlockMove(view, moveContext) !== null;
}

export function applyBlockMove(view: EditorView, selectedRanges: readonly BlockRange[], insertPos: number): boolean {
  const moveContext = resolveBlockMoveContext(view, selectedRanges, insertPos);
  if (!moveContext) return false;

  try {
    const preparedMove = prepareBlockMove(view, moveContext);
    if (!preparedMove) return false;

    let tr = preparedMove.tr.insert(preparedMove.targetPos, preparedMove.movedContent);

    const selectionAnchor = Math.max(0, Math.min(preparedMove.targetPos + 1, tr.doc.content.size));
    tr = tr.setSelection(Selection.near(tr.doc.resolve(selectionAnchor), 1)).scrollIntoView();
    view.dispatch(tr);
    view.focus();
    return true;
  } catch (error) {
    logBlockDragDebug('applyBlockMove failed', error);
    return false;
  }
}
