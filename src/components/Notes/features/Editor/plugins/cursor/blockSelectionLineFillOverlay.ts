import type { EditorView } from '@milkdown/kit/prose/view';
import { getBlockSelectionPluginState } from './blockSelectionPluginState';
import {
  getBlockRangesKey,
  type BlockRange,
} from './blockSelectionUtils';
import {
  BLOCK_SELECTION_PENDING_CLASS,
  LINE_FILL_LAYER_CLASS,
  MAX_BLOCK_SELECTION_LINE_FILL_ELEMENTS,
  MAX_BLOCK_SELECTION_LINE_FILL_DOM_RECTS,
  MAX_BLOCK_SELECTION_LINE_FILL_RANGES,
  type LineFillOverlay,
} from './blockSelectionLineFillConstants';
import { collectSelectedHardBreakLineRanges } from './blockSelectionLineFillRanges';
import { collectRangeRows } from './blockSelectionLineFillRows';
import {
  isRectNearViewport,
  resolveLineFillEdges,
  resolveLineFillLeft,
  resolveLineFillRight,
  resolveLineFillViewportRect,
  resolveParagraphElement,
} from './blockSelectionLineFillMetrics';
import {
  appendLineFillElement,
  appendSelectedImageBlockLineFills,
} from './blockSelectionLineFillRender';

export {
  collectRangeRows,
  collectSelectedHardBreakLineRanges,
  MAX_BLOCK_SELECTION_LINE_FILL_DOM_RECTS,
  MAX_BLOCK_SELECTION_LINE_FILL_RANGES,
};

export function createBlockSelectionLineFillOverlay(view: EditorView): LineFillOverlay {
  const doc = view.dom.ownerDocument;
  const host = view.dom.parentElement ?? view.dom;
  const scrollRoot = view.dom.closest<HTMLElement>('[data-note-scroll-root="true"]');
  const win = doc.defaultView;
  let lastDoc: EditorView['state']['doc'] | null = null;
  let lastSelectedBlocks: readonly BlockRange[] | null = null;
  let lastSelectionKey: string | null = null;
  let currentView = view;
  let scrollRafId = 0;
  let deferredGeometryUpdateTimeoutId = 0;
  let resizeObserver: ResizeObserver | null = null;
  if (host instanceof HTMLElement) {
    host.classList.add('editor-block-selection-line-fill-host');
  }
  const layer = doc.createElement('div');
  layer.className = LINE_FILL_LAYER_CLASS;
  layer.setAttribute('aria-hidden', 'true');
  host.appendChild(layer);

  const update = (updatedView: EditorView) => {
    currentView = updatedView;
    const { selectedBlocks } = getBlockSelectionPluginState(updatedView.state);
    if (selectedBlocks.length === 0) {
      lastDoc = updatedView.state.doc;
      lastSelectedBlocks = selectedBlocks;
      lastSelectionKey = '';
      if (layer.childNodes.length > 0) {
        layer.replaceChildren();
      }
      return;
    }

    if (updatedView.dom.classList.contains(BLOCK_SELECTION_PENDING_CLASS)) {
      scheduleDeferredGeometryUpdateAfterDrag();
      return;
    }

    if (lastDoc === updatedView.state.doc && lastSelectedBlocks === selectedBlocks) {
      return;
    }

    const selectionKey = getBlockRangesKey(selectedBlocks);
    if (lastDoc === updatedView.state.doc && lastSelectionKey === selectionKey) {
      lastSelectedBlocks = selectedBlocks;
      return;
    }
    lastDoc = updatedView.state.doc;
    lastSelectedBlocks = selectedBlocks;
    lastSelectionKey = selectionKey;

    layer.replaceChildren();
    const currentHost = layer.parentElement ?? updatedView.dom;
    const hostRect = currentHost.getBoundingClientRect();
    const viewportRect = resolveLineFillViewportRect(updatedView);
    const ranges = collectSelectedHardBreakLineRanges(updatedView);
    let createdFills = 0;

    for (const range of ranges) {
      if (createdFills >= MAX_BLOCK_SELECTION_LINE_FILL_ELEMENTS) break;
      const paragraph = resolveParagraphElement(updatedView, range);
      if (!paragraph) continue;
      const paragraphRect = paragraph.getBoundingClientRect();
      if (viewportRect && paragraphRect.top > viewportRect.bottom) break;
      if (!isRectNearViewport(paragraphRect, viewportRect)) continue;

      const fillStart = resolveLineFillLeft(paragraph, paragraphRect);
      const fillRight = resolveLineFillRight(updatedView, paragraph, paragraphRect);
      const edges = resolveLineFillEdges(paragraph);
      const rows = collectRangeRows(updatedView, range);
      if (rows.length === 0) continue;
      const firstRow = rows[0];
      const lastRow = rows[rows.length - 1];
      if (
        firstRow &&
        lastRow &&
        appendLineFillElement(doc, layer, hostRect, fillStart, fillRight, firstRow.top, lastRow.bottom, edges)
      ) {
        createdFills += 1;
      }
    }

    createdFills += appendSelectedImageBlockLineFills(
      updatedView,
      doc,
      layer,
      hostRect,
      viewportRect,
      MAX_BLOCK_SELECTION_LINE_FILL_ELEMENTS - createdFills,
    );
  };

  const isBlockSelectionDragPending = () => currentView.dom.classList.contains(BLOCK_SELECTION_PENDING_CLASS);

  const scheduleDeferredGeometryUpdateAfterDrag = () => {
    if (!win || deferredGeometryUpdateTimeoutId !== 0) return;
    deferredGeometryUpdateTimeoutId = win.setTimeout(() => {
      deferredGeometryUpdateTimeoutId = 0;
      if (isBlockSelectionDragPending()) {
        scheduleDeferredGeometryUpdateAfterDrag();
        return;
      }
      scheduleGeometryUpdate();
    }, 80);
  };

  function scheduleGeometryUpdate() {
    if (!win || scrollRafId !== 0) return;
    if (isBlockSelectionDragPending()) {
      scheduleDeferredGeometryUpdateAfterDrag();
      return;
    }
    if (lastSelectionKey === '' && layer.childNodes.length === 0) {
      return;
    }
    scrollRafId = win.requestAnimationFrame(() => {
      scrollRafId = 0;
      lastSelectedBlocks = null;
      lastSelectionKey = null;
      update(currentView);
    });
  }

  scrollRoot?.addEventListener('scroll', scheduleGeometryUpdate, { passive: true });
  win?.addEventListener('resize', scheduleGeometryUpdate);
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(scheduleGeometryUpdate);
    resizeObserver.observe(view.dom);
    if (host instanceof HTMLElement && host !== view.dom) {
      resizeObserver.observe(host);
    }
    if (scrollRoot && scrollRoot !== view.dom && scrollRoot !== host) {
      resizeObserver.observe(scrollRoot);
    }
  }

  update(view);

  return {
    update,
    destroy() {
      scrollRoot?.removeEventListener('scroll', scheduleGeometryUpdate);
      win?.removeEventListener('resize', scheduleGeometryUpdate);
      resizeObserver?.disconnect();
      resizeObserver = null;
      if (win && scrollRafId !== 0) {
        win.cancelAnimationFrame(scrollRafId);
        scrollRafId = 0;
      }
      if (win && deferredGeometryUpdateTimeoutId !== 0) {
        win.clearTimeout(deferredGeometryUpdateTimeoutId);
        deferredGeometryUpdateTimeoutId = 0;
      }
      if (host instanceof HTMLElement) {
        host.classList.remove('editor-block-selection-line-fill-host');
      }
      layer.remove();
    },
  };
}
