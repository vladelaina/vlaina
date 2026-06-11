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
import {
  getCachedEditorBlockTargetByPos,
  getCachedEditorBlockTargetNearY,
  getCachedEditorBlockTargets,
} from '../../utils/editorBlockPositionCache';

const LIST_CHILD_INDENT_PX = 24;
const LIST_MARKER_OFFSET_PX = 24;
const MIN_DROP_LINE_WIDTH = 24;
const DROP_LINE_BLEED_X = 10;
const DEFAULT_CONTROLS_HEIGHT_PX = 24;
const BLOCK_CONTROL_BUTTON_SIZE_PX = 24;
const COLLAPSE_GUTTER_BASE_PX = 22;
const COLLAPSE_MARKER_GAP_PX = 24;
export const BLOCK_CONTROLS_DRAG_SURFACE_PAD_X_PX = 4;
export const BLOCK_CONTROLS_COLLAPSE_GAP_PX = 10;

const HEADING_COLLAPSE_CLEAR_OFFSET_PX = COLLAPSE_GUTTER_BASE_PX + BLOCK_CONTROL_BUTTON_SIZE_PX;
const LIST_COLLAPSE_CLEAR_OFFSET_PX = COLLAPSE_GUTTER_BASE_PX + COLLAPSE_MARKER_GAP_PX;

export const BLOCK_CONTROLS_LEFT_OFFSET_PX = Math.max(
  HEADING_COLLAPSE_CLEAR_OFFSET_PX,
  LIST_COLLAPSE_CLEAR_OFFSET_PX,
) + BLOCK_CONTROLS_DRAG_SURFACE_PAD_X_PX + BLOCK_CONTROLS_COLLAPSE_GAP_PX;

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
  const target = getCachedEditorBlockTargetByPos(view, blockPos) ?? resolveSelectableBlockTargetByPos(view, blockPos);
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
  options: {
    horizontalAnchor?: HandleBlockTarget;
  } = {},
): void {
  const horizontalTarget = options.horizontalAnchor ?? target;
  const listMarkerOffset = horizontalTarget.isListItem ? LIST_MARKER_OFFSET_PX : 0;
  const left = Math.max(8, horizontalTarget.rect.left - controlsLeftOffset - listMarkerOffset);
  const controlsHeight = controls.getBoundingClientRect().height || DEFAULT_CONTROLS_HEIGHT_PX;
  const top = target.rect.top + target.rect.height / 2 - controlsHeight / 2;
  controls.style.left = `${Math.round(left)}px`;
  controls.style.top = `${Math.round(top)}px`;
}

export function getDraggableBlockRanges(view: EditorView, selectedRanges: readonly BlockRange[]): BlockRange[] {
  const mapped = mapRangesToSelectableBlocks(view.state.doc, selectedRanges)
    .filter((range) => !isNonDraggableBlockRange(view.state.doc, range));
  const result = pruneContainedBlockRanges(mapped);
  return result;
}

export function resolveDropTarget(view: EditorView, clientX: number, clientY: number): DropTarget | null {
  const editorRect = view.dom.getBoundingClientRect();
  if (clientY < editorRect.top || clientY > editorRect.bottom) {
    return null;
  }

  const target = getCachedEditorBlockTargetNearY(
    view,
    clientY,
    (block) => !isNonDraggableBlockRange(view.state.doc, block),
  ) ?? pickPointerBlock(
    (getCachedEditorBlockTargets(view) ?? collectSelectableBlockTargets(view)).filter(
      (candidate) => !isNonDraggableBlockRange(view.state.doc, candidate.range),
    ),
    clientY,
  );
  if (!target) return null;

  const rect = target.rect;
  const insertBefore = clientY < rect.top + rect.height / 2;
  const lineLeft = Math.max(editorRect.left, rect.left - DROP_LINE_BLEED_X);
  const lineRight = Math.min(editorRect.right, rect.right + DROP_LINE_BLEED_X);

  if (!insertBefore && target.element.tagName === 'LI') {
    const contentLeft = resolveListContentLeft(target.element, rect.left);
    const wantsChildPlacement = clientX > contentLeft;
    if (wantsChildPlacement) {
      const childLineLeft = Math.min(lineRight - MIN_DROP_LINE_WIDTH, contentLeft + LIST_CHILD_INDENT_PX);
      const insertPos = resolveListChildInsertPos(view, target.element, target.range.to);
      return {
        insertPos,
        lineY: rect.bottom,
        lineLeft: childLineLeft,
        lineWidth: Math.max(MIN_DROP_LINE_WIDTH, lineRight - childLineLeft),
      };
    }
  }

  return {
    insertPos: insertBefore ? target.range.from : target.range.to,
    lineY: insertBefore ? rect.top : rect.bottom,
    lineLeft,
    lineWidth: Math.max(MIN_DROP_LINE_WIDTH, lineRight - lineLeft),
  };
}
