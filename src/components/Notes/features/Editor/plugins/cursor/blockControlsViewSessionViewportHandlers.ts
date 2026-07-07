import type { EditorView } from '@milkdown/kit/prose/view';
import { normalizeWheelDelta } from '@/lib/scroll/wheelScroll';
import { getBlockSelectionPluginState } from './blockSelectionPluginState';
import { getBlockRangesKey, normalizeBlockRanges, type BlockRange } from './blockSelectionUtils';
import { pickPointerBlock } from './blockControlsUtils';
import { createBlockDragPreview, createBlockDragSourceMarker } from './blockDragPreview';
import { setBlockDraggingVisualState } from './blockDragVisualState';
import { getListItemRangeEnd } from './blockUnitResolver';
import { getCurrentEditorBlockPositionSnapshot, type EditorBlockPositionSnapshot } from '../../utils/editorBlockPositionCache';
import { applyBlockMove, canApplyBlockMove, getDraggableBlockRanges, getHandleBlockTargets, resolveBlockTargetByPos, resolveDropTarget, setControlsPosition } from './blockControlsInteractions';
import { BLOCK_CONTROLS_LEFT_OFFSET_PX } from './blockControlsGeometry';
import { clearPendingCrossNoteBlockDrag, getCurrentNotePath, getElementsFromPoint, getNotesBlockOpenTargetPathFromElements, insertCrossNoteDraggedMarkdown, isOverNotesBlockDropTarget, openNotePath, pendingCrossNoteBlockDrag, saveCrossNoteBlockDropAfterTargetSave, serializeDraggedRangesForComposer, serializeDraggedRangesForMarkdown, serializeSourceMarkdownAfterDelete, setPendingCrossNoteBlockDrag, setPendingCrossNoteBlockDragPreview, updatePendingCrossNoteBlockDragPointer, MIN_DROP_DISTANCE_PX, HANDLE_VERTICAL_GAP_PX, BLOCK_DRAG_TAB_OPEN_DELAY_MS, BLOCK_SELECTION_PENDING_CLASS } from './blockControlsViewSessionHelpers';
import { remapDraggedMarkdownImageAssets } from './blockDragImageAssets';

export function installBlockControlsViewSessionViewportHandlers(session: any): void {
  session.handleScrollOrResize = (): void => {
    if (session.draggedRanges) {
      session.refreshDragDropAfterScroll();
      return;
    }
    if (session.isBlockSelectionPending()) {
      session.hideControls();
      return;
    }
    if (session.pointerY === null && !session.controls.classList.contains('visible')) {
      return;
    }
    session.invalidateTargetCache();
    session.scheduleHandleRefresh();
  };

  session.handleBlockPositionSnapshot = (snapshot: EditorBlockPositionSnapshot | null): void => {
    if (snapshot && snapshot.view !== session.view) return;
    if (session.isBlockSelectionPending()) {
      session.hideControls();
      return;
    }
    if (session.pointerY === null && !session.controls.classList.contains('visible') && !session.draggedRanges) return;

    session.invalidateTargetCache();
    if (session.draggedRanges) {
      if (session.lastDragClientX !== null && session.lastDragClientY !== null) {
        session.scheduleDragPointerUpdate(session.lastDragClientX, session.lastDragClientY);
      }
      return;
    }
    session.scheduleHandleRefresh();
  };

  session.handleWindowBlur = (): void => {
    if (session.draggedRanges) {
      session.finishDrag();
    }
    session.clearPointer();
    session.hideControls();
    session.invalidateTargetCache();
    session.scheduleHandleRefresh();
  };

  session.handleDocumentKeyDown = (event: KeyboardEvent): void => {
    if (!session.draggedRanges) return;
    if (event.isComposing || event.key !== 'Escape') return;
    event.preventDefault();
    session.finishDrag();
    session.clearPointer();
    session.hideControls();
    session.invalidateTargetCache();
    session.scheduleHandleRefresh();
  };
}
