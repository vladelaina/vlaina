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
import {
  createVerticalEdgeAutoScroll,
  resolveVerticalEdgeAutoScrollDelta,
} from './edgeAutoScroll';
import { themeDomStyleTokens, themeRenderingTokens, themeStyleResetTokens } from '@/styles/themeTokens';

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

const EXTERNAL_BLANK_AREA_SELECTION_MIN_BLOCK_OVERLAP_PX = 12;
const GEOMETRY_RESIZE_TOLERANCE_PX = 1;
const BLOCK_SELECTION_PENDING_CLASS = 'editor-block-selection-pending';

function getBlockRangeKey(range: BlockRange): string {
  return `${range.from}:${range.to}`;
}

function getHorizontalOverlapPx(left: RectBounds, right: RectBounds): number {
  return Math.max(0, Math.min(left.right, right.right) - Math.max(left.left, right.left));
}

export function filterExternalBlankAreaSelectionEdgeGrazes(
  blocks: readonly BlockRect[],
  selectedBlocks: readonly BlockRange[],
  selectionRect: RectBounds,
  minBlockOverlapPx = EXTERNAL_BLANK_AREA_SELECTION_MIN_BLOCK_OVERLAP_PX,
): BlockRange[] {
  if (selectedBlocks.length === 0) {
    return [];
  }

  const blockByRange = new Map(blocks.map((block) => [getBlockRangeKey(block), block]));
  return selectedBlocks.filter((range) => {
    const block = blockByRange.get(getBlockRangeKey(range));
    if (!block) {
      return false;
    }
    return getHorizontalOverlapPx(block, selectionRect) >= minBlockOverlapPx;
  });
}

function createDragBox(doc: Document, dragBoxColor: string): HTMLDivElement {
  const box = doc.createElement('div');
  box.setAttribute('data-editor-drag-box', 'true');
  box.style.position = themeDomStyleTokens.positionFixed;
  box.style.pointerEvents = themeStyleResetTokens.pointerEventsNone;
  box.style.zIndex = themeDomStyleTokens.zIndexMax;
  box.style.border = themeDomStyleTokens.borderNone;
  box.style.background = dragBoxColor;
  box.style.borderRadius = themeStyleResetTokens.borderRadiusNone;
  box.style.left = themeDomStyleTokens.sizeZeroPx;
  box.style.top = themeDomStyleTokens.sizeZeroPx;
  box.style.transform = themeRenderingTokens.translate3dZeroPx;
  box.style.transformOrigin = `${themeDomStyleTokens.sizeZero} ${themeDomStyleTokens.sizeZero}`;
  box.style.willChange = themeRenderingTokens.transformSizeWillChange;
  box.style.contain = themeRenderingTokens.containLayoutPaintStyle;
  box.style.width = themeDomStyleTokens.sizeZeroPx;
  box.style.height = themeDomStyleTokens.sizeZeroPx;
  return box;
}

function updateDragBox(box: HTMLDivElement, rect: RectBounds): void {
  const width = rect.right - rect.left;
  const height = rect.bottom - rect.top;

  box.style.transform = `translate3d(${rect.left}px, ${rect.top}px, 0)`;
  box.style.width = `${width}px`;
  box.style.height = `${height}px`;
}

function areRectBoundsEqual(left: RectBounds | null, right: RectBounds | null): boolean {
  return left !== null
    && right !== null
    && left.left === right.left
    && left.top === right.top
    && left.right === right.right
    && left.bottom === right.bottom;
}

function getDragBoxTopBoundary(scrollRoot: HTMLElement | null): number {
  return scrollRoot?.getBoundingClientRect().top ?? 0;
}

function resolveDragPointerY(startY: number, rect: RectBounds): number {
  return startY === rect.top ? rect.bottom : rect.top;
}

function hasMeaningfulResizeDelta(
  previous: { width: number; height: number } | undefined,
  next: { width: number; height: number },
): boolean {
  if (!previous) return true;
  return (
    Math.abs(previous.width - next.width) > GEOMETRY_RESIZE_TOLERANCE_PX ||
    Math.abs(previous.height - next.height) > GEOMETRY_RESIZE_TOLERANCE_PX
  );
}

export function resolveBlankAreaSelectionAutoScrollDelta(
  pointerY: number,
  scrollRootRect: Pick<DOMRect, 'top' | 'bottom'>,
): number {
  return resolveVerticalEdgeAutoScrollDelta(pointerY, scrollRootRect);
}

export function blurActiveEditableElement(doc: Document): void {
  const activeElement = doc.activeElement;
  if (!(activeElement instanceof HTMLElement) || activeElement === doc.body) return;
  if (!activeElement.matches([
    'input',
    'textarea',
    'select',
    'button',
    '[contenteditable]:not([contenteditable="false"])',
  ].join(', '))) return;

  activeElement.blur();
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
  const startedInsideEditor = event.target instanceof Node && view.dom.contains(event.target);
  const shouldFilterExternalEdgeGrazes = startZone === 'outside-editor' && !startedInsideEditor;
  const startScrollLeft = scrollRoot?.scrollLeft ?? 0;
  const startScrollTop = scrollRoot?.scrollTop ?? 0;
  const rectResolver = createBlockRectResolver({
    view,
    scrollRootSelector,
  });

  let dragBox: HTMLDivElement | null = null;
  let selectedBlocksKey = getBlockRangesKey(initialSelectedBlocks);
  let pendingDragRect: RectBounds | null = null;
  let pendingDragBoxRect: RectBounds | null = null;
  let lastViewportDragRect: RectBounds | null = null;
  let lastAppliedViewportDragRect: RectBounds | null = null;
  let lastAppliedScrollLeft = Number.NaN;
  let lastAppliedScrollTop = Number.NaN;
  let lastPointerY = event.clientY;
  let dragBoxTopBoundary = 0;
  let dragMoveRafId = 0;
  let dragBoxRafId = 0;
  let preserveContainingBlocksForSession = false;
  let didResolveFirstNonEmptySelection = false;
  let cachedSelectionResolutionKey = '';
  let cachedSelectionResolutionBlocks: BlockRange[] = [];
  let cachedSelectionResolutionExpandedKey = '';
  let cachedDocSpaceBlockRects: readonly BlockRect[] | null = null;
  let cachedDocSpaceBlockIndex: BlockRectYIndex | null = null;
  let resizeObserver: ResizeObserver | null = null;
  const observedResizeSizes = new WeakMap<Element, { width: number; height: number }>();

  const rememberObservedResizeSize = (element: Element) => {
    if (!(element instanceof HTMLElement)) return;
    const rect = element.getBoundingClientRect();
    observedResizeSizes.set(element, {
      width: rect.width,
      height: rect.height,
    });
  };

  const getDocSpaceBlockRectIndex = (
    currentScrollLeft: number,
    currentScrollTop: number,
  ): { blockRects: readonly BlockRect[]; index: BlockRectYIndex } => {
    if (cachedDocSpaceBlockRects && cachedDocSpaceBlockIndex) {
      return {
        blockRects: cachedDocSpaceBlockRects,
        index: cachedDocSpaceBlockIndex,
      };
    }

    const sourceRects = rectResolver.getSelectionBlockRects();
    if (sourceRects.length === 0) {
      return {
        blockRects: [],
        index: createBlockRectYIndex([]),
      };
    }

    const docSpaceBlockRects = convertBlockRectsToDocumentSpace(sourceRects, currentScrollLeft, currentScrollTop);
    const docSpaceBlockIndex = createBlockRectYIndex(docSpaceBlockRects);
    cachedDocSpaceBlockRects = docSpaceBlockRects;
    cachedDocSpaceBlockIndex = docSpaceBlockIndex;
    return {
      blockRects: docSpaceBlockRects,
      index: docSpaceBlockIndex,
    };
  };

  const applyDragRectSelection = (viewportDragRect: RectBounds) => {
    const currentScrollLeft = scrollRoot?.scrollLeft ?? 0;
    const currentScrollTop = scrollRoot?.scrollTop ?? 0;
    lastAppliedViewportDragRect = viewportDragRect;
    lastAppliedScrollLeft = currentScrollLeft;
    lastAppliedScrollTop = currentScrollTop;
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
    const selectedBlocks = shouldFilterExternalEdgeGrazes
      ? filterExternalBlankAreaSelectionEdgeGrazes(
        docSpaceBlockRects,
        resolveIntersectedBlockRangesFromYIndex(docSpaceBlockIndex, docSpaceDragRect),
        docSpaceDragRect,
      )
      : resolveIntersectedBlockRangesFromYIndex(docSpaceBlockIndex, docSpaceDragRect);
    const selectedIntersectionKey = getBlockRangesKey(selectedBlocks);
    if (!didResolveFirstNonEmptySelection && selectedBlocks.length > 0) {
      didResolveFirstNonEmptySelection = true;
      preserveContainingBlocksForSession = preferNestedBlockRanges(selectedBlocks).length === selectedBlocks.length;
    }
    const selectionResolutionKey = `${selectedIntersectionKey}|${preserveContainingBlocksForSession ? 'preserve' : 'nested'}|${Math.round(docSpaceDragRect.top * 100) / 100}|${currentScrollLeft}|${currentScrollTop}`;
    let expandedBlocks = cachedSelectionResolutionBlocks;
    let nextKey = cachedSelectionResolutionExpandedKey;

    if (selectionResolutionKey !== cachedSelectionResolutionKey) {
      const nestedPreferredBlocks = preserveContainingBlocksForSession
        ? selectedBlocks
        : preferNestedBlockRangesUnlessHeaderIntersects(selectedBlocks, docSpaceBlockRects, docSpaceDragRect);
      expandedBlocks = expandKnownSelectableListItemHeaderRanges(
        view.state.doc,
        nestedPreferredBlocks,
        docSpaceBlockRects,
      );
      nextKey = getBlockRangesKey(expandedBlocks);
      cachedSelectionResolutionKey = selectionResolutionKey;
      cachedSelectionResolutionBlocks = expandedBlocks;
      cachedSelectionResolutionExpandedKey = nextKey;
    }
    if (nextKey === selectedBlocksKey) return;

    selectedBlocksKey = nextKey;
    onSelectionChange(expandedBlocks);
  };

  const invalidateGeometryCache = () => {
    rectResolver.invalidate();
    cachedDocSpaceBlockRects = null;
    cachedDocSpaceBlockIndex = null;
    cachedSelectionResolutionKey = '';
    cachedSelectionResolutionBlocks = [];
    cachedSelectionResolutionExpandedKey = '';
    lastAppliedViewportDragRect = null;
    lastAppliedScrollLeft = Number.NaN;
    lastAppliedScrollTop = Number.NaN;
  };

  const handleGeometryResize: ResizeObserverCallback = (entries) => {
    if (entries.length > 0 && view.dom.classList.contains(BLOCK_SELECTION_PENDING_CLASS)) {
      return;
    }

    if (entries.length > 0) {
      let hasMeaningfulResize = false;
      for (const entry of entries) {
        const nextSize = {
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        };
        const previousSize = observedResizeSizes.get(entry.target);
        observedResizeSizes.set(entry.target, nextSize);
        if (hasMeaningfulResizeDelta(previousSize, nextSize)) {
          hasMeaningfulResize = true;
        }
      }
      if (!hasMeaningfulResize) return;
    }

    invalidateGeometryCache();
    dragBoxTopBoundary = getDragBoxTopBoundary(scrollRoot);
    if (!lastViewportDragRect) return;
    scheduleDragRectSelection(lastViewportDragRect);
  };

  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(handleGeometryResize);
    rememberObservedResizeSize(view.dom);
    resizeObserver.observe(view.dom);
    if (scrollRoot) {
      rememberObservedResizeSize(scrollRoot);
      resizeObserver.observe(scrollRoot);
    }
  }

  function scheduleDragRectSelection(viewportDragRect: RectBounds): void {
    const currentScrollLeft = scrollRoot?.scrollLeft ?? 0;
    const currentScrollTop = scrollRoot?.scrollTop ?? 0;
    if (
      areRectBoundsEqual(lastAppliedViewportDragRect, viewportDragRect)
      && lastAppliedScrollLeft === currentScrollLeft
      && lastAppliedScrollTop === currentScrollTop
    ) {
      pendingDragRect = null;
      return;
    }

    pendingDragRect = viewportDragRect;
    if (dragMoveRafId !== 0) return;

    dragMoveRafId = window.requestAnimationFrame(() => {
      dragMoveRafId = 0;
      if (!pendingDragRect) return;
      const nextRect = pendingDragRect;
      pendingDragRect = null;
      applyDragRectSelection(nextRect);
    });
  }

  const scheduleDragBoxUpdate = (viewportRect: RectBounds) => {
    pendingDragBoxRect = viewportRect;
    if (dragBoxRafId !== 0) return;

    dragBoxRafId = window.requestAnimationFrame(() => {
      dragBoxRafId = 0;
      if (!pendingDragBoxRect || !dragBox) return;
      const nextRect = pendingDragBoxRect;
      pendingDragBoxRect = null;
      updateDragBox(dragBox, nextRect);
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
    const currentScrollLeft = scrollRoot?.scrollLeft ?? 0;
    const currentScrollTop = scrollRoot?.scrollTop ?? 0;
    if (
      areRectBoundsEqual(lastAppliedViewportDragRect, nextRect)
      && lastAppliedScrollLeft === currentScrollLeft
      && lastAppliedScrollTop === currentScrollTop
    ) {
      return;
    }
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
      scheduleDragBoxUpdate(clampViewportRectTop(viewportRect, dragBoxTopBoundary));
    }

    scheduleDragRectSelection(lastViewportDragRect);
  };

  const autoScroll = createVerticalEdgeAutoScroll({
    scrollRoot,
    getPointerY: () => lastViewportDragRect ? lastPointerY : null,
    onScroll: handleScrollWhileDragging,
  });

  const session = startBlockDragSession({
    view,
    event,
    startZone,
    dragThreshold,
    cursor,
    cursorRoot: scrollRoot,
    onActivate() {
      dragBox = createDragBox(doc, dragBoxColor);
      doc.body.appendChild(dragBox);
      dragBoxTopBoundary = getDragBoxTopBoundary(scrollRoot);
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        selection.removeAllRanges();
      }
      blurActiveEditableElement(doc);
      onActivateSelectionState();
      autoScroll.start();
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
        scheduleDragBoxUpdate(clampViewportRectTop(displayedViewportRect, dragBoxTopBoundary));
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
      if (dragBoxRafId !== 0) {
        window.cancelAnimationFrame(dragBoxRafId);
        dragBoxRafId = 0;
      }
      pendingDragBoxRect = null;
      resizeObserver?.disconnect();
      resizeObserver = null;
      scrollRoot?.removeEventListener('scroll', handleScrollWhileDragging);
      autoScroll.stop();
      rectResolver.invalidate();
      onSyncSelectionState();
    },
  });

  scrollRoot?.addEventListener('scroll', handleScrollWhileDragging, { passive: true });
  return session;
}
