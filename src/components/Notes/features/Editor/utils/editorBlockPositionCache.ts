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

function resolveDocumentTop(rect: DOMRect, scrollRoot: HTMLElement | null, scrollTop: number): number {
  if (!scrollRoot) {
    return rect.top;
  }

  return rect.top - scrollRoot.getBoundingClientRect().top + scrollTop;
}

function resolveDocumentBottom(rect: DOMRect, scrollRoot: HTMLElement | null, scrollTop: number): number {
  if (!scrollRoot) {
    return rect.bottom;
  }

  return rect.bottom - scrollRoot.getBoundingClientRect().top + scrollTop;
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
  const topLevelRanges = collectTopLevelBlockRanges(view.state.doc);
  const topLevelElements = Array.from(previewRoot.children).filter(
    (element): element is HTMLElement => element instanceof HTMLElement,
  );
  const blocks: EditorBlockPositionEntry[] = [];
  const headings: EditorHeadingPositionEntry[] = [];

  topLevelElements.forEach((element, index) => {
    const range = topLevelRanges[index];
    if (!range) {
      return;
    }

    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }

    const tagName = element.tagName.toUpperCase();
    const headingLevel = getHeadingLevelFromTagName(tagName);
    const headingText = headingLevel ? normalizeHeadingText(element.textContent ?? '') : null;
    const documentTop = resolveDocumentTop(rect, scrollRoot, scrollTop);
    const documentBottom = resolveDocumentBottom(rect, scrollRoot, scrollTop);
    const headingId = headingLevel
      ? createOutlineHeadingId(headings.length, headingLevel, headingText ?? '')
      : null;

    blocks.push({
      from: range.from,
      to: range.to,
      element,
      rect,
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
      from: range.from,
      to: range.to,
      element,
      top: documentTop,
      bottom: documentBottom,
    });
  });

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
    headings,
  };
}

function createSnapshot(view: EditorView): EditorBlockPositionSnapshot | null {
  const editorRoot = view.dom;
  if (!editorRoot.isConnected) {
    return null;
  }

  const previewRoot = resolveToolbarPreviewRoot(view);
  if (previewRoot) {
    return createPreviewSnapshot(view, previewRoot);
  }

  const scrollRoot = view.dom.closest('[data-note-scroll-root="true"]') as HTMLElement | null;
  const scrollLeft = scrollRoot?.scrollLeft ?? 0;
  const scrollTop = scrollRoot?.scrollTop ?? 0;
  const targets = collectSelectableBlockTargets(view);
  const blocks: EditorBlockPositionEntry[] = [];
  const headings: EditorHeadingPositionEntry[] = [];

  targets.forEach((target) => {
    const tagName = target.element.tagName.toUpperCase();
    const headingMatch = /^H([1-6])$/.exec(tagName);
    const headingLevel = headingMatch ? Number.parseInt(headingMatch[1], 10) : null;
    const headingText = headingLevel ? normalizeHeadingText(target.element.textContent ?? '') : null;
    const documentTop = resolveDocumentTop(target.rect, scrollRoot, scrollTop);
    const documentBottom = resolveDocumentBottom(target.rect, scrollRoot, scrollTop);
    const headingId = headingLevel
      ? createOutlineHeadingId(headings.length, headingLevel, headingText ?? '')
      : null;

    blocks.push({
      from: target.range.from,
      to: target.range.to,
      element: target.element,
      rect: target.rect,
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
    headings,
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

export function subscribeCurrentEditorBlockPositionSnapshot(
  listener: (snapshot: EditorBlockPositionSnapshot | null) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getCachedEditorBlockTargets(
  view: EditorView,
  ranges?: readonly { from: number; to: number }[],
): SelectableBlockTarget[] | null {
  const snapshot = currentSnapshot;
  if (!snapshot || snapshot.view !== view) {
    return null;
  }

  const filteredBlocks = ranges
    ? snapshot.blocks.filter((block) =>
        ranges.some((range) => range.from === block.from && range.to === block.to),
      )
    : snapshot.blocks;

  return filteredBlocks.map((block) => ({
    range: {
      from: block.from,
      to: block.to,
    },
    element: block.element,
    rect: block.rect,
  }));
}

export function getCachedEditorBlockTargetByPos(
  view: EditorView,
  blockPos: number,
): SelectableBlockTarget | null {
  const snapshot = currentSnapshot;
  if (!snapshot || snapshot.view !== view) {
    return null;
  }

  const range = resolveSelectableBlockRange(view.state.doc, blockPos);
  if (!range) {
    return null;
  }

  const block = snapshot.blocks.find((entry) => entry.from === range.from && entry.to === range.to);
  if (!block) {
    return null;
  }

  return {
    range,
    element: block.element,
    rect: block.rect,
  };
}

export function createCurrentEditorBlockPositionController(
  view: EditorView,
): EditorBlockPositionController {
  let frameId = 0;
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

  if (typeof MutationObserver !== 'undefined') {
    mutationObserver = new MutationObserver(() => {
      scheduleRefresh();
    });
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
    scheduleRefresh();
  };

  scrollRoot?.addEventListener('scroll', handleScroll, { passive: true });
  window.addEventListener('resize', scheduleRefresh);

  refresh();

  return {
    refresh,
    destroy() {
      destroyed = true;
      if (frameId !== 0) {
        cancelAnimationFrame(frameId);
        frameId = 0;
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
