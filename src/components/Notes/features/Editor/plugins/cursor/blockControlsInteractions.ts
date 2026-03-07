import { Fragment } from '@milkdown/kit/prose/model';
import { Selection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import type { BlockRange } from './blockSelectionUtils';
import { createBlockMovePlan, mapRangesToTopLevelBlocks } from './blockControlsUtils';
import { normalizeTopLevelBlockPos, resolveTopLevelBlockElement } from './topLevelBlockDom';

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

export function resolveTopLevelBlockRange(view: EditorView, blockPos: number): BlockRange | null {
  const normalizedPos = normalizeTopLevelBlockPos(view, blockPos);
  if (normalizedPos === null) return null;

  const blockNode = view.state.doc.nodeAt(normalizedPos);
  if (!blockNode) return null;
  return {
    from: normalizedPos,
    to: normalizedPos + blockNode.nodeSize,
  };
}

export function resolveBlockTargetByPos(view: EditorView, blockPos: number): HandleBlockTarget | null {
  const topLevelRange = resolveTopLevelBlockRange(view, blockPos);
  if (!topLevelRange) return null;

  const blockElement = resolveTopLevelBlockElement(view, topLevelRange.from);
  if (!blockElement) return null;

  const rect = blockElement.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return { pos: topLevelRange.from, rect };
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
  return mapRangesToTopLevelBlocks(selectedRanges, (pos) => resolveTopLevelBlockRange(view, pos));
}

export function resolveDropTarget(view: EditorView, clientX: number, clientY: number): DropTarget | null {
  const pos = view.posAtCoords({ left: clientX, top: clientY });
  const editorRect = view.dom.getBoundingClientRect();

  if (!pos && clientY > editorRect.bottom) {
    let lastFrom = -1;
    let lastNodeSize = 0;
    view.state.doc.forEach((node, offset) => {
      lastFrom = offset;
      lastNodeSize = node.nodeSize;
    });
    if (lastFrom < 0) return null;

    const lastElement = resolveTopLevelBlockElement(view, lastFrom);
    const lastRect = lastElement?.getBoundingClientRect();
    const lineY = lastRect?.bottom ?? editorRect.bottom;
    const lineLeft = lastRect?.left ?? editorRect.left;
    const lineWidth = lastRect?.width ?? editorRect.width;
    return {
      insertPos: lastFrom + lastNodeSize,
      lineY,
      lineLeft,
      lineWidth,
    };
  }

  if (!pos) return null;

  const docSize = view.state.doc.content.size;
  const safePos = Math.max(0, Math.min(pos.pos, docSize));
  const $pos = view.state.doc.resolve(safePos);
  let indexAtRoot = $pos.index(0);
  if (indexAtRoot >= view.state.doc.childCount) {
    indexAtRoot = view.state.doc.childCount - 1;
  }
  if (indexAtRoot < 0) return null;

  const blockPos = $pos.posAtIndex(indexAtRoot, 0);
  const blockNode = view.state.doc.child(indexAtRoot);
  if (!blockNode) return null;

  const blockElement = resolveTopLevelBlockElement(view, blockPos);
  if (!blockElement) return null;
  const rect = blockElement.getBoundingClientRect();
  const insertBefore = clientY < rect.top + rect.height / 2;
  return {
    insertPos: insertBefore ? blockPos : blockPos + blockNode.nodeSize,
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
    let movedContent = Fragment.empty;
    for (const range of movePlan.selectedRanges) {
      movedContent = movedContent.append(state.doc.slice(range.from, range.to).content);
    }
    if (movedContent.size === 0) return false;

    let tr = state.tr;
    for (let i = movePlan.selectedRanges.length - 1; i >= 0; i -= 1) {
      const range = movePlan.selectedRanges[i];
      tr = tr.delete(range.from, range.to);
    }
    tr = tr.insert(movePlan.targetPos, movedContent);

    const selectionAnchor = Math.max(0, Math.min(movePlan.targetPos + 1, tr.doc.content.size));
    tr = tr.setSelection(Selection.near(tr.doc.resolve(selectionAnchor), 1)).scrollIntoView();
    view.dispatch(tr);
    view.focus();
    return true;
  } catch (error) {
    logBlockDragDebug('applyBlockMove failed', error);
    return false;
  }
}
