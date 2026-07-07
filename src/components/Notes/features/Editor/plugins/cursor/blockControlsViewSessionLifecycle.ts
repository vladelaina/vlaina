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

class BlockControlsViewSessionLifecycle {
  update(): void {
    if (this.isBlockSelectionPending()) {
      this.hideControls();
      return;
    }
    if (this.pointerY === null && !this.controls.classList.contains('visible') && !this.draggedRanges) {
      return;
    }
    if (this.cachedDoc !== this.view.state.doc) {
      this.invalidateSelectionCache();
    }
    this.invalidateTargetCache();
    this.scheduleHandleRefresh();
  }

  private adoptPendingCrossNoteBlockDrag(): void {
    const pending = pendingCrossNoteBlockDrag;
    const currentNotePath = getCurrentNotePath();
    if (!pending || !currentNotePath || currentNotePath === pending.sourceNotePath) {
      return;
    }

    this.draggedRanges = [];
    this.dragStartClientX = pending.dragStartClientX;
    this.dragStartClientY = pending.dragStartClientY;
    this.lastDragClientX = pending.lastClientX;
    this.lastDragClientY = pending.lastClientY;
    this.dragSourceDoc = null;
    this.dragSourceNotePath = pending.sourceNotePath;
    this.draggedMarkdown = pending.draggedMarkdown;
    this.dragSourceMarkdownAfterDelete = pending.sourceMarkdownAfterDelete;
    this.dragPreview = pending.preview;
    this.setPointer(pending.lastClientX, pending.lastClientY);
    this.attachDragWheelListener();
    this.dragAutoScroll.start();
    this.controls.classList.add('dragging');
    setBlockDraggingVisualState(true);
    this.scheduleDragPointerUpdate(pending.lastClientX, pending.lastClientY);
  }

  private shouldPreserveCrossNoteDragOnDestroy(): boolean {
    const pending = pendingCrossNoteBlockDrag;
    const currentNotePath = getCurrentNotePath();
    return Boolean(
      this.draggedRanges
      && pending
      && currentNotePath
      && currentNotePath !== pending.sourceNotePath,
    );
  }

  destroy(): void {
    const preserveCrossNoteDrag = this.shouldPreserveCrossNoteDragOnDestroy();
    if (this.refreshRafId !== 0) {
      window.cancelAnimationFrame(this.refreshRafId);
      this.refreshRafId = 0;
    }
    if (this.dragPointerRafId !== 0) {
      window.cancelAnimationFrame(this.dragPointerRafId);
      this.dragPointerRafId = 0;
    }
    if (!preserveCrossNoteDrag) {
      if (this.draggedRanges) {
        clearPendingCrossNoteBlockDrag();
      }
      setBlockDraggingVisualState(false);
    }
    this.clearBlockDragTabOpen();
    this.handleButton.removeEventListener('mousedown', this.handleHandleMouseDown);
    this.doc.removeEventListener('mousemove', this.handleDocumentMouseMove, true);
    this.doc.removeEventListener('pointermove', this.handleDocumentPointerMove, true);
    this.doc.removeEventListener('mouseup', this.handleDocumentMouseUp, true);
    this.dragAutoScroll.stop();
    this.detachDragWheelListener();
    this.doc.removeEventListener('keydown', this.handleDocumentKeyDown, true);
    this.scrollRoot?.removeEventListener('scroll', this.handleScrollOrResize);
    window.removeEventListener('blur', this.handleWindowBlur);
    window.removeEventListener('resize', this.handleScrollOrResize);
    this.unsubscribeBlockPositionSnapshot();
    if (this.dragPreview) {
      if (!preserveCrossNoteDrag || pendingCrossNoteBlockDrag?.preview !== this.dragPreview) {
        this.dragPreview.destroy();
      }
      this.dragPreview = null;
    }
    if (this.dragSourceMarker) {
      this.dragSourceMarker.destroy();
      this.dragSourceMarker = null;
    }
    this.controls.remove();
    this.dropIndicator.remove();
  }

  private finishDrag(): void {
    this.draggedRanges = null;
    this.dragStartClientX = null;
    this.dragStartClientY = null;
    this.lastDragClientX = null;
    this.lastDragClientY = null;
    this.pendingDragClientX = null;
    this.pendingDragClientY = null;
    this.dragSourceDoc = null;
    this.dragSourceNotePath = null;
    this.draggedMarkdown = null;
    this.dragSourceMarkdownAfterDelete = null;
    clearPendingCrossNoteBlockDrag();
    this.clearBlockDragTabOpen();
    if (this.dragPointerRafId !== 0) {
      window.cancelAnimationFrame(this.dragPointerRafId);
      this.dragPointerRafId = 0;
    }
    if (this.dragPreview) {
      this.dragPreview.destroy();
      this.dragPreview = null;
    }
    if (this.dragSourceMarker) {
      this.dragSourceMarker.destroy();
      this.dragSourceMarker = null;
    }
    setBlockDraggingVisualState(false);
    this.controls.classList.remove('dragging');
    this.hideDropIndicator();
    this.dragAutoScroll.stop();
    this.detachDragWheelListener();
  }

  private isCrossNoteDrag(): boolean {
    if (!this.draggedRanges) return false;
    const currentNotePath = getCurrentNotePath();
    if (this.dragSourceNotePath && currentNotePath && currentNotePath !== this.dragSourceNotePath) {
      return true;
    }
    return Boolean(this.dragSourceDoc && this.view.state.doc !== this.dragSourceDoc);
  }

  private async applyCrossNoteDrop(insertPos: number): Promise<boolean> {
    const sourceNotePath = this.dragSourceNotePath;
    const sourceMarkdownAfterDelete = this.dragSourceMarkdownAfterDelete;
    const targetNotePath = getCurrentNotePath();
    if (
      !sourceNotePath ||
      sourceMarkdownAfterDelete === null ||
      !targetNotePath ||
      targetNotePath === sourceNotePath
    ) {
      return false;
    }

    const draggedMarkdown = await remapDraggedMarkdownImageAssets({
      markdown: this.draggedMarkdown,
      sourceNotePath,
      targetNotePath,
    });
    const targetMarkdownAfterInsert = insertCrossNoteDraggedMarkdown(
      this.view,
      draggedMarkdown,
      insertPos,
      targetNotePath,
    );
    if (targetMarkdownAfterInsert === null) return false;

    return saveCrossNoteBlockDropAfterTargetSave({
      sourceNotePath,
      sourceMarkdownAfterDelete,
      targetNotePath,
      targetMarkdownAfterInsert,
    });
  }

}

function installMixinMethods(prototype: object, mixinPrototype: object): void {
  for (const key of Object.getOwnPropertyNames(mixinPrototype)) {
    if (key !== 'constructor') {
      Object.defineProperty(prototype, key, Object.getOwnPropertyDescriptor(mixinPrototype, key)!);
    }
  }
}

export function installBlockControlsViewSessionLifecycle(prototype: object): void {
  installMixinMethods(prototype, BlockControlsViewSessionLifecycle.prototype);
}
