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
