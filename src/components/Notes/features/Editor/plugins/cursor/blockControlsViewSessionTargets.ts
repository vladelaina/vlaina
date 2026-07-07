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

class BlockControlsViewSessionTargets {
  private invalidateTargetCache(): void {
    this.cachedTargets = [];
    this.cachedSelectionKey = '';
    this.cachedDoc = this.view.state.doc;
    this.cachedScrollLeft = Number.NaN;
    this.cachedScrollTop = Number.NaN;
    this.cachedSnapshotVersion = Number.NaN;
  }

  private invalidateSelectionCache(): void {
    this.cachedSelectedBlocks = null;
    this.cachedNormalizedSelectedRanges = [];
    this.cachedDraggableRanges = [];
    this.cachedDraggableSelectionKey = '';
  }

  private getCachedHandleTargets(): HandleBlockTarget[] {
    const {
      selectedRanges,
    } = this.getDraggableSelection();
    if (selectedRanges.length === 0) {
      return this.getSelectedDomHandleTargets();
    }
    const selectionKey = getBlockRangesKey(selectedRanges);
    const nextScrollLeft = this.scrollRoot?.scrollLeft ?? 0;
    const nextScrollTop = this.scrollRoot?.scrollTop ?? 0;
    const snapshot = getCurrentEditorBlockPositionSnapshot();
    const snapshotVersion = snapshot?.view === this.view ? snapshot.version : 0;
    if (
      this.cachedSelectionKey === selectionKey
      && this.cachedDoc === this.view.state.doc
      && this.cachedScrollLeft === nextScrollLeft
      && this.cachedScrollTop === nextScrollTop
      && this.cachedSnapshotVersion === snapshotVersion
    ) {
      return this.cachedTargets;
    }

    this.cachedSelectionKey = selectionKey;
    this.cachedDoc = this.view.state.doc;
    this.cachedScrollLeft = nextScrollLeft;
    this.cachedScrollTop = nextScrollTop;
    this.cachedSnapshotVersion = snapshotVersion;
    const stateTargets = getHandleBlockTargets(this.view, selectedRanges).map((target) => {
      if (!target.element?.classList.contains('editor-block-selected')) {
        return target;
      }
      const rect = target.element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        return target;
      }
      return { ...target, rect };
    });
    this.cachedTargets = stateTargets.length > 0
      ? stateTargets
      : this.getSelectedDomHandleTargets();
    return this.cachedTargets;
  }

  private getSelectedDomHandleTargets(): HandleBlockTarget[] {
    return Array.from(this.view.dom.querySelectorAll<HTMLElement>('.editor-block-selected'))
      .map((element, index): HandleBlockTarget | null => {
        const rect = element.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return null;
        let pos = -1 - index;
        try {
          pos = this.view.posAtDOM(element, 0);
        } catch {
        }
        return {
          pos,
          rect,
          isListItem: element.tagName === 'LI',
          element,
        };
      })
      .filter((target): target is HandleBlockTarget => target !== null)
      .sort((left, right) => (
        left.rect.height === right.rect.height
          ? left.rect.top - right.rect.top
          : left.rect.height - right.rect.height
      ));
  }

  private resolveDomHorizontalAnchor(target: HandleBlockTarget): HandleBlockTarget | null {
    const element = target.element;
    if (!element || element.tagName !== 'LI') return null;

    let anchor: HTMLElement | null = null;
    for (let current = element.parentElement?.closest('li.editor-block-selected') as HTMLElement | null;
      current && this.view.dom.contains(current);
      current = current.parentElement?.closest('li.editor-block-selected') as HTMLElement | null
    ) {
      if (!current.contains(element)) continue;
      if (!anchor || current.getBoundingClientRect().left < anchor.getBoundingClientRect().left) {
        anchor = current;
      }
    }

    if (!anchor) return null;
    const rect = anchor.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    let pos = target.pos;
    try {
      pos = this.view.posAtDOM(anchor, 0);
    } catch {
    }
    return {
      pos,
      rect,
      isListItem: true,
      element: anchor,
    };
  }

  private resolveGroupedListHorizontalAnchor(
    target: HandleBlockTarget,
    targets: readonly HandleBlockTarget[],
    draggableRanges: readonly BlockRange[],
  ): HandleBlockTarget {
    let anchor: HandleBlockTarget | null = null;

    for (const range of draggableRanges) {
      if (range.from === target.pos || range.from > target.pos) continue;
      const listItemTo = getListItemRangeEnd(this.view.state.doc, range.from);
      if (listItemTo === null || target.pos >= listItemTo) continue;

      const candidate = targets.find((item) => item.pos === range.from)
        ?? resolveBlockTargetByPos(this.view, range.from);
      if (!candidate) continue;
      if (!anchor || candidate.rect.left < anchor.rect.left || (
        candidate.rect.left === anchor.rect.left && candidate.pos < anchor.pos
      )) {
        anchor = candidate;
      }
    }

    return anchor ?? target;
  }

  private showHandleForPointer(): void {
    if (this.draggedRanges) return;
    if (this.isBlockSelectionPending()) {
      this.hideControls();
      return;
    }
    if (!this.isPointerInEditorScrollRoot()) {
      this.hideControls();
      return;
    }
    const { selectedRanges } = this.getDraggableSelection();
    const targets = this.getCachedHandleTargets();
    const nextTarget = pickPointerBlock(targets, this.pointerY);
    if (!nextTarget || !this.isPointerNearTarget(nextTarget)) {
      this.hideControls();
      return;
    }
    const horizontalAnchor = this.resolveGroupedListHorizontalAnchor(nextTarget, targets, selectedRanges);
    const domHorizontalAnchor = horizontalAnchor === nextTarget
      ? this.resolveDomHorizontalAnchor(nextTarget)
      : null;
    if (horizontalAnchor === nextTarget && !domHorizontalAnchor) {
      setControlsPosition(this.controls, nextTarget, BLOCK_CONTROLS_LEFT_OFFSET_PX);
    } else {
      setControlsPosition(this.controls, nextTarget, BLOCK_CONTROLS_LEFT_OFFSET_PX, {
        horizontalAnchor: domHorizontalAnchor ?? horizontalAnchor,
      });
    }
    this.controls.classList.add('visible');
  }

  private scheduleHandleRefresh(): void {
    if (!this.draggedRanges && this.isBlockSelectionPending()) {
      this.hideControls();
      return;
    }
    if (this.refreshRafId !== 0) return;
    this.refreshRafId = window.requestAnimationFrame(() => {
      this.refreshRafId = 0;
      this.showHandleForPointer();
    });
  }

  private attachDragWheelListener(): void {
    if (this.dragWheelListenerAttached) return;
    this.dragWheelListenerAttached = true;
    this.doc.addEventListener('wheel', this.handleDocumentWheel, { capture: true, passive: false });
  }

  private detachDragWheelListener(): void {
    if (!this.dragWheelListenerAttached) return;
    this.dragWheelListenerAttached = false;
    this.doc.removeEventListener('wheel', this.handleDocumentWheel, true);
  }

  private scheduleBlockDragTabOpen(path: string): void {
    if (!this.draggedRanges || path === getCurrentNotePath()) {
      this.clearBlockDragTabOpen();
      return;
    }
    if (this.blockDragTabOpenPath === path) {
      return;
    }

    this.clearBlockDragTabOpen();
    this.blockDragTabOpenPath = path;
    this.blockDragTabOpenTimerId = window.setTimeout(() => {
      this.blockDragTabOpenTimerId = null;
      if (!this.draggedRanges || this.blockDragTabOpenPath !== path) {
        return;
      }

      if (getCurrentNotePath() === path) {
        this.blockDragTabOpenPath = null;
        return;
      }

      void openNotePath(path)
        .catch(() => undefined)
        .finally(() => {
          if (this.blockDragTabOpenPath === path) {
            this.blockDragTabOpenPath = null;
          }
        });
    }, BLOCK_DRAG_TAB_OPEN_DELAY_MS);
  }

  private clearBlockDragTabOpen(): void {
    if (this.blockDragTabOpenTimerId !== null) {
      window.clearTimeout(this.blockDragTabOpenTimerId);
      this.blockDragTabOpenTimerId = null;
    }
    this.blockDragTabOpenPath = null;
  }

  private updateBlockDragTabHover(elements: readonly Element[]): void {
    const targetPath = getNotesBlockOpenTargetPathFromElements(elements);
    if (!targetPath || targetPath === getCurrentNotePath()) {
      this.clearBlockDragTabOpen();
      return;
    }

    this.scheduleBlockDragTabOpen(targetPath);
  }

}

function installMixinMethods(prototype: object, mixinPrototype: object): void {
  for (const key of Object.getOwnPropertyNames(mixinPrototype)) {
    if (key !== 'constructor') {
      Object.defineProperty(prototype, key, Object.getOwnPropertyDescriptor(mixinPrototype, key)!);
    }
  }
}

export function installBlockControlsViewSessionTargets(prototype: object): void {
  installMixinMethods(prototype, BlockControlsViewSessionTargets.prototype);
}
