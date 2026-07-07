import { type EditorBlockPositionSnapshot } from '../../utils/editorBlockPositionCache';

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
