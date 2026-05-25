import type { EditorView } from '@milkdown/kit/prose/view';
import { createBlockRectResolver } from './blockRectResolver';
import {
  clampViewportRectTop,
  createBlockRectYIndex,
  convertBlockRectsToDocumentSpace,
  convertViewportDragRectToDocumentRect,
  getBlockRangesKey,
  preferNestedBlockRanges,
  preferNestedBlockRangesUnlessHeaderIntersects,
  resolveDisplayedDragViewportRect,
  resolveIntersectedBlockRangesFromYIndex,
  type BlockRect,
  type BlockRectYIndex,
  type BlockRange,
  type RectBounds,
} from './blockSelectionUtils';
import {
  resolveBlankAreaPlainClickAction,
  type BlankAreaPlainClickAction,
} from './blankAreaPlainClick';
import { startBlockDragSession, type BlockDragSessionHandle, type BlockDragStartZone } from './blockDragSession';
import { expandKnownSelectableListItemHeaderRanges } from './blockUnitResolver';

interface BlankAreaSelectionPlainClickResult {
  zone: BlockDragStartZone;
  action: BlankAreaPlainClickAction | null;
  blockRects: readonly BlockRect[];
  clientX: number;
  clientY: number;
}

interface StartBlankAreaSelectionSessionOptions {
  view: EditorView;
  event: MouseEvent;
  startZone: BlockDragStartZone;
  dragThreshold: number;
  cursor: string;
  dragBoxColor: string;
  scrollRootSelector: string;
  initialSelectedBlocks: readonly BlockRange[];
  onSelectionChange: (blocks: BlockRange[]) => void;
  onPlainClick: (result: BlankAreaSelectionPlainClickResult) => void;
  onActivateSelectionState: () => void;
  onSyncSelectionState: () => void;
}

const AUTO_SCROLL_EDGE_PX = 56;
const AUTO_SCROLL_MAX_STEP_PX = 18;

function createDragBox(doc: Document, dragBoxColor: string): HTMLDivElement {
  const box = doc.createElement('div');
  box.setAttribute('data-editor-drag-box', 'true');
  box.style.position = 'fixed';
  box.style.pointerEvents = 'none';
  box.style.zIndex = '9999';
  box.style.border = '0';
  box.style.background = dragBoxColor;
  box.style.borderRadius = '0';
  box.style.left = '0px';
  box.style.top = '0px';
  box.style.width = '0px';
  box.style.height = '0px';
  return box;
}

function updateDragBox(box: HTMLDivElement, rect: RectBounds): void {
  const width = rect.right - rect.left;
  const height = rect.bottom - rect.top;

  box.style.left = `${rect.left}px`;
  box.style.top = `${rect.top}px`;
  box.style.width = `${width}px`;
  box.style.height = `${height}px`;
}

function getDragBoxTopBoundary(scrollRoot: HTMLElement | null): number {
  return scrollRoot?.getBoundingClientRect().top ?? 0;
}

function resolveDragPointerY(startY: number, rect: RectBounds): number {
  return startY === rect.top ? rect.bottom : rect.top;
}

export function resolveBlankAreaSelectionAutoScrollDelta(
  pointerY: number,
  scrollRootRect: Pick<DOMRect, 'top' | 'bottom'>,
): number {
  if (pointerY < scrollRootRect.top + AUTO_SCROLL_EDGE_PX) {
    const distanceIntoEdge = scrollRootRect.top + AUTO_SCROLL_EDGE_PX - pointerY;
    const intensity = Math.min(distanceIntoEdge, AUTO_SCROLL_EDGE_PX) / AUTO_SCROLL_EDGE_PX;
    return -Math.ceil(intensity * AUTO_SCROLL_MAX_STEP_PX);
  }

  if (pointerY > scrollRootRect.bottom - AUTO_SCROLL_EDGE_PX) {
    const distanceIntoEdge = pointerY - (scrollRootRect.bottom - AUTO_SCROLL_EDGE_PX);
    const intensity = Math.min(distanceIntoEdge, AUTO_SCROLL_EDGE_PX) / AUTO_SCROLL_EDGE_PX;
    return Math.ceil(intensity * AUTO_SCROLL_MAX_STEP_PX);
  }

  return 0;
}

export function startBlankAreaSelectionSession(
  options: StartBlankAreaSelectionSessionOptions,
): BlockDragSessionHandle {
  const {
    view,
    event,
    startZone,
    dragThreshold,
    cursor,
    dragBoxColor,
    scrollRootSelector,
    initialSelectedBlocks,
    onSelectionChange,
    onPlainClick,
    onActivateSelectionState,
    onSyncSelectionState,
  } = options;

  const doc = view.dom.ownerDocument;
  const scrollRoot = view.dom.closest(scrollRootSelector) as HTMLElement | null;
  const startScrollLeft = scrollRoot?.scrollLeft ?? 0;
  const startScrollTop = scrollRoot?.scrollTop ?? 0;
  const rectResolver = createBlockRectResolver({
    view,
    scrollRootSelector,
  });

  let dragBox: HTMLDivElement | null = null;
  let selectedBlocksKey = getBlockRangesKey(initialSelectedBlocks);
  let pendingDragRect: RectBounds | null = null;
  let lastViewportDragRect: RectBounds | null = null;
  let lastPointerY = event.clientY;
  let dragMoveRafId = 0;
  let autoScrollRafId = 0;
  let isAutoScrollActive = false;
  let preserveContainingBlocksForSession = false;
  let didResolveFirstNonEmptySelection = false;
  let cachedDocSpaceSourceRects: readonly BlockRect[] | null = null;
  let cachedDocSpaceScrollLeft = Number.NaN;
  let cachedDocSpaceScrollTop = Number.NaN;
  let cachedDocSpaceBlockRects: readonly BlockRect[] = [];
  let cachedDocSpaceBlockIndex: BlockRectYIndex = createBlockRectYIndex([]);

  const getDocSpaceBlockRectIndex = (
    currentScrollLeft: number,
    currentScrollTop: number,
  ): { blockRects: readonly BlockRect[]; index: BlockRectYIndex } => {
    const sourceRects = rectResolver.getSelectionBlockRects();
    if (
      cachedDocSpaceSourceRects === sourceRects
      && cachedDocSpaceScrollLeft === currentScrollLeft
      && cachedDocSpaceScrollTop === currentScrollTop
    ) {
      return {
        blockRects: cachedDocSpaceBlockRects,
        index: cachedDocSpaceBlockIndex,
      };
    }

    cachedDocSpaceSourceRects = sourceRects;
    cachedDocSpaceScrollLeft = currentScrollLeft;
    cachedDocSpaceScrollTop = currentScrollTop;
    cachedDocSpaceBlockRects = convertBlockRectsToDocumentSpace(
      sourceRects,
      currentScrollLeft,
      currentScrollTop,
    );
    cachedDocSpaceBlockIndex = createBlockRectYIndex(cachedDocSpaceBlockRects);
    return {
      blockRects: cachedDocSpaceBlockRects,
      index: cachedDocSpaceBlockIndex,
    };
  };

  const applyDragRectSelection = (viewportDragRect: RectBounds) => {
    const currentScrollLeft = scrollRoot?.scrollLeft ?? 0;
    const currentScrollTop = scrollRoot?.scrollTop ?? 0;
    const docSpaceDragRect = convertViewportDragRectToDocumentRect(
      viewportDragRect,
      event.clientX,
      event.clientY,
      startScrollLeft,
      startScrollTop,
      currentScrollLeft,
      currentScrollTop,
    );
    const { blockRects: docSpaceBlockRects, index: docSpaceBlockIndex } = getDocSpaceBlockRectIndex(
      currentScrollLeft,
      currentScrollTop,
    );
    const selectedBlocks = resolveIntersectedBlockRangesFromYIndex(docSpaceBlockIndex, docSpaceDragRect);
    if (!didResolveFirstNonEmptySelection && selectedBlocks.length > 0) {
      didResolveFirstNonEmptySelection = true;
      preserveContainingBlocksForSession = preferNestedBlockRanges(selectedBlocks).length === selectedBlocks.length;
    }
    const nestedPreferredBlocks = preserveContainingBlocksForSession
      ? selectedBlocks
      : preferNestedBlockRangesUnlessHeaderIntersects(selectedBlocks, docSpaceBlockRects, docSpaceDragRect);
    const expandedBlocks = expandKnownSelectableListItemHeaderRanges(
      view.state.doc,
      nestedPreferredBlocks,
      docSpaceBlockRects,
    );
    const nextKey = getBlockRangesKey(expandedBlocks);
    if (nextKey === selectedBlocksKey) return;

    selectedBlocksKey = nextKey;
    onSelectionChange(expandedBlocks);
  };

  const scheduleDragRectSelection = (viewportDragRect: RectBounds) => {
    pendingDragRect = viewportDragRect;
    if (dragMoveRafId !== 0) return;

    dragMoveRafId = window.requestAnimationFrame(() => {
      dragMoveRafId = 0;
      if (!pendingDragRect) return;
      const nextRect = pendingDragRect;
      pendingDragRect = null;
      applyDragRectSelection(nextRect);
    });
  };

  const flushPendingDragSelection = () => {
    if (dragMoveRafId !== 0) {
      window.cancelAnimationFrame(dragMoveRafId);
      dragMoveRafId = 0;
    }
    if (!pendingDragRect) return;
    const nextRect = pendingDragRect;
    pendingDragRect = null;
    applyDragRectSelection(nextRect);
  };

  const handleScrollWhileDragging = () => {
    if (!lastViewportDragRect) return;

    if (dragBox) {
      const currentScrollLeft = scrollRoot?.scrollLeft ?? 0;
      const currentScrollTop = scrollRoot?.scrollTop ?? 0;
      const viewportRect = resolveDisplayedDragViewportRect(
        lastViewportDragRect,
        event.clientX,
        event.clientY,
        startScrollLeft,
        startScrollTop,
        currentScrollLeft,
        currentScrollTop,
      );
      updateDragBox(dragBox, clampViewportRectTop(viewportRect, getDragBoxTopBoundary(scrollRoot)));
    }

    scheduleDragRectSelection(lastViewportDragRect);
  };

  const stopAutoScroll = () => {
    isAutoScrollActive = false;
    if (autoScrollRafId !== 0) {
      window.cancelAnimationFrame(autoScrollRafId);
      autoScrollRafId = 0;
    }
  };

  const runAutoScrollFrame = () => {
    autoScrollRafId = 0;
    if (!isAutoScrollActive || !scrollRoot || !lastViewportDragRect) return;

    const deltaY = resolveBlankAreaSelectionAutoScrollDelta(
      lastPointerY,
      scrollRoot.getBoundingClientRect(),
    );

    if (deltaY !== 0) {
      const previousScrollTop = scrollRoot.scrollTop;
      scrollRoot.scrollTop = previousScrollTop + deltaY;
      if (scrollRoot.scrollTop !== previousScrollTop) {
        handleScrollWhileDragging();
      }
    }

    autoScrollRafId = window.requestAnimationFrame(runAutoScrollFrame);
  };

  const startAutoScroll = () => {
    if (!scrollRoot || isAutoScrollActive) return;
    isAutoScrollActive = true;
    autoScrollRafId = window.requestAnimationFrame(runAutoScrollFrame);
  };

  const session = startBlockDragSession({
    view,
    event,
    startZone,
    dragThreshold,
    cursor,
    onActivate() {
      dragBox = createDragBox(doc, dragBoxColor);
      doc.body.appendChild(dragBox);
      window.getSelection()?.removeAllRanges();
      onActivateSelectionState();
      view.focus();
      startAutoScroll();
    },
    onDragMove(dragRect) {
      lastPointerY = resolveDragPointerY(event.clientY, dragRect);
      lastViewportDragRect = dragRect;
      const currentScrollLeft = scrollRoot?.scrollLeft ?? 0;
      const currentScrollTop = scrollRoot?.scrollTop ?? 0;
      const displayedViewportRect = resolveDisplayedDragViewportRect(
        dragRect,
        event.clientX,
        event.clientY,
        startScrollLeft,
        startScrollTop,
        currentScrollLeft,
        currentScrollTop,
      );
      if (dragBox) {
        updateDragBox(dragBox, clampViewportRectTop(displayedViewportRect, getDragBoxTopBoundary(scrollRoot)));
      }
      scheduleDragRectSelection(dragRect);
    },
    onPlainClick(zone) {
      const blockRects = rectResolver.getTopLevelBlockRects();
      const action = zone === 'below-last-block'
        ? null
        : resolveBlankAreaPlainClickAction({
          blockRects,
          clientX: event.clientX,
          clientY: event.clientY,
        });
      onPlainClick({
        zone,
        action,
        blockRects,
        clientX: event.clientX,
        clientY: event.clientY,
      });
    },
    onTeardown() {
      flushPendingDragSelection();
      if (dragBox) {
        dragBox.remove();
        dragBox = null;
      }
      scrollRoot?.removeEventListener('scroll', handleScrollWhileDragging);
      stopAutoScroll();
      rectResolver.invalidate();
      onSyncSelectionState();
    },
  });

  scrollRoot?.addEventListener('scroll', handleScrollWhileDragging, { passive: true });
  return session;
}
