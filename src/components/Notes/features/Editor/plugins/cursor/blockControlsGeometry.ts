import type { EditorView } from '@milkdown/kit/prose/view';
import { pruneContainedBlockRanges, type BlockRange } from './blockSelectionUtils';
import { pickPointerBlock } from './blockControlsUtils';
import {
  collectSelectableBlockTargets,
  isNonDraggableBlockRange,
  mapRangesToSelectableBlocks,
  resolveSelectableBlockTargetByPos,
} from './blockUnitResolver';
import type { DropTarget, HandleBlockTarget } from './blockControlsInteractionTypes';

const LIST_CHILD_INDENT_PX = 24;
const MIN_DROP_LINE_WIDTH = 24;

function resolveListContentLeft(item: HTMLElement, fallbackLeft: number): number {
  const firstBlock = item.firstElementChild as HTMLElement | null;
  if (!firstBlock) return fallbackLeft;
  const rect = firstBlock.getBoundingClientRect();
  return rect.width > 0 ? rect.left : fallbackLeft;
}

function resolveListChildInsertPos(
  view: EditorView,
  itemElement: HTMLElement,
  fallbackPos: number,
): number {
  const nestedList = itemElement.querySelector(':scope > ul, :scope > ol');
  if (nestedList) {
    try {
      return view.posAtDOM(nestedList, nestedList.childNodes.length);
    } catch {
    }
  }

  try {
    return view.posAtDOM(itemElement, itemElement.childNodes.length);
  } catch {
    return fallbackPos;
  }
}

export function resolveBlockTargetByPos(view: EditorView, blockPos: number): HandleBlockTarget | null {
  const target = resolveSelectableBlockTargetByPos(view, blockPos);
  if (!target) return null;
  if (isNonDraggableBlockRange(view.state.doc, target.range)) return null;
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
  return pruneContainedBlockRanges(
    mapRangesToSelectableBlocks(view.state.doc, selectedRanges)
      .filter((range) => !isNonDraggableBlockRange(view.state.doc, range))
  );
}

export function resolveDropTarget(view: EditorView, clientX: number, clientY: number): DropTarget | null {
  const editorRect = view.dom.getBoundingClientRect();
  if (clientY < editorRect.top || clientY > editorRect.bottom) {
    return null;
  }

  const blockTargets = collectSelectableBlockTargets(view).filter(
    (target) => !isNonDraggableBlockRange(view.state.doc, target.range),
  );
  const target = pickPointerBlock(blockTargets, clientY);
  if (!target) return null;

  const rect = target.rect;
  const insertBefore = clientY < rect.top + rect.height / 2;

  if (!insertBefore && target.element.tagName === 'LI') {
    const contentLeft = resolveListContentLeft(target.element, rect.left);
    const wantsChildPlacement = clientX > contentLeft;
    if (wantsChildPlacement) {
      const lineLeft = Math.min(rect.right - MIN_DROP_LINE_WIDTH, contentLeft + LIST_CHILD_INDENT_PX);
      const insertPos = resolveListChildInsertPos(view, target.element, target.range.to);
      return {
        insertPos,
        lineY: rect.bottom,
        lineLeft,
        lineWidth: Math.max(MIN_DROP_LINE_WIDTH, rect.right - lineLeft),
      };
    }
  }

  return {
    insertPos: insertBefore ? target.range.from : target.range.to,
    lineY: insertBefore ? rect.top : rect.bottom,
    lineLeft: rect.left,
    lineWidth: rect.width,
  };
}
