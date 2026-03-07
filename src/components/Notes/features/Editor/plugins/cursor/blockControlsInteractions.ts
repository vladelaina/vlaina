import { Fragment } from '@milkdown/kit/prose/model';
import { Selection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import type { BlockRange } from './blockSelectionUtils';
import { createBlockMovePlan, pickPointerBlock } from './blockControlsUtils';
import {
  collectSelectableBlockTargets,
  mapRangesToSelectableBlocks,
  resolveSelectableBlockTargetByPos,
} from './blockUnitResolver';
import {
  buildDeleteRangesFromSelectedListItems,
  collectSelectedListItemInfo,
  getRangeKey,
  isListContainerName,
  type SelectedListItemInfo,
} from './listBlockUtils';

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
interface WrappedListBuffer {
  type: SelectedListItemInfo['parentType'];
  attrs: SelectedListItemInfo['parentAttrs'];
  items: Array<SelectedListItemInfo['itemNode']>;
}

interface BlockMoveContext {
  selectedRanges: BlockRange[];
  listItemInfoByRangeKey: Map<string, SelectedListItemInfo>;
  deleteRanges: BlockRange[];
  targetPos: number;
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

interface PreparedBlockMove {
  tr: EditorView['state']['tr'];
  targetPos: number;
  movedContent: Fragment;
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

  const safeTargetPos = Math.max(0, Math.min(moveContext.targetPos, tr.doc.content.size));
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
