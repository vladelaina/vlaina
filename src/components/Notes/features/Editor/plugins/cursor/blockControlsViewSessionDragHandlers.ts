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

export function installBlockControlsViewSessionDragHandlers(session: any): void {
  session.refreshDragDropAfterScroll = (): void => {
    session.invalidateTargetCache();
    session.scheduleHandleRefresh();
    if (session.lastDragClientX !== null && session.lastDragClientY !== null) {
      session.scheduleDragPointerUpdate(session.lastDragClientX, session.lastDragClientY);
    } else {
      session.hideDropIndicator();
    }
  };

  session.handleHandleMouseDown = (event: MouseEvent): void => {
    if (event.button !== 0) return;
    const { ranges: draggableRanges } = session.getDraggableSelection();

    if (draggableRanges.length === 0) return;

    event.preventDefault();
    event.stopPropagation();

    session.draggedRanges = draggableRanges;
    session.dragSourceDoc = session.view.state.doc;
    session.dragSourceNotePath = getCurrentNotePath();
    session.draggedMarkdown = serializeDraggedRangesForMarkdown(session.view, draggableRanges);
    session.dragSourceMarkdownAfterDelete = session.draggedMarkdown
      ? serializeSourceMarkdownAfterDelete(
          session.view,
          draggableRanges,
          session.dragSourceNotePath,
        )
      : null;
    session.attachDragWheelListener();
    session.dragAutoScroll.start();
    session.dragStartClientX = event.clientX;
    session.dragStartClientY = event.clientY;
    session.setPointer(event.clientX, event.clientY);
    setPendingCrossNoteBlockDrag({
      sourceNotePath: session.dragSourceNotePath,
      draggedMarkdown: session.draggedMarkdown,
      sourceMarkdownAfterDelete: session.dragSourceMarkdownAfterDelete,
      dragStartClientX: event.clientX,
      dragStartClientY: event.clientY,
      lastClientX: event.clientX,
      lastClientY: event.clientY,
      preview: null,
    });
    const composerText = serializeDraggedRangesForComposer(session.view, draggableRanges);
    setBlockDraggingVisualState(true, composerText ? { text: composerText } : null);
    session.controls.classList.add('dragging');
    session.dragSourceMarker = createBlockDragSourceMarker({
      view: session.view,
      ranges: draggableRanges,
    });

    const preview = createBlockDragPreview({
      view: session.view,
      ranges: draggableRanges,
      clientX: event.clientX,
      clientY: event.clientY,
    });
    if (preview) {
      session.dragPreview = preview;
      setPendingCrossNoteBlockDragPreview(preview);
      preview.element.style.left = `${Math.round(event.clientX - preview.offsetX)}px`;
      preview.element.style.top = `${Math.round(event.clientY - preview.offsetY)}px`;
    }
    session.lastDragClientX = event.clientX;
    session.lastDragClientY = event.clientY;
    session.updateDropTargetByPointer(event.clientX, event.clientY);
  };

  session.handleDocumentMouseMove = (event: MouseEvent): void => {
    if (session.draggedRanges) {
      session.setPointer(event.clientX, event.clientY);
      session.lastDragClientX = event.clientX;
      session.lastDragClientY = event.clientY;
      updatePendingCrossNoteBlockDragPointer(event.clientX, event.clientY);
      session.scheduleDragPointerUpdate(event.clientX, event.clientY);
      event.preventDefault();
      return;
    }

    if (session.isBlockSelectionPending()) {
      session.clearPointer();
      session.hideControls();
      return;
    }

    session.setPointer(event.clientX, event.clientY);
    session.scheduleHandleRefresh();
  };

  session.handleDocumentPointerMove = (event: PointerEvent): void => {
    if (event.pointerType && event.pointerType !== 'mouse') return;
    if (session.draggedRanges) return;
    if (session.isBlockSelectionPending()) {
      session.clearPointer();
      session.hideControls();
      return;
    }
    session.setPointer(event.clientX, event.clientY);
    session.scheduleHandleRefresh();
  };

  session.handleDocumentWheel = (event: WheelEvent): void => {
    if (!session.draggedRanges || !session.scrollRoot) return;

    const canScrollY = session.scrollRoot.scrollHeight > session.scrollRoot.clientHeight;
    const canScrollX = session.scrollRoot.scrollWidth > session.scrollRoot.clientWidth;
    if (!canScrollY && !canScrollX) return;

    const deltaY = normalizeWheelDelta(event.deltaY, event.deltaMode, session.scrollRoot.clientHeight);
    const deltaX = normalizeWheelDelta(event.deltaX, event.deltaMode, session.scrollRoot.clientWidth);
    if (deltaY === 0 && deltaX === 0) return;

    event.preventDefault();
    if (canScrollY && deltaY !== 0) {
      session.scrollRoot.scrollTop += deltaY;
    }
    if (canScrollX && deltaX !== 0) {
      session.scrollRoot.scrollLeft += deltaX;
    }

    session.refreshDragDropAfterScroll();
  };

  session.handleDocumentMouseUp = (event: MouseEvent): void => {
    if (!session.draggedRanges) return;
    session.setPointer(event.clientX, event.clientY);
    event.preventDefault();
    session.flushDragPointerUpdate();
    const draggedDistance = session.dragStartClientX === null || session.dragStartClientY === null
      ? 0
      : Math.hypot(event.clientX - session.dragStartClientX, event.clientY - session.dragStartClientY);
    const elements = getElementsFromPoint(session.doc, event.clientX, event.clientY);
    if (
      isOverNotesBlockDropTarget(elements)
      || !session.pendingDrop
      || draggedDistance < MIN_DROP_DISTANCE_PX
    ) {
      session.finishDrag();
    } else {
      const ranges = session.draggedRanges;
      const insertPos = session.pendingDrop.insertPos;
      if (session.isCrossNoteDrag()) {
        void session.applyCrossNoteDrop(insertPos).catch(() => undefined);
      } else {
        const canMove = canApplyBlockMove(session.view, ranges, insertPos);
        if (canMove) {
          applyBlockMove(session.view, ranges, insertPos);
        }
      }
      session.finishDrag();
    }
    session.invalidateTargetCache();
    session.scheduleHandleRefresh();
  };
}
