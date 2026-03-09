import type { EditorView } from '@milkdown/kit/prose/view';
import type { BlockRange } from './blockSelectionUtils';
import { pickPointerBlock } from './blockControlsUtils';
import {
  collectSelectableBlockTargets,
  mapRangesToSelectableBlocks,
  resolveSelectableBlockTargetByPos,
} from './blockUnitResolver';
import type { DropTarget, HandleBlockTarget } from './blockControlsInteractionTypes';

export function resolveBlockTargetByPos(view: EditorView, blockPos: number): HandleBlockTarget | null {
  const target = resolveSelectableBlockTargetByPos(view, blockPos);
  if (!target) return null;
  return {
    pos: target.range.from,
    rect: target.rect,
    isListItem: target.element.tagName === 'LI',
  };
}

export function setControlsPosition(
  controls: HTMLElement,
  target: HandleBlockTarget,
  controlsLeftOffset: number,
): void {
  const listMarkerOffset = target.isListItem ? 24 : 0;
  const left = Math.max(8, target.rect.left - controlsLeftOffset - listMarkerOffset);
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
