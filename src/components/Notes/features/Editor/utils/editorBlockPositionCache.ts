import type { EditorView } from '@milkdown/kit/prose/view';
import {
  collectSelectableBlockTargets,
  resolveSelectableBlockRange,
  type SelectableBlockTarget,
} from '../plugins/cursor/blockUnitResolver';
import {
  createOutlineHeadingId,
  getHeadingLevelFromTagName,
  normalizeHeadingText,
} from '../../Sidebar/Outline/outlineUtils';

export interface EditorBlockPositionEntry {
  from: number;
  to: number;
  element: HTMLElement;
  rect: DOMRect;
  documentLeft?: number;
  documentRight?: number;
  documentTop: number;
  documentBottom: number;
  tagName: string;
  headingLevel: number | null;
  headingId: string | null;
  headingText: string | null;
}

export interface EditorHeadingPositionEntry {
  id: string;
  level: number;
  text: string;
  from: number;
  to: number;
  element: HTMLElement;
  top: number;
  bottom: number;
}

export interface EditorBlockPositionSnapshot {
  version: number;
  view: EditorView;
  doc: EditorView['state']['doc'];
  editorRoot: HTMLElement;
  scrollRoot: HTMLElement | null;
  scrollLeft: number;
  scrollTop: number;
  blocks: EditorBlockPositionEntry[];
  blockIndex: Map<string, EditorBlockPositionEntry>;
  headings: EditorHeadingPositionEntry[];
}

interface EditorBlockPositionController {
  refresh: () => void;
  destroy: () => void;
}

let currentSnapshot: EditorBlockPositionSnapshot | null = null;
let currentVersion = 0;
const listeners = new Set<(snapshot: EditorBlockPositionSnapshot | null) => void>();
const TOOLBAR_PREVIEW_HIDDEN_ATTRIBUTE = 'data-toolbar-preview-hidden';
const TOOLBAR_PREVIEW_OVERLAY_CLASS = 'toolbar-applied-preview-overlay';
export const MAX_BLOCK_POSITION_SNAPSHOT_BLOCKS = 5000;
const TEXT_MUTATION_REFRESH_DELAY_MS = 120;

function getBlockRangeKey(from: number, to: number): string {
  return `${from}:${to}`;
}

function createBlockIndex(blocks: readonly EditorBlockPositionEntry[]): Map<string, EditorBlockPositionEntry> {
  return new Map(blocks.map((block) => [getBlockRangeKey(block.from, block.to), block]));
}

export function isEditorHiddenByToolbarPreview(view: Pick<EditorView, 'dom'>): boolean {
  return view.dom instanceof HTMLElement && view.dom.getAttribute(TOOLBAR_PREVIEW_HIDDEN_ATTRIBUTE) === 'true';
}

export function resolveToolbarPreviewRoot(view: Pick<EditorView, 'dom'>): HTMLElement | null {
  if (!isEditorHiddenByToolbarPreview(view)) {
    return null;
  }

  const previous = view.dom.previousElementSibling;
  if (previous instanceof HTMLElement && previous.classList.contains(TOOLBAR_PREVIEW_OVERLAY_CLASS)) {
    return previous;
  }

  const parent = view.dom.parentElement;
  return parent?.querySelector<HTMLElement>(`:scope > .${TOOLBAR_PREVIEW_OVERLAY_CLASS}`) ?? null;
}

function publishSnapshot(snapshot: EditorBlockPositionSnapshot | null): void {
  currentSnapshot = snapshot;
  listeners.forEach((listener) => {
    listener(snapshot);
  });
}

function resolveDocumentTop(rect: DOMRect, scrollRootTop: number | null, scrollTop: number): number {
  if (scrollRootTop === null) {
    return rect.top;
  }

  return rect.top - scrollRootTop + scrollTop;
}

function resolveDocumentBottom(rect: DOMRect, scrollRootTop: number | null, scrollTop: number): number {
  if (scrollRootTop === null) {
    return rect.bottom;
  }

  return rect.bottom - scrollRootTop + scrollTop;
}

function resolveDocumentLeft(rect: DOMRect, scrollRootLeft: number | null, scrollLeft: number): number {
  if (scrollRootLeft === null) {
    return rect.left;
  }

  return rect.left - scrollRootLeft + scrollLeft;
}

function resolveDocumentRight(rect: DOMRect, scrollRootLeft: number | null, scrollLeft: number): number {
  if (scrollRootLeft === null) {
    return rect.right;
  }

  return rect.right - scrollRootLeft + scrollLeft;
}

function collectTopLevelBlockRanges(doc: EditorView['state']['doc']): Array<{ from: number; to: number }> {
  const ranges: Array<{ from: number; to: number }> = [];
  doc.forEach((node, offset) => {
    ranges.push({
      from: offset,
      to: offset + node.nodeSize,
    });
  });
  return ranges;
}

export function isTooLargeForBlockPositionSnapshot(doc: EditorView['state']['doc']): boolean {
  const childCount = (doc as { childCount?: unknown }).childCount;
  return typeof childCount === 'number' && childCount > MAX_BLOCK_POSITION_SNAPSHOT_BLOCKS;
}

function createEmptySnapshot(view: EditorView): EditorBlockPositionSnapshot | null {
  const editorRoot = view.dom;
  if (!editorRoot.isConnected) {
    return null;
  }

  const scrollRoot = view.dom.closest('[data-note-scroll-root="true"]') as HTMLElement | null;
  currentVersion += 1;
  return {
    version: currentVersion,
    view,
    doc: view.state.doc,
    editorRoot,
    scrollRoot,
    scrollLeft: scrollRoot?.scrollLeft ?? 0,
    scrollTop: scrollRoot?.scrollTop ?? 0,
    blocks: [],
    blockIndex: new Map(),
    headings: [],
  };
}

function createPreviewSnapshot(
  view: EditorView,
  previewRoot: HTMLElement,
): EditorBlockPositionSnapshot | null {
  if (!previewRoot.isConnected) {
    return null;
  }

  const scrollRoot = view.dom.closest('[data-note-scroll-root="true"]') as HTMLElement | null;
  const scrollLeft = scrollRoot?.scrollLeft ?? 0;
  const scrollTop = scrollRoot?.scrollTop ?? 0;
  const scrollRootRect = scrollRoot?.getBoundingClientRect() ?? null;
  const scrollRootLeft = scrollRootRect?.left ?? null;
  const scrollRootTop = scrollRootRect?.top ?? null;
  const topLevelRanges = collectTopLevelBlockRanges(view.state.doc);
  const blocks: EditorBlockPositionEntry[] = [];
  const headings: EditorHeadingPositionEntry[] = [];

  for (
    let index = 0;
    index < previewRoot.children.length && index < topLevelRanges.length && blocks.length < MAX_BLOCK_POSITION_SNAPSHOT_BLOCKS;
    index += 1
  ) {
    const element = previewRoot.children.item(index);
    if (!(element instanceof HTMLElement)) {
      continue;
    }

    const range = topLevelRanges[index];
    if (!range) {
      continue;
    }

    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      continue;
    }

    const tagName = element.tagName.toUpperCase();
    const headingLevel = getHeadingLevelFromTagName(tagName);
    const headingText = headingLevel ? normalizeHeadingText(element.textContent ?? '') : null;
    const documentLeft = resolveDocumentLeft(rect, scrollRootLeft, scrollLeft);
    const documentRight = resolveDocumentRight(rect, scrollRootLeft, scrollLeft);
    const documentTop = resolveDocumentTop(rect, scrollRootTop, scrollTop);
    const documentBottom = resolveDocumentBottom(rect, scrollRootTop, scrollTop);
    const headingId = headingLevel
      ? createOutlineHeadingId(headings.length, headingLevel, headingText ?? '')
      : null;

    blocks.push({
      from: range.from,
      to: range.to,
      element,
      rect,
      documentLeft,
      documentRight,
      documentTop,
      documentBottom,
      tagName,
      headingLevel,
      headingId,
      headingText,
    });

    if (!headingLevel || !headingId || !headingText) {
      continue;
    }

    headings.push({
      id: headingId,
      level: headingLevel,
      text: headingText,
      from: range.from,
      to: range.to,
      element,
      top: documentTop,
      bottom: documentBottom,
    });
  }

  currentVersion += 1;
  return {
    version: currentVersion,
    view,
    doc: view.state.doc,
    editorRoot: view.dom,
    scrollRoot,
    scrollLeft,
    scrollTop,
    blocks,
    blockIndex: createBlockIndex(blocks),
    headings,
  };
}

function createSnapshot(view: EditorView): EditorBlockPositionSnapshot | null {
  const editorRoot = view.dom;
  if (!editorRoot.isConnected) {
    return null;
  }

  if (isTooLargeForBlockPositionSnapshot(view.state.doc)) {
    return createEmptySnapshot(view);
  }

  const previewRoot = resolveToolbarPreviewRoot(view);
  if (previewRoot) {
    return createPreviewSnapshot(view, previewRoot);
  }

  const scrollRoot = view.dom.closest('[data-note-scroll-root="true"]') as HTMLElement | null;
  const scrollLeft = scrollRoot?.scrollLeft ?? 0;
  const scrollTop = scrollRoot?.scrollTop ?? 0;
  const scrollRootRect = scrollRoot?.getBoundingClientRect() ?? null;
  const scrollRootLeft = scrollRootRect?.left ?? null;
  const scrollRootTop = scrollRootRect?.top ?? null;
  const targets = collectSelectableBlockTargets(view);
  const blocks: EditorBlockPositionEntry[] = [];
  const headings: EditorHeadingPositionEntry[] = [];

  targets.forEach((target) => {
    const tagName = target.element.tagName.toUpperCase();
    const headingMatch = /^H([1-6])$/.exec(tagName);
    const headingLevel = headingMatch ? Number.parseInt(headingMatch[1], 10) : null;
    const headingText = headingLevel ? normalizeHeadingText(target.element.textContent ?? '') : null;
    const documentLeft = resolveDocumentLeft(target.rect, scrollRootLeft, scrollLeft);
    const documentRight = resolveDocumentRight(target.rect, scrollRootLeft, scrollLeft);
    const documentTop = resolveDocumentTop(target.rect, scrollRootTop, scrollTop);
    const documentBottom = resolveDocumentBottom(target.rect, scrollRootTop, scrollTop);
    const headingId = headingLevel
      ? createOutlineHeadingId(headings.length, headingLevel, headingText ?? '')
      : null;

    blocks.push({
      from: target.range.from,
      to: target.range.to,
      element: target.element,
      rect: target.rect,
      documentLeft,
      documentRight,
      documentTop,
      documentBottom,
      tagName,
      headingLevel,
      headingId,
      headingText,
    });

    if (!headingLevel || !headingId || !headingText) {
      return;
    }

    headings.push({
      id: headingId,
      level: headingLevel,
      text: headingText,
      from: target.range.from,
      to: target.range.to,
      element: target.element,
      top: documentTop,
      bottom: documentBottom,
    });
  });

  currentVersion += 1;
  return {
    version: currentVersion,
    view,
    doc: view.state.doc,
    editorRoot,
    scrollRoot,
    scrollLeft,
    scrollTop,
    blocks,
    blockIndex: createBlockIndex(blocks),
    headings,
  };
}

function resolveViewportRectFromDocumentPosition(
  block: EditorBlockPositionEntry,
  scrollRootRect: DOMRect | null,
  scrollLeft: number,
  scrollTop: number,
): DOMRect {
  if (!scrollRootRect || block.documentLeft === undefined || block.documentRight === undefined) {
    return block.rect;
  }

  const left = block.documentLeft + scrollRootRect.left - scrollLeft;
  const right = block.documentRight + scrollRootRect.left - scrollLeft;
  const top = block.documentTop + scrollRootRect.top - scrollTop;
  const bottom = block.documentBottom + scrollRootRect.top - scrollTop;
  return {
    bottom,
    height: bottom - top,
    left,
    right,
    top,
    width: right - left,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

function createScrollAdjustedSnapshot(
  snapshot: EditorBlockPositionSnapshot,
  scrollLeft: number,
  scrollTop: number,
): EditorBlockPositionSnapshot {
  currentVersion += 1;

  return {
    ...snapshot,
    version: currentVersion,
    scrollLeft,
    scrollTop,
  };
}

export function setCurrentEditorBlockPositionSnapshot(
  snapshot: EditorBlockPositionSnapshot | null,
): void {
  publishSnapshot(snapshot);
}

export function clearCurrentEditorBlockPositionSnapshot(): void {
  publishSnapshot(null);
}

export function getCurrentEditorBlockPositionSnapshot(): EditorBlockPositionSnapshot | null {
  return currentSnapshot;
}

export function refreshCurrentEditorBlockPositionSnapshot(
  view: EditorView,
): EditorBlockPositionSnapshot | null {
  let snapshot: EditorBlockPositionSnapshot | null = null;
  try {
    snapshot = createSnapshot(view);
  } catch {
    snapshot = null;
  }
  publishSnapshot(snapshot);
  return snapshot;
}

export function subscribeCurrentEditorBlockPositionSnapshot(
  listener: (snapshot: EditorBlockPositionSnapshot | null) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function isFreshSnapshotForView(
  snapshot: EditorBlockPositionSnapshot,
  view: EditorView,
): boolean {
  const scrollRoot = view.dom.closest('[data-note-scroll-root="true"]') as HTMLElement | null;
  return snapshot.view === view
    && snapshot.doc === view.state.doc
    && snapshot.editorRoot === view.dom
    && snapshot.scrollRoot === scrollRoot
    && snapshot.scrollLeft === (scrollRoot?.scrollLeft ?? 0)
    && snapshot.scrollTop === (scrollRoot?.scrollTop ?? 0);
}

function getSnapshotScrollRootRect(snapshot: EditorBlockPositionSnapshot): DOMRect | null {
  return snapshot.scrollRoot?.getBoundingClientRect() ?? null;
}

function mapSnapshotBlockToTarget(
  block: EditorBlockPositionEntry,
  snapshot: EditorBlockPositionSnapshot,
  scrollRootRect: DOMRect | null,
): SelectableBlockTarget {
  return {
    range: {
      from: block.from,
      to: block.to,
    },
    element: block.element,
    rect: resolveViewportRectFromDocumentPosition(
      block,
      scrollRootRect,
      snapshot.scrollLeft,
      snapshot.scrollTop,
    ),
  };
}

function findFirstBlockStartingAfter(
  blocks: readonly EditorBlockPositionEntry[],
  documentY: number,
): number {
  let low = 0;
  let high = blocks.length;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (blocks[mid].documentTop <= documentY) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return low;
}

export function getCachedEditorBlockTargets(
  view: EditorView,
  ranges?: readonly { from: number; to: number }[],
): SelectableBlockTarget[] | null {
  const snapshot = currentSnapshot;
  if (!snapshot || !isFreshSnapshotForView(snapshot, view)) {
    return null;
  }

  const filteredBlocks = ranges
    ? ranges
        .map((range) => snapshot.blockIndex.get(getBlockRangeKey(range.from, range.to)))
        .filter((block): block is EditorBlockPositionEntry => Boolean(block))
    : snapshot.blocks;

  const scrollRootRect = getSnapshotScrollRootRect(snapshot);
  return filteredBlocks.map((block) => mapSnapshotBlockToTarget(block, snapshot, scrollRootRect));
}

export function getFreshCachedEditorBlockTargets(
  view: EditorView,
  scrollRoot: HTMLElement | null,
): SelectableBlockTarget[] | null {
  const snapshot = currentSnapshot;
  if (
    !snapshot
    || !isFreshSnapshotForView(snapshot, view)
    || snapshot.scrollRoot !== scrollRoot
  ) {
    return null;
  }

  const scrollRootRect = getSnapshotScrollRootRect(snapshot);
  return snapshot.blocks.map((block) => mapSnapshotBlockToTarget(block, snapshot, scrollRootRect));
}

export function getCachedEditorBlockTargetByPos(
  view: EditorView,
  blockPos: number,
): SelectableBlockTarget | null {
  const snapshot = currentSnapshot;
  if (!snapshot || !isFreshSnapshotForView(snapshot, view)) {
    return null;
  }

  const range = resolveSelectableBlockRange(view.state.doc, blockPos);
  if (!range) {
    return null;
  }

  const block = snapshot.blockIndex.get(getBlockRangeKey(range.from, range.to));
  if (!block) {
    return null;
  }

  return {
    range,
    element: block.element,
    rect: resolveViewportRectFromDocumentPosition(
      block,
      getSnapshotScrollRootRect(snapshot),
      snapshot.scrollLeft,
      snapshot.scrollTop,
    ),
  };
}

export function getCachedEditorBlockTargetNearY(
  view: EditorView,
  clientY: number,
  predicate?: (block: EditorBlockPositionEntry) => boolean,
): SelectableBlockTarget | null {
  const snapshot = currentSnapshot;
  if (!snapshot || !isFreshSnapshotForView(snapshot, view) || snapshot.blocks.length === 0) {
    return null;
  }

  const scrollRootRect = getSnapshotScrollRootRect(snapshot);
  const documentY = scrollRootRect
    ? clientY - scrollRootRect.top + snapshot.scrollTop
    : clientY;
  const firstAfterIndex = findFirstBlockStartingAfter(snapshot.blocks, documentY);
  let directStartIndex = Math.max(0, firstAfterIndex - 1);
  while (
    directStartIndex > 0
    && snapshot.blocks[directStartIndex - 1]?.documentBottom >= documentY
  ) {
    directStartIndex -= 1;
  }

  for (let index = directStartIndex; index < snapshot.blocks.length; index += 1) {
    const block = snapshot.blocks[index];
    if (block.documentTop > documentY) break;
    if (block.documentBottom < documentY) continue;
    if (predicate && !predicate(block)) continue;
    return mapSnapshotBlockToTarget(block, snapshot, scrollRootRect);
  }

  let previous: EditorBlockPositionEntry | null = null;
  for (let index = firstAfterIndex - 1; index >= 0; index -= 1) {
    const block = snapshot.blocks[index];
    if (predicate && !predicate(block)) continue;
    previous = block;
    break;
  }

  let next: EditorBlockPositionEntry | null = null;
  for (let index = firstAfterIndex; index < snapshot.blocks.length; index += 1) {
    const block = snapshot.blocks[index];
    if (predicate && !predicate(block)) continue;
    next = block;
    break;
  }

  const previousDistance = previous
    ? Math.abs(documentY - (previous.documentTop + (previous.documentBottom - previous.documentTop) / 2))
    : Number.POSITIVE_INFINITY;
  const nextDistance = next
    ? Math.abs(documentY - (next.documentTop + (next.documentBottom - next.documentTop) / 2))
    : Number.POSITIVE_INFINITY;
  const nearest = previousDistance <= nextDistance ? previous : next;
  return nearest ? mapSnapshotBlockToTarget(nearest, snapshot, scrollRootRect) : null;
}

export function getCachedEditorBlockTargetsNearY(
  view: EditorView,
  clientY: number,
  isNearRect: (rect: Pick<DOMRect, 'top' | 'bottom' | 'height'>, clientY: number) => boolean,
  predicate?: (block: EditorBlockPositionEntry) => boolean,
): SelectableBlockTarget[] | null {
  const snapshot = currentSnapshot;
  if (!snapshot || !isFreshSnapshotForView(snapshot, view) || snapshot.blocks.length === 0) {
    return null;
  }

  const scrollRootRect = getSnapshotScrollRootRect(snapshot);
  const documentY = scrollRootRect
    ? clientY - scrollRootRect.top + snapshot.scrollTop
    : clientY;
  const firstAfterIndex = findFirstBlockStartingAfter(snapshot.blocks, documentY);
  let startIndex = Math.max(0, firstAfterIndex - 1);
  while (startIndex > 0) {
    const previous = snapshot.blocks[startIndex - 1];
    const rect = resolveViewportRectFromDocumentPosition(
      previous,
      scrollRootRect,
      snapshot.scrollLeft,
      snapshot.scrollTop,
    );
    if (!isNearRect(rect, clientY)) break;
    startIndex -= 1;
  }

  const targets: SelectableBlockTarget[] = [];
  for (let index = startIndex; index < snapshot.blocks.length; index += 1) {
    const block = snapshot.blocks[index];
    const rect = resolveViewportRectFromDocumentPosition(
      block,
      scrollRootRect,
      snapshot.scrollLeft,
      snapshot.scrollTop,
    );
    if (!isNearRect(rect, clientY)) {
      if (block.documentTop > documentY) break;
      continue;
    }
    if (predicate && !predicate(block)) continue;
    targets.push({
      range: {
        from: block.from,
        to: block.to,
      },
      element: block.element,
      rect,
    });
  }
  return targets;
}

export function createCurrentEditorBlockPositionController(
  view: EditorView,
): EditorBlockPositionController {
  let frameId = 0;
  let textMutationTimerId = 0;
  let destroyed = false;
  let mutationObserver: MutationObserver | null = null;
  let resizeObserver: ResizeObserver | null = null;
  const scrollRoot = view.dom.closest('[data-note-scroll-root="true"]') as HTMLElement | null;

  const refresh = () => {
    if (destroyed) {
      return;
    }

    const snapshot = createSnapshot(view);
    publishSnapshot(snapshot);
  };

  const scheduleRefresh = () => {
    if (destroyed || frameId !== 0) {
      return;
    }

    frameId = requestAnimationFrame(() => {
      frameId = 0;
      refresh();
    });
  };

  const scheduleTextMutationRefresh = () => {
    if (destroyed || textMutationTimerId !== 0) {
      return;
    }

    textMutationTimerId = window.setTimeout(() => {
      textMutationTimerId = 0;
      scheduleRefresh();
    }, TEXT_MUTATION_REFRESH_DELAY_MS);
  };

  const scheduleMutationRefresh = (records: MutationRecord[]) => {
    const onlyTextMutations = records.length > 0 && records.every((record) => record.type === 'characterData');
    if (onlyTextMutations) {
      scheduleTextMutationRefresh();
      return;
    }

    if (textMutationTimerId !== 0) {
      window.clearTimeout(textMutationTimerId);
      textMutationTimerId = 0;
    }
    scheduleRefresh();
  };

  if (typeof MutationObserver !== 'undefined') {
    mutationObserver = new MutationObserver(scheduleMutationRefresh);
    mutationObserver.observe(view.dom, {
      attributes: true,
      attributeFilter: [TOOLBAR_PREVIEW_HIDDEN_ATTRIBUTE],
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      scheduleRefresh();
    });
    resizeObserver.observe(view.dom);
    if (scrollRoot && scrollRoot !== view.dom) {
      resizeObserver.observe(scrollRoot);
    }
  }

  const handleScroll = () => {
    if (destroyed || frameId !== 0) {
      return;
    }

    frameId = requestAnimationFrame(() => {
      frameId = 0;
      const snapshot = currentSnapshot;
      if (
        snapshot
        && snapshot.view === view
        && snapshot.doc === view.state.doc
        && snapshot.scrollRoot === scrollRoot
      ) {
        publishSnapshot(createScrollAdjustedSnapshot(
          snapshot,
          scrollRoot?.scrollLeft ?? 0,
          scrollRoot?.scrollTop ?? 0,
        ));
        return;
      }

      refresh();
    });
  };

  scrollRoot?.addEventListener('scroll', handleScroll, { passive: true });
  window.addEventListener('resize', scheduleRefresh);

  publishSnapshot(createEmptySnapshot(view));
  if (!isTooLargeForBlockPositionSnapshot(view.state.doc)) {
    scheduleRefresh();
  }

  return {
    refresh,
    destroy() {
      destroyed = true;
      if (frameId !== 0) {
        cancelAnimationFrame(frameId);
        frameId = 0;
      }
      if (textMutationTimerId !== 0) {
        window.clearTimeout(textMutationTimerId);
        textMutationTimerId = 0;
      }
      mutationObserver?.disconnect();
      resizeObserver?.disconnect();
      scrollRoot?.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', scheduleRefresh);
      if (currentSnapshot?.view === view) {
        publishSnapshot(null);
      }
    },
  };
}
