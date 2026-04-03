import type { EditorView } from '@milkdown/kit/prose/view';
import { getBlockSelectionPluginState } from './blockSelectionPluginState';
import { getBlockRangesKey, normalizeBlockRanges, type BlockRange } from './blockSelectionUtils';
import { pickPointerBlock } from './blockControlsUtils';
import { createBlockDragPreview, type BlockDragPreviewHandle } from './blockDragPreview';
import { createBlockControlsDom } from './blockControlsDom';
import {
  applyBlockMove,
  canApplyBlockMove,
  getDraggableBlockRanges,
  resolveBlockTargetByPos,
  resolveDropTarget,
  setControlsPosition,
  type DropTarget,
  type HandleBlockTarget,
} from './blockControlsInteractions';

const SCROLL_ROOT_SELECTOR = '[data-note-scroll-root="true"]';
const CONTROLS_LEFT_OFFSET = 44;
const WHEEL_DELTA_MODE_LINE = 1;
const WHEEL_DELTA_MODE_PAGE = 2;
const WHEEL_LINE_HEIGHT_PX = 16;

function normalizeWheelDelta(delta: number, deltaMode: number, pageSize: number): number {
  if (deltaMode === WHEEL_DELTA_MODE_LINE) return delta * WHEEL_LINE_HEIGHT_PX;
  if (deltaMode === WHEEL_DELTA_MODE_PAGE) return delta * pageSize;
  return delta;
}

export class BlockControlsViewSession {
  private readonly view: EditorView;
  private readonly doc: Document;
  private readonly scrollRoot: HTMLElement | null;
  private readonly controls: HTMLDivElement;
  private readonly handleButton: HTMLButtonElement;
  private readonly dropIndicator: HTMLDivElement;

  private draggedRanges: BlockRange[] | null = null;
  private dragPreview: BlockDragPreviewHandle | null = null;
  private pendingDrop: DropTarget | null = null;
  private lastDragClientX: number | null = null;
  private lastDragClientY: number | null = null;
  private pointerY: number | null = null;
  private refreshRafId = 0;

  private cachedTargets: HandleBlockTarget[] = [];
  private cachedSelectionKey = '';
  private cachedDoc;
  private cachedScrollLeft = Number.NaN;
  private cachedScrollTop = Number.NaN;

  constructor(view: EditorView) {
    this.view = view;
    this.doc = view.dom.ownerDocument;
    this.scrollRoot = view.dom.closest(SCROLL_ROOT_SELECTOR) as HTMLElement | null;
    this.cachedDoc = view.state.doc;

    const { controls, handleButton, dropIndicator } = createBlockControlsDom(this.doc);
    this.controls = controls;
    this.handleButton = handleButton;
    this.dropIndicator = dropIndicator;

    this.handleButton.addEventListener('mousedown', this.handleHandleMouseDown);
    this.doc.addEventListener('mousemove', this.handleDocumentMouseMove, true);
    this.doc.addEventListener('mouseup', this.handleDocumentMouseUp, true);
    this.doc.addEventListener('wheel', this.handleDocumentWheel, { capture: true, passive: false });
    this.doc.addEventListener('keydown', this.handleDocumentKeyDown, true);
    this.scrollRoot?.addEventListener('scroll', this.handleScrollOrResize, { passive: true });
    window.addEventListener('blur', this.handleWindowBlur);
    window.addEventListener('resize', this.handleScrollOrResize);
    this.scheduleHandleRefresh();
  }

  update(): void {
    this.invalidateTargetCache();
    this.scheduleHandleRefresh();
  }

  destroy(): void {
    if (this.refreshRafId !== 0) {
      window.cancelAnimationFrame(this.refreshRafId);
      this.refreshRafId = 0;
    }
    this.handleButton.removeEventListener('mousedown', this.handleHandleMouseDown);
    this.doc.removeEventListener('mousemove', this.handleDocumentMouseMove, true);
    this.doc.removeEventListener('mouseup', this.handleDocumentMouseUp, true);
    this.doc.removeEventListener('wheel', this.handleDocumentWheel, true);
    this.doc.removeEventListener('keydown', this.handleDocumentKeyDown, true);
    this.scrollRoot?.removeEventListener('scroll', this.handleScrollOrResize);
    window.removeEventListener('blur', this.handleWindowBlur);
    window.removeEventListener('resize', this.handleScrollOrResize);
    if (this.dragPreview) {
      this.dragPreview.destroy();
      this.dragPreview = null;
    }
    this.controls.remove();
    this.dropIndicator.remove();
  }

  private getSelectedBlockRanges(): BlockRange[] {
    return normalizeBlockRanges(getBlockSelectionPluginState(this.view.state).selectedBlocks);
  }

  private hideControls(): void {
    this.controls.classList.remove('visible');
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

  private invalidateTargetCache(): void {
    this.cachedTargets = [];
    this.cachedSelectionKey = '';
    this.cachedDoc = this.view.state.doc;
    this.cachedScrollLeft = Number.NaN;
    this.cachedScrollTop = Number.NaN;
  }

  private getCachedHandleTargets(): HandleBlockTarget[] {
    const draggableRanges = getDraggableBlockRanges(this.view, this.getSelectedBlockRanges());
    if (draggableRanges.length === 0) return [];

    const selectionKey = getBlockRangesKey(draggableRanges);
    const nextScrollLeft = this.scrollRoot?.scrollLeft ?? 0;
    const nextScrollTop = this.scrollRoot?.scrollTop ?? 0;
    if (
      this.cachedSelectionKey === selectionKey
      && this.cachedDoc === this.view.state.doc
      && this.cachedScrollLeft === nextScrollLeft
      && this.cachedScrollTop === nextScrollTop
    ) {
      return this.cachedTargets;
    }

    this.cachedSelectionKey = selectionKey;
    this.cachedDoc = this.view.state.doc;
    this.cachedScrollLeft = nextScrollLeft;
    this.cachedScrollTop = nextScrollTop;
    this.cachedTargets = draggableRanges
      .map((range) => resolveBlockTargetByPos(this.view, range.from))
      .filter((target): target is HandleBlockTarget => target !== null);
    return this.cachedTargets;
  }

  private showHandleForPointer(): void {
    if (this.draggedRanges) return;
    const targets = this.getCachedHandleTargets();
    const nextTarget = pickPointerBlock(targets, this.pointerY);
    if (!nextTarget) {
      this.hideControls();
      return;
    }
    setControlsPosition(this.controls, nextTarget, CONTROLS_LEFT_OFFSET);
    this.controls.classList.add('visible');
  }

  private scheduleHandleRefresh(): void {
    if (this.refreshRafId !== 0) return;
    this.refreshRafId = window.requestAnimationFrame(() => {
      this.refreshRafId = 0;
      this.showHandleForPointer();
    });
  }

  private finishDrag(): void {
    this.draggedRanges = null;
    this.lastDragClientX = null;
    this.lastDragClientY = null;
    if (this.dragPreview) {
      this.dragPreview.destroy();
      this.dragPreview = null;
    }
    this.controls.classList.remove('dragging');
    this.hideDropIndicator();
  }

  private readonly handleHandleMouseDown = (event: MouseEvent): void => {
    if (event.button !== 0) return;
    const draggableRanges = getDraggableBlockRanges(this.view, this.getSelectedBlockRanges());
    if (draggableRanges.length === 0) return;

    event.preventDefault();
    event.stopPropagation();

    this.draggedRanges = draggableRanges;
    this.controls.classList.add('dragging');

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
      this.lastDragClientX = event.clientX;
      this.lastDragClientY = event.clientY;
      this.updateDropTargetByPointer(event.clientX, event.clientY);
      if (this.dragPreview) {
        this.dragPreview.element.style.left = `${Math.round(event.clientX - this.dragPreview.offsetX)}px`;
        this.dragPreview.element.style.top = `${Math.round(event.clientY - this.dragPreview.offsetY)}px`;
      }
      event.preventDefault();
      return;
    }

    this.pointerY = event.clientY;
    this.scheduleHandleRefresh();
  };

  private readonly handleScrollOrResize = (): void => {
    if (this.draggedRanges) {
      this.invalidateTargetCache();
      if (this.lastDragClientX !== null && this.lastDragClientY !== null) {
        this.updateDropTargetByPointer(this.lastDragClientX, this.lastDragClientY);
      } else {
        this.hideDropIndicator();
      }
      return;
    }
    this.invalidateTargetCache();
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

    this.invalidateTargetCache();
    this.scheduleHandleRefresh();
    if (this.lastDragClientX !== null && this.lastDragClientY !== null) {
      this.updateDropTargetByPointer(this.lastDragClientX, this.lastDragClientY);
    }
  };

  private readonly handleDocumentMouseUp = (event: MouseEvent): void => {
    if (!this.draggedRanges) return;
    event.preventDefault();
    if (!this.pendingDrop) {
      this.finishDrag();
    } else {
      applyBlockMove(this.view, this.draggedRanges, this.pendingDrop.insertPos);
      this.finishDrag();
    }
    this.invalidateTargetCache();
    this.scheduleHandleRefresh();
  };

  private readonly handleWindowBlur = (): void => {
    if (!this.draggedRanges) return;
    this.finishDrag();
    this.invalidateTargetCache();
    this.scheduleHandleRefresh();
  };

  private readonly handleDocumentKeyDown = (event: KeyboardEvent): void => {
    if (!this.draggedRanges) return;
    if (event.key !== 'Escape') return;
    event.preventDefault();
    this.finishDrag();
    this.invalidateTargetCache();
    this.scheduleHandleRefresh();
  };
}
