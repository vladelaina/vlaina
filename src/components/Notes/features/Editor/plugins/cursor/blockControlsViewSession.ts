import type { EditorView } from '@milkdown/kit/prose/view';
import { getBlockSelectionPluginState } from './blockSelectionPluginState';
import { getBlockRangesKey, normalizeBlockRanges, type BlockRange } from './blockSelectionUtils';
import { pickPointerBlock } from './blockControlsUtils';
import {
  createBlockDragPreview,
  createBlockDragSourceMarker,
  type BlockDragPreviewHandle,
  type BlockDragSourceMarkerHandle,
} from './blockDragPreview';
import { createBlockControlsDom } from './blockControlsDom';
import { setBlockDraggingVisualState } from './blockDragVisualState';
import { getListItemRangeEnd } from './blockUnitResolver';
import { normalizeSelectedTextForComposer } from '@/lib/ui/normalizeSelectedTextForComposer';
import {
  MAX_COMPOSER_PROGRAMMATIC_INSERT_CHARS,
  canInsertTextIntoComposerValue,
} from '@/lib/ui/composerFocusRegistry';
import { serializeSelectedBlocksToText } from './blockSelectionSerializer';
import { getCurrentMarkdownSerializer } from '../../utils/editorViewRegistry';
import {
  getCurrentEditorBlockPositionSnapshot,
  subscribeCurrentEditorBlockPositionSnapshot,
  type EditorBlockPositionSnapshot,
} from '../../utils/editorBlockPositionCache';
import {
  applyBlockMove,
  canApplyBlockMove,
  getDraggableBlockRanges,
  getHandleBlockTargets,
  resolveBlockTargetByPos,
  resolveDropTarget,
  setControlsPosition,
  type DropTarget,
  type HandleBlockTarget,
} from './blockControlsInteractions';
import { BLOCK_CONTROLS_LEFT_OFFSET_PX } from './blockControlsGeometry';
import { createVerticalEdgeAutoScroll, type VerticalEdgeAutoScrollHandle } from './edgeAutoScroll';

const SCROLL_ROOT_SELECTOR = '[data-note-scroll-root="true"]';
const MIN_DROP_DISTANCE_PX = 4;
const HANDLE_VERTICAL_GAP_PX = 24;
const WHEEL_DELTA_MODE_LINE = 1;
const WHEEL_DELTA_MODE_PAGE = 2;
const WHEEL_LINE_HEIGHT_PX = 16;
const NOTES_BLOCK_DROP_TARGET_SELECTOR = '[data-notes-block-drop-target="true"]';

function normalizeWheelDelta(delta: number, deltaMode: number, pageSize: number): number {
  if (deltaMode === WHEEL_DELTA_MODE_LINE) return delta * WHEEL_LINE_HEIGHT_PX;
  if (deltaMode === WHEEL_DELTA_MODE_PAGE) return delta * pageSize;
  return delta;
}

function serializeDraggedRangesForComposer(view: EditorView, ranges: BlockRange[]): string {
  if (ranges.some((range) => range.to - range.from > MAX_COMPOSER_PROGRAMMATIC_INSERT_CHARS)) {
    return '';
  }

  const text = normalizeSelectedTextForComposer(
    serializeSelectedBlocksToText(view.state, ranges, {
      markdownSerializer: getCurrentMarkdownSerializer(),
    })
  );
  return canInsertTextIntoComposerValue('', text) ? text : '';
}

function isOverNotesBlockDropTarget(doc: Document, clientX: number, clientY: number): boolean {
  const elements = typeof doc.elementsFromPoint === 'function'
    ? doc.elementsFromPoint(clientX, clientY)
    : [];
  return elements.some((element) => element.closest(NOTES_BLOCK_DROP_TARGET_SELECTOR));
}

export class BlockControlsViewSession {
  private readonly view: EditorView;
  private readonly doc: Document;
  private readonly scrollRoot: HTMLElement | null;
  private readonly controls: HTMLDivElement;
  private readonly handleButton: HTMLButtonElement;
  private readonly dropIndicator: HTMLDivElement;
  private readonly dragAutoScroll: VerticalEdgeAutoScrollHandle;

  private draggedRanges: BlockRange[] | null = null;
  private dragPreview: BlockDragPreviewHandle | null = null;
  private dragSourceMarker: BlockDragSourceMarkerHandle | null = null;
  private pendingDrop: DropTarget | null = null;
  private dragStartClientX: number | null = null;
  private dragStartClientY: number | null = null;
  private lastDragClientX: number | null = null;
  private lastDragClientY: number | null = null;
  private pendingDragClientX: number | null = null;
  private pendingDragClientY: number | null = null;
  private pointerX: number | null = null;
  private pointerY: number | null = null;
  private refreshRafId = 0;
  private dragPointerRafId = 0;

  private cachedTargets: HandleBlockTarget[] = [];
  private cachedSelectionKey = '';
  private cachedDoc;
  private cachedScrollLeft = Number.NaN;
  private cachedScrollTop = Number.NaN;
  private cachedSnapshotVersion = Number.NaN;
  private cachedSelectedBlocks: readonly BlockRange[] | null = null;
  private cachedNormalizedSelectedRanges: BlockRange[] = [];
  private cachedDraggableRanges: BlockRange[] = [];
  private cachedDraggableSelectionKey = '';
  private dragWheelListenerAttached = false;
  private readonly unsubscribeBlockPositionSnapshot: () => void;

  constructor(view: EditorView) {
    this.view = view;
    this.doc = view.dom.ownerDocument;
    this.scrollRoot = view.dom.closest(SCROLL_ROOT_SELECTOR) as HTMLElement | null;
    this.cachedDoc = view.state.doc;
    this.dragAutoScroll = createVerticalEdgeAutoScroll({
      scrollRoot: this.scrollRoot,
      getPointerY: () => this.draggedRanges ? this.lastDragClientY : null,
      onScroll: this.refreshDragDropAfterScroll,
    });

    const { controls, handleButton, dropIndicator } = createBlockControlsDom(this.doc);
    this.controls = controls;
    this.handleButton = handleButton;
    this.dropIndicator = dropIndicator;

    this.handleButton.addEventListener('mousedown', this.handleHandleMouseDown);
    this.doc.addEventListener('mousemove', this.handleDocumentMouseMove, true);
    this.doc.addEventListener('pointermove', this.handleDocumentPointerMove, true);
    this.doc.addEventListener('mouseup', this.handleDocumentMouseUp, true);
    this.doc.addEventListener('keydown', this.handleDocumentKeyDown, true);
    this.scrollRoot?.addEventListener('scroll', this.handleScrollOrResize, { passive: true });
    window.addEventListener('blur', this.handleWindowBlur);
    window.addEventListener('resize', this.handleScrollOrResize);
    this.unsubscribeBlockPositionSnapshot = subscribeCurrentEditorBlockPositionSnapshot(
      this.handleBlockPositionSnapshot,
    );
  }

  update(): void {
    if (this.pointerY === null && !this.controls.classList.contains('visible') && !this.draggedRanges) {
      return;
    }
    if (this.cachedDoc !== this.view.state.doc) {
      this.invalidateSelectionCache();
    }
    this.invalidateTargetCache();
    this.scheduleHandleRefresh();
  }

  destroy(): void {
    if (this.refreshRafId !== 0) {
      window.cancelAnimationFrame(this.refreshRafId);
      this.refreshRafId = 0;
    }
    if (this.dragPointerRafId !== 0) {
      window.cancelAnimationFrame(this.dragPointerRafId);
      this.dragPointerRafId = 0;
    }
    setBlockDraggingVisualState(false);
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
      this.dragPreview.destroy();
      this.dragPreview = null;
    }
    if (this.dragSourceMarker) {
      this.dragSourceMarker.destroy();
      this.dragSourceMarker = null;
    }
    this.controls.remove();
    this.dropIndicator.remove();
  }

  private getDraggableSelection(): { ranges: BlockRange[]; key: string; selectedRanges: BlockRange[] } {
    const selectedBlocks = getBlockSelectionPluginState(this.view.state).selectedBlocks;
    if (this.cachedSelectedBlocks === selectedBlocks) {
      return {
        ranges: this.cachedDraggableRanges,
        key: this.cachedDraggableSelectionKey,
        selectedRanges: this.cachedNormalizedSelectedRanges,
      };
    }

    const selectedRanges = normalizeBlockRanges(selectedBlocks);
    const ranges = getDraggableBlockRanges(this.view, selectedRanges);
    const key = ranges.length > 0 ? getBlockRangesKey(ranges) : '';
    this.cachedSelectedBlocks = selectedBlocks;
    this.cachedNormalizedSelectedRanges = selectedRanges;
    this.cachedDraggableRanges = ranges;
    this.cachedDraggableSelectionKey = key;
    return { ranges, key, selectedRanges };
  }

  private isPointerInEditorScrollRoot(): boolean {
    if (this.pointerX === null || this.pointerY === null) return false;
    if (typeof this.doc.elementFromPoint === 'function') {
      const hoveredElement = this.doc.elementFromPoint(this.pointerX, this.pointerY);
      if (hoveredElement instanceof Node && this.controls.contains(hoveredElement)) {
        return true;
      }
    }
    if (!this.scrollRoot) return true;

    const rect = this.scrollRoot.getBoundingClientRect();
    return this.pointerX >= rect.left
      && this.pointerX <= rect.right
      && this.pointerY >= rect.top
      && this.pointerY <= rect.bottom;
  }

  private isPointerNearTarget(target: HandleBlockTarget): boolean {
    if (this.pointerY === null) return false;
    if (this.pointerY >= target.rect.top && this.pointerY <= target.rect.bottom) return true;

    const distance = this.pointerY < target.rect.top
      ? target.rect.top - this.pointerY
      : this.pointerY - target.rect.bottom;
    return distance <= HANDLE_VERTICAL_GAP_PX;
  }

  private hideControls(): void {
    this.controls.classList.remove('visible');
  }

  private clearPointer(): void {
    this.pointerX = null;
    this.pointerY = null;
  }

  private setPointer(clientX: number, clientY: number): void {
    this.pointerX = clientX;
    this.pointerY = clientY;
  }

  private hideDropIndicator(): void {
    this.pendingDrop = null;
    this.dropIndicator.classList.remove('visible');
  }

  private updateDropTargetByPointer(clientX: number, clientY: number): boolean {
    const target = resolveDropTarget(this.view, clientX, clientY);
    if (!target) {
      this.hideDropIndicator();
      return false;
    }
    if (!this.draggedRanges || !canApplyBlockMove(this.view, this.draggedRanges, target.insertPos)) {
      this.hideDropIndicator();
      return false;
    }
    this.pendingDrop = target;
    this.dropIndicator.style.left = `${Math.round(target.lineLeft)}px`;
    this.dropIndicator.style.top = `${Math.round(target.lineY - 1)}px`;
    this.dropIndicator.style.width = `${Math.round(target.lineWidth)}px`;
    this.dropIndicator.classList.add('visible');
    return true;
  }

  private applyDragPointerUpdate(clientX: number, clientY: number): void {
    if (isOverNotesBlockDropTarget(this.doc, clientX, clientY)) {
      this.hideDropIndicator();
    } else {
      this.updateDropTargetByPointer(clientX, clientY);
    }
    if (this.dragPreview) {
      this.dragPreview.element.style.left = `${Math.round(clientX - this.dragPreview.offsetX)}px`;
      this.dragPreview.element.style.top = `${Math.round(clientY - this.dragPreview.offsetY)}px`;
    }
  }

  private scheduleDragPointerUpdate(clientX: number, clientY: number): void {
    this.pendingDragClientX = clientX;
    this.pendingDragClientY = clientY;
    if (this.dragPointerRafId !== 0) return;

    this.dragPointerRafId = window.requestAnimationFrame(() => {
      this.dragPointerRafId = 0;
      const nextX = this.pendingDragClientX;
      const nextY = this.pendingDragClientY;
      this.pendingDragClientX = null;
      this.pendingDragClientY = null;
      if (nextX === null || nextY === null || !this.draggedRanges) return;
      this.applyDragPointerUpdate(nextX, nextY);
    });
  }

  private flushDragPointerUpdate(): void {
    if (this.dragPointerRafId !== 0) {
      window.cancelAnimationFrame(this.dragPointerRafId);
      this.dragPointerRafId = 0;
    }
    const nextX = this.pendingDragClientX;
    const nextY = this.pendingDragClientY;
    this.pendingDragClientX = null;
    this.pendingDragClientY = null;
    if (nextX === null || nextY === null || !this.draggedRanges) return;
    this.applyDragPointerUpdate(nextX, nextY);
  }

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
    const stateTargets = getHandleBlockTargets(this.view, selectedRanges);
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

  private readonly refreshDragDropAfterScroll = (): void => {
    this.invalidateTargetCache();
    this.scheduleHandleRefresh();
    if (this.lastDragClientX !== null && this.lastDragClientY !== null) {
      this.scheduleDragPointerUpdate(this.lastDragClientX, this.lastDragClientY);
    } else {
      this.hideDropIndicator();
    }
  };

  private finishDrag(): void {
    this.draggedRanges = null;
    this.dragStartClientX = null;
    this.dragStartClientY = null;
    this.lastDragClientX = null;
    this.lastDragClientY = null;
    this.pendingDragClientX = null;
    this.pendingDragClientY = null;
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

  private readonly handleHandleMouseDown = (event: MouseEvent): void => {
    if (event.button !== 0) return;
    const { ranges: draggableRanges } = this.getDraggableSelection();

    if (draggableRanges.length === 0) return;

    event.preventDefault();
    event.stopPropagation();

    this.draggedRanges = draggableRanges;
    this.attachDragWheelListener();
    this.dragAutoScroll.start();
    this.dragStartClientX = event.clientX;
    this.dragStartClientY = event.clientY;
    this.setPointer(event.clientX, event.clientY);
    const composerText = serializeDraggedRangesForComposer(this.view, draggableRanges);
    setBlockDraggingVisualState(true, composerText ? { text: composerText } : null);
    this.controls.classList.add('dragging');
    this.dragSourceMarker = createBlockDragSourceMarker({
      view: this.view,
      ranges: draggableRanges,
    });

    const preview = createBlockDragPreview({
      view: this.view,
      ranges: draggableRanges,
      clientX: event.clientX,
      clientY: event.clientY,
    });
    if (preview) {
      this.dragPreview = preview;
      preview.element.style.left = `${Math.round(event.clientX - preview.offsetX)}px`;
      preview.element.style.top = `${Math.round(event.clientY - preview.offsetY)}px`;
    }
    this.lastDragClientX = event.clientX;
    this.lastDragClientY = event.clientY;
    this.updateDropTargetByPointer(event.clientX, event.clientY);
  };

  private readonly handleDocumentMouseMove = (event: MouseEvent): void => {
    if (this.draggedRanges) {
      this.setPointer(event.clientX, event.clientY);
      this.lastDragClientX = event.clientX;
      this.lastDragClientY = event.clientY;
      this.scheduleDragPointerUpdate(event.clientX, event.clientY);
      event.preventDefault();
      return;
    }

    this.setPointer(event.clientX, event.clientY);
    this.scheduleHandleRefresh();
  };

  private readonly handleDocumentPointerMove = (event: PointerEvent): void => {
    if (event.pointerType && event.pointerType !== 'mouse') return;
    if (this.draggedRanges) return;
    this.setPointer(event.clientX, event.clientY);
    this.scheduleHandleRefresh();
  };

  private readonly handleScrollOrResize = (): void => {
    if (this.draggedRanges) {
      this.refreshDragDropAfterScroll();
      return;
    }
    this.invalidateTargetCache();
    this.scheduleHandleRefresh();
  };

  private readonly handleBlockPositionSnapshot = (snapshot: EditorBlockPositionSnapshot | null): void => {
    if (snapshot && snapshot.view !== this.view) return;
    if (this.pointerY === null && !this.controls.classList.contains('visible') && !this.draggedRanges) return;

    this.invalidateTargetCache();
    if (this.draggedRanges) {
      if (this.lastDragClientX !== null && this.lastDragClientY !== null) {
        this.scheduleDragPointerUpdate(this.lastDragClientX, this.lastDragClientY);
      }
      return;
    }
    this.scheduleHandleRefresh();
  };

  private readonly handleDocumentWheel = (event: WheelEvent): void => {
    if (!this.draggedRanges || !this.scrollRoot) return;

    const canScrollY = this.scrollRoot.scrollHeight > this.scrollRoot.clientHeight;
    const canScrollX = this.scrollRoot.scrollWidth > this.scrollRoot.clientWidth;
    if (!canScrollY && !canScrollX) return;

    const deltaY = normalizeWheelDelta(event.deltaY, event.deltaMode, this.scrollRoot.clientHeight);
    const deltaX = normalizeWheelDelta(event.deltaX, event.deltaMode, this.scrollRoot.clientWidth);
    if (deltaY === 0 && deltaX === 0) return;

    event.preventDefault();
    if (canScrollY && deltaY !== 0) {
      this.scrollRoot.scrollTop += deltaY;
    }
    if (canScrollX && deltaX !== 0) {
      this.scrollRoot.scrollLeft += deltaX;
    }

    this.refreshDragDropAfterScroll();
  };

  private readonly handleDocumentMouseUp = (event: MouseEvent): void => {
    if (!this.draggedRanges) return;
    this.setPointer(event.clientX, event.clientY);
    event.preventDefault();
    this.flushDragPointerUpdate();
    const draggedDistance = this.dragStartClientX === null || this.dragStartClientY === null
      ? 0
      : Math.hypot(event.clientX - this.dragStartClientX, event.clientY - this.dragStartClientY);
    if (
      isOverNotesBlockDropTarget(this.doc, event.clientX, event.clientY)
      || !this.pendingDrop
      || draggedDistance < MIN_DROP_DISTANCE_PX
    ) {
      this.finishDrag();
    } else {
      const ranges = this.draggedRanges;
      const insertPos = this.pendingDrop.insertPos;
      const canMove = canApplyBlockMove(this.view, ranges, insertPos);
      if (canMove) {
        applyBlockMove(this.view, ranges, insertPos);
      }
      this.finishDrag();
    }
    this.invalidateTargetCache();
    this.scheduleHandleRefresh();
  };

  private readonly handleWindowBlur = (): void => {
    if (this.draggedRanges) {
      this.finishDrag();
    }
    this.clearPointer();
    this.hideControls();
    this.invalidateTargetCache();
    this.scheduleHandleRefresh();
  };

  private readonly handleDocumentKeyDown = (event: KeyboardEvent): void => {
    if (!this.draggedRanges) return;
    if (event.key !== 'Escape') return;
    event.preventDefault();
    this.finishDrag();
    this.clearPointer();
    this.hideControls();
    this.invalidateTargetCache();
    this.scheduleHandleRefresh();
  };
}
