import type { EditorView } from '@milkdown/kit/prose/view';
import { getBlockSelectionPluginState, isLargeBlockSelection } from './blockSelectionPluginState';
import {
  areBlockSelectionDisplayRangesVisuallyAdjacent,
  getBlockRangeKey,
  getBlockRangesKey,
  getDisplayBlockRangesForDecorations,
  normalizeBlockRanges,
  type BlockRange,
  type RectBounds,
} from './blockSelectionUtils';

const LINE_FILL_LAYER_CLASS = 'editor-block-selection-line-fill-layer';
const LINE_FILL_CLASS = 'editor-block-selection-line-fill';
const ROW_MERGE_TOLERANCE_PX = 2;
const FALLBACK_BLOCK_SELECTION_BLEED_X_PX = 72;
const FALLBACK_BLOCK_SELECTION_BLEED_Y_PX = 2;
const FALLBACK_BLOCK_SELECTION_GAP_Y_PX = 1;
const LINE_FILL_VIEWPORT_OVERSCAN_PX = 600;
export const MAX_BLOCK_SELECTION_LINE_FILL_RANGES = 512;
const MAX_BLOCK_SELECTION_LINE_FILL_ROWS_PER_RANGE = 128;
const MAX_BLOCK_SELECTION_LINE_FILL_ELEMENTS = 1024;
export const MAX_BLOCK_SELECTION_LINE_FILL_DOM_RECTS = 1024;
const BLOCK_SELECTION_PENDING_CLASS = 'editor-block-selection-pending';
const SELECTED_IMAGE_BLOCK_SELECTOR = '.image-block-container.editor-block-selected';

interface LineFillOverlay {
  update: (view: EditorView) => void;
  destroy: () => void;
}

interface RowRect {
  top: number;
  right: number;
  bottom: number;
}

interface LineFillEdges {
  top: number;
  bottom: number;
}

interface LineFillAdjacency {
  hasNextRangeKeys: ReadonlySet<string>;
  hasPreviousRangeKeys: ReadonlySet<string>;
}

interface ProseNodeLike {
  type: { name: string };
  attrs?: Record<string, unknown>;
  nodeSize: number;
  childCount: number;
  child: (index: number) => ProseNodeLike;
}

function isHardBreakNodeName(name: string): boolean {
  return name === 'hardbreak' || name === 'hard_break';
}

function isRangeIntersecting(left: BlockRange, right: BlockRange): boolean {
  return left.to > right.from && left.from < right.to;
}

function readCssPx(style: CSSStyleDeclaration, property: string, fallback = 0): number {
  const value = Number.parseFloat(style.getPropertyValue(property));
  return Number.isFinite(value) ? value : fallback;
}

function resolveBlockSelectionBleedXEnd(element: HTMLElement): number {
  const selectedElement = element.classList.contains('editor-block-selected')
    ? element
    : element.querySelector<HTMLElement>('.editor-block-selected') ?? element;
  return readCssPx(
    window.getComputedStyle(selectedElement),
    '--vlaina-block-selection-bleed-x-end',
    FALLBACK_BLOCK_SELECTION_BLEED_X_PX
  );
}

function resolveBlockSelectionBleedXStart(element: HTMLElement): number {
  const selectedElement = element.classList.contains('editor-block-selected')
    ? element
    : element.querySelector<HTMLElement>('.editor-block-selected') ?? element;
  return readCssPx(
    window.getComputedStyle(selectedElement),
    '--vlaina-block-selection-bleed-x-start',
    FALLBACK_BLOCK_SELECTION_BLEED_X_PX
  );
}

function resolveSelectedElementForBlockSelectionMetrics(element: HTMLElement): HTMLElement {
  return element.classList.contains('editor-block-selected')
    ? element
    : element.querySelector<HTMLElement>('.editor-block-selected') ?? element;
}

function resolveLineFillEdges(
  element: HTMLElement,
  hasPrevious: boolean,
  hasNext: boolean,
): LineFillEdges {
  const selectedElement = resolveSelectedElementForBlockSelectionMetrics(element);
  const style = window.getComputedStyle(selectedElement);
  const bleedY = readCssPx(
    style,
    '--vlaina-block-selection-bleed-y',
    FALLBACK_BLOCK_SELECTION_BLEED_Y_PX,
  );
  const gapY = readCssPx(
    style,
    '--vlaina-block-selection-gap-y',
    FALLBACK_BLOCK_SELECTION_GAP_Y_PX,
  );

  return {
    top: hasPrevious ? gapY : -bleedY,
    bottom: hasNext ? gapY : -bleedY,
  };
}

function resolveLineFillLeft(paragraph: HTMLElement, paragraphRect = paragraph.getBoundingClientRect()): number {
  return paragraphRect.left - resolveBlockSelectionBleedXStart(paragraph);
}

function resolveLineFillRight(
  view: EditorView,
  paragraph: HTMLElement,
  paragraphRect = paragraph.getBoundingClientRect(),
): number {
  const editorRect = view.dom.getBoundingClientRect();
  const selectedBlockRight = editorRect.width > 0 ? editorRect.right : paragraphRect.right;
  return Math.max(paragraphRect.right, selectedBlockRight) + resolveBlockSelectionBleedXEnd(paragraph);
}

function resolveLineFillViewportRect(view: EditorView): RectBounds | null {
  const scrollRoot = view.dom.closest<HTMLElement>('[data-note-scroll-root="true"]');
  const viewportElement = scrollRoot ?? view.dom.ownerDocument.documentElement;
  const rect = viewportElement.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return {
    left: rect.left - LINE_FILL_VIEWPORT_OVERSCAN_PX,
    top: rect.top - LINE_FILL_VIEWPORT_OVERSCAN_PX,
    right: rect.right + LINE_FILL_VIEWPORT_OVERSCAN_PX,
    bottom: rect.bottom + LINE_FILL_VIEWPORT_OVERSCAN_PX,
  };
}

function isRectNearViewport(rect: RectBounds, viewportRect: RectBounds | null): boolean {
  if (!viewportRect) return true;
  return isRangeIntersecting(
    { from: rect.top, to: rect.bottom },
    { from: viewportRect.top, to: viewportRect.bottom },
  );
}

function trimTrailingHardBreakForMeasure(view: EditorView, range: BlockRange): BlockRange | null {
  try {
    const nodeBefore = view.state.doc.resolve(range.to).nodeBefore;
    if (!nodeBefore || !isHardBreakNodeName(nodeBefore.type.name)) return range;

    const to = range.to - nodeBefore.nodeSize;
    return to > range.from ? { from: range.from, to } : null;
  } catch {
    return range;
  }
}

function appendSelectedParagraphLineRanges(
  paragraph: ProseNodeLike,
  paragraphFrom: number,
  selectedRange: BlockRange,
  ranges: BlockRange[],
): boolean {
  const paragraphTo = paragraphFrom + paragraph.nodeSize;
  if (!isRangeIntersecting(selectedRange, { from: paragraphFrom, to: paragraphTo })) {
    return true;
  }

  const contentFrom = paragraphFrom + 1;
  const contentTo = paragraphTo - 1;
  let lineFrom = contentFrom;
  let hasHardBreak = false;
  let childOffset = 0;

  for (
    let childIndex = 0;
    childIndex < paragraph.childCount && ranges.length < MAX_BLOCK_SELECTION_LINE_FILL_RANGES;
    childIndex += 1
  ) {
    const child = paragraph.child(childIndex);
    if (!isHardBreakNodeName(child.type.name)) {
      childOffset += child.nodeSize;
      continue;
    }

    hasHardBreak = true;
    const lineTo = contentFrom + childOffset + child.nodeSize;
    const lineRange = { from: lineFrom, to: lineTo };
    if (lineTo > lineFrom && isRangeIntersecting(selectedRange, lineRange)) {
      ranges.push(lineRange);
    }
    lineFrom = lineTo;
    childOffset += child.nodeSize;
  }

  if (
    ranges.length < MAX_BLOCK_SELECTION_LINE_FILL_RANGES &&
    hasHardBreak &&
    lineFrom < contentTo &&
    isRangeIntersecting(selectedRange, { from: lineFrom, to: contentTo })
  ) {
    ranges.push({ from: lineFrom, to: contentTo });
  }

  return ranges.length < MAX_BLOCK_SELECTION_LINE_FILL_RANGES;
}

function collectSelectedHardBreakLineRangesFromNode(
  node: ProseNodeLike,
  contentStart: number,
  selectedRanges: readonly BlockRange[],
  startRangeIndex: number,
  ranges: BlockRange[],
): number {
  let rangeIndex = startRangeIndex;
  let childOffset = 0;
  for (let index = 0; index < node.childCount; index += 1) {
    if (ranges.length >= MAX_BLOCK_SELECTION_LINE_FILL_RANGES) break;

    const child = node.child(index);
    const childFrom = contentStart + childOffset;
    const childTo = childFrom + child.nodeSize;
    childOffset += child.nodeSize;

    while (
      rangeIndex < selectedRanges.length &&
      selectedRanges[rangeIndex].to <= childFrom
    ) {
      rangeIndex += 1;
    }
    if (rangeIndex >= selectedRanges.length) break;
    if (childTo <= selectedRanges[rangeIndex].from) continue;

    if (child.type.name === 'paragraph') {
      for (
        let selectedIndex = rangeIndex;
        selectedIndex < selectedRanges.length &&
          selectedRanges[selectedIndex].from < childTo &&
          ranges.length < MAX_BLOCK_SELECTION_LINE_FILL_RANGES;
        selectedIndex += 1
      ) {
        const selectedRange = selectedRanges[selectedIndex];
        if (isRangeIntersecting(selectedRange, { from: childFrom, to: childTo })) {
          appendSelectedParagraphLineRanges(child, childFrom, selectedRange, ranges);
        }
      }
      continue;
    }

    if (
      child.childCount > 0 &&
      ranges.length < MAX_BLOCK_SELECTION_LINE_FILL_RANGES
    ) {
      rangeIndex = collectSelectedHardBreakLineRangesFromNode(
        child,
        childFrom + 1,
        selectedRanges,
        rangeIndex,
        ranges,
      );
    }
  }

  return rangeIndex;
}

export function collectSelectedHardBreakLineRanges(view: EditorView): BlockRange[] {
  const { selectedBlocks } = getBlockSelectionPluginState(view.state);
  if (selectedBlocks.length === 0) return [];
  if (isLargeBlockSelection(selectedBlocks)) return [];

  const ranges: BlockRange[] = [];
  const selectedRanges = normalizeBlockRanges(selectedBlocks);

  const docSize = view.state.doc.content.size;
  const clampedRanges = selectedRanges
    .map((range) => {
      const from = Math.max(0, Math.min(range.from, docSize));
      const to = Math.max(from, Math.min(range.to, docSize));
      return { from, to };
    })
    .filter((range) => range.to > range.from);

  collectSelectedHardBreakLineRangesFromNode(
    view.state.doc,
    0,
    clampedRanges,
    0,
    ranges,
  );

  return normalizeBlockRanges(ranges);
}

export function collectRangeRows(view: EditorView, range: BlockRange): RowRect[] {
  const measuredRange = trimTrailingHardBreakForMeasure(view, range);
  if (!measuredRange) return [];

  const domRange = view.dom.ownerDocument.createRange();
  try {
    const start = view.domAtPos(measuredRange.from);
    const end = view.domAtPos(measuredRange.to);
    domRange.setStart(start.node, start.offset);
    domRange.setEnd(end.node, end.offset);

    const rows: RowRect[] = [];
    const rects = domRange.getClientRects();
    if (rects.length > MAX_BLOCK_SELECTION_LINE_FILL_DOM_RECTS) {
      return [];
    }

    for (let index = 0; index < rects.length; index += 1) {
      const rect = rects.item?.(index) ?? rects[index];
      if (!rect) continue;
      if (rect.height <= 0) continue;
      const centerY = rect.top + rect.height / 2;
      const existing = rows.find((row) => (
        centerY >= row.top - ROW_MERGE_TOLERANCE_PX &&
        centerY <= row.bottom + ROW_MERGE_TOLERANCE_PX
      ));
      if (existing) {
        existing.top = Math.min(existing.top, rect.top);
        existing.right = Math.max(existing.right, rect.right);
        existing.bottom = Math.max(existing.bottom, rect.bottom);
      } else {
        if (rows.length >= MAX_BLOCK_SELECTION_LINE_FILL_ROWS_PER_RANGE) break;
        rows.push({ top: rect.top, right: rect.right, bottom: rect.bottom });
      }
    }
    return rows.sort((left, right) => left.top - right.top);
  } catch {
    return [];
  } finally {
    domRange.detach();
  }
}

function resolveParagraphElement(view: EditorView, range: BlockRange): HTMLElement | null {
  try {
    const domAtPos = view.domAtPos(range.from);
    const base = domAtPos.node instanceof HTMLElement ? domAtPos.node : domAtPos.node.parentElement;
    const paragraph = base?.closest('p') ?? null;
    return paragraph instanceof HTMLElement && view.dom.contains(paragraph) ? paragraph : null;
  } catch {
    return null;
  }
}

function appendLineFillElement(
  doc: Document,
  layer: HTMLElement,
  hostRect: DOMRect,
  fillStart: number,
  fillRight: number,
  top: number,
  bottom: number,
  edges: LineFillEdges,
): boolean {
  const paintTop = top + edges.top;
  const paintBottom = bottom - edges.bottom;
  if (fillRight - fillStart <= 0.5 || paintBottom - paintTop <= 0.5) return false;

  const fill = doc.createElement('div');
  fill.className = LINE_FILL_CLASS;
  fill.style.left = `${fillStart - hostRect.left}px`;
  fill.style.top = `${paintTop - hostRect.top}px`;
  fill.style.width = `${fillRight - fillStart}px`;
  fill.style.height = `${paintBottom - paintTop}px`;
  layer.appendChild(fill);
  return true;
}

function collectLineFillAdjacency(
  view: EditorView,
  selectedBlocks: readonly BlockRange[],
): LineFillAdjacency {
  const displayRanges = getDisplayBlockRangesForDecorations(view.state.doc, selectedBlocks);
  const hasNextRangeKeys = new Set<string>();
  const hasPreviousRangeKeys = new Set<string>();

  for (let index = 0; index < displayRanges.length - 1; index += 1) {
    const current = displayRanges[index];
    const next = displayRanges[index + 1];
    if (!current || !next || !areBlockSelectionDisplayRangesVisuallyAdjacent(view.state.doc, current, next)) {
      continue;
    }

    hasNextRangeKeys.add(getBlockRangeKey(current.from, current.to));
    hasPreviousRangeKeys.add(getBlockRangeKey(next.from, next.to));
  }

  return {
    hasNextRangeKeys,
    hasPreviousRangeKeys,
  };
}

function resolveImageFillAnchor(view: EditorView, image: HTMLElement): HTMLElement {
  const paragraph = image.closest('p');
  return paragraph instanceof HTMLElement && view.dom.contains(paragraph) ? paragraph : image;
}

function appendSelectedImageBlockLineFills(
  view: EditorView,
  doc: Document,
  layer: HTMLElement,
  hostRect: DOMRect,
  viewportRect: RectBounds | null,
  availableElements: number,
): number {
  if (availableElements <= 0) return 0;

  const images = Array.from(view.dom.querySelectorAll<HTMLElement>(SELECTED_IMAGE_BLOCK_SELECTOR));
  let createdFills = 0;

  for (const image of images) {
    if (createdFills >= availableElements) break;

    const anchor = resolveImageFillAnchor(view, image);
    const anchorRect = anchor.getBoundingClientRect();
    if (!isRectNearViewport(anchorRect, viewportRect)) continue;

    const imageRect = image.getBoundingClientRect();
    const rowTop = imageRect.height > 0 ? imageRect.top : anchorRect.top;
    const rowBottom = imageRect.height > 0 ? imageRect.bottom : anchorRect.bottom;
    const fillStart = anchorRect.left - resolveBlockSelectionBleedXStart(anchor);
    const fillRight = resolveLineFillRight(view, anchor, anchorRect);
    const edges = resolveLineFillEdges(anchor, false, false);

    if (appendLineFillElement(doc, layer, hostRect, fillStart, fillRight, rowTop, rowBottom, edges)) {
      createdFills += 1;
    }
  }

  return createdFills;
}

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
    if (selectedBlocks.length === 0 || isLargeBlockSelection(selectedBlocks)) {
      lastDoc = updatedView.state.doc;
      lastSelectedBlocks = selectedBlocks;
      lastSelectionKey = '';
      if (layer.childNodes.length > 0) {
        layer.replaceChildren();
      }
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
    const adjacency = collectLineFillAdjacency(updatedView, selectedBlocks);
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
      const rangeKey = getBlockRangeKey(range.from, range.to);
      const edges = resolveLineFillEdges(
        paragraph,
        adjacency.hasPreviousRangeKeys.has(rangeKey),
        adjacency.hasNextRangeKeys.has(rangeKey),
      );
      const rows = collectRangeRows(updatedView, range);
      for (const row of rows) {
        if (createdFills >= MAX_BLOCK_SELECTION_LINE_FILL_ELEMENTS) break;
        if (appendLineFillElement(doc, layer, hostRect, fillStart, fillRight, row.top, row.bottom, edges)) {
          createdFills += 1;
        }
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
