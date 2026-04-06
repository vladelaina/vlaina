import type { EditorView } from '@milkdown/kit/prose/view';
import { createBlockRectResolver } from './blockRectResolver';
import {
  convertBlockRectsToDocumentSpace,
  convertViewportDragRectToDocumentRect,
  getBlockRangesKey,
  resolveDisplayedDragViewportRect,
  resolveIntersectedBlockRanges,
  type BlockRange,
  type RectBounds,
} from './blockSelectionUtils';
import {
  resolveBlankAreaPlainClickAction,
  type BlankAreaPlainClickAction,
} from './blankAreaPlainClick';
import { startBlockDragSession, type BlockDragSessionHandle, type BlockDragStartZone } from './blockDragSession';
import { expandListItemHeaderRanges } from './blockUnitResolver';

interface BlankAreaSelectionPlainClickResult {
  zone: BlockDragStartZone;
  action: BlankAreaPlainClickAction | null;
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
  let dragMoveRafId = 0;

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
    const docSpaceBlockRects = convertBlockRectsToDocumentSpace(
      rectResolver.getTopLevelBlockRects(),
      currentScrollLeft,
      currentScrollTop,
    );
    const selectedBlocks = resolveIntersectedBlockRanges(docSpaceBlockRects, docSpaceDragRect);
    const expandedBlocks = expandListItemHeaderRanges(view.state.doc, selectedBlocks);
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
      updateDragBox(dragBox, viewportRect);
    }

    scheduleDragRectSelection(lastViewportDragRect);
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
    },
    onDragMove(dragRect) {
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
        updateDragBox(dragBox, displayedViewportRect);
      }
      scheduleDragRectSelection(dragRect);
    },
    onPlainClick(zone) {
      const action = zone === 'below-last-block'
        ? null
        : resolveBlankAreaPlainClickAction({
          blockRects: rectResolver.getTopLevelBlockRects(),
          clientX: event.clientX,
          clientY: event.clientY,
        });

      onPlainClick({ zone, action });
    },
    onTeardown() {
      flushPendingDragSelection();
      if (dragBox) {
        dragBox.remove();
        dragBox = null;
      }
      scrollRoot?.removeEventListener('scroll', handleScrollWhileDragging);
      rectResolver.invalidate();
      onSyncSelectionState();
    },
  });

  scrollRoot?.addEventListener('scroll', handleScrollWhileDragging, { passive: true });
  return session;
}
