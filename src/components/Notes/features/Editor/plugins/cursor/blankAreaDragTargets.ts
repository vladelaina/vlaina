import type { EditorView } from '@milkdown/kit/prose/view';
import { isClickBelowLastBlock } from './endBlankClickUtils';
import { type BlockDragStartZone } from './blockDragSession';

const SCROLL_ROOT_SELECTOR = '[data-note-scroll-root="true"]';
const NOTES_SIDEBAR_SCROLL_ROOT_SELECTOR = '[data-notes-sidebar-scroll-root="true"]';
const NOTES_SIDEBAR_BLANK_DRAG_ROOT_SELECTOR = '[data-notes-sidebar-blank-drag-root="true"]';
const COVER_REGION_SELECTOR = '[data-note-cover-region="true"]';
const NO_EDITOR_DRAG_BOX_SELECTOR = '[data-no-editor-drag-box="true"]';
const TRAILING_TEXT_SELECTION_GUTTER_PX = 48;
const TRAILING_TEXT_SELECTION_TEXT_OVERLAP_PX = 24;
const LEADING_TEXT_SELECTION_GUTTER_PX = 32;
const INTERACTIVE_SELECTOR = [
  'a',
  'button',
  'input',
  'textarea',
  'select',
  'summary',
  'label',
  '[role="button"]',
  '[contenteditable="false"]',
  NO_EDITOR_DRAG_BOX_SELECTOR,
].join(', ');
const TEXT_BLOCK_SURFACE_SELECTOR = [
  'p',
  'li',
  'blockquote',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
].join(', ');
const STRUCTURED_BLOCK_SELECTOR = [
  'table',
  'pre',
  '[data-type]',
  '[data-node-view-root]',
].join(', ');

interface TextLineRectLike {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}

interface TextSelectionGutterHit {
  edge: 'leading' | 'trailing';
}

type TextLinePointerHit =
  | { type: 'content' }
  | ({ type: 'gutter' } & TextSelectionGutterHit);

function getScrollRoot(element: HTMLElement | null): HTMLElement | null {
  if (!element) return null;
  return element.closest(SCROLL_ROOT_SELECTOR) as HTMLElement | null;
}

function isSidebarBlankStartTarget(target: HTMLElement): boolean {
  const sidebarScrollRoot = target.closest(NOTES_SIDEBAR_SCROLL_ROOT_SELECTOR) as HTMLElement | null;
  if (!sidebarScrollRoot) return false;
  return target === sidebarScrollRoot || !!target.closest(NOTES_SIDEBAR_BLANK_DRAG_ROOT_SELECTOR);
}

export function isIgnoredBlankAreaDragBoxTarget(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest(NO_EDITOR_DRAG_BOX_SELECTOR);
}

export function isPointInTrailingTextSelectionGutter(
  rect: TextLineRectLike,
  clientX: number,
  clientY: number,
  gutterPx = TRAILING_TEXT_SELECTION_GUTTER_PX,
): boolean {
  if (rect.width <= 0 || rect.height <= 0) return false;

  const verticalSlack = Math.max(2, Math.min(6, rect.height * 0.2));
  const isVerticallyAligned = clientY >= rect.top - verticalSlack && clientY <= rect.bottom + verticalSlack;
  if (!isVerticallyAligned) return false;

  const textOverlapPx = Math.min(TRAILING_TEXT_SELECTION_TEXT_OVERLAP_PX, Math.max(2, rect.width));
  return clientX >= rect.right - textOverlapPx && clientX <= rect.right + gutterPx;
}

function isPointInLeadingTextSelectionGutter(
  rect: TextLineRectLike,
  clientX: number,
  clientY: number,
  gutterPx = LEADING_TEXT_SELECTION_GUTTER_PX,
): boolean {
  if (rect.width <= 0 || rect.height <= 0) return false;

  const verticalSlack = Math.max(2, Math.min(6, rect.height * 0.2));
  const isVerticallyAligned = clientY >= rect.top - verticalSlack && clientY <= rect.bottom + verticalSlack;
  if (!isVerticallyAligned) return false;

  return clientX >= rect.left - gutterPx && clientX <= rect.left + 2;
}

function isPointInTextLineContent(rect: TextLineRectLike, clientX: number, clientY: number): boolean {
  if (rect.width <= 0 || rect.height <= 0) return false;

  const verticalSlack = Math.max(2, Math.min(6, rect.height * 0.2));
  return (
    clientY >= rect.top - verticalSlack &&
    clientY <= rect.bottom + verticalSlack &&
    clientX >= rect.left &&
    clientX <= rect.right
  );
}

function isIgnoredTextLineElement(element: Element): boolean {
  return Boolean(element.closest(INTERACTIVE_SELECTOR));
}

function resolveTextLinePointerHit(root: HTMLElement, clientX: number, clientY: number): TextLinePointerHit | null {
  const doc = root.ownerDocument;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.textContent?.trim()) return NodeFilter.FILTER_REJECT;
      const parent = node.parentElement;
      if (!parent || isIgnoredTextLineElement(parent)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const range = doc.createRange();
    range.selectNodeContents(node);
    const rects = Array.from(range.getClientRects());
    range.detach();

    for (const rect of rects) {
      if (isPointInTextLineContent(rect, clientX, clientY)) {
        return { type: 'content' };
      }
      if (isPointInTrailingTextSelectionGutter(rect, clientX, clientY)) {
        return { type: 'gutter', edge: 'trailing' };
      }
      if (isPointInLeadingTextSelectionGutter(rect, clientX, clientY)) {
        return { type: 'gutter', edge: 'leading' };
      }
    }
  }

  return null;
}

function resolveTextSelectionGutterHit(root: HTMLElement, clientX: number, clientY: number): TextSelectionGutterHit | null {
  const hit = resolveTextLinePointerHit(root, clientX, clientY);
  return hit?.type === 'gutter' ? { edge: hit.edge } : null;
}

function isTextBlockBlankSurfaceTarget(view: EditorView, target: HTMLElement): boolean {
  if (target === view.dom) return true;

  const textBlock = target.closest(TEXT_BLOCK_SURFACE_SELECTOR);
  if (!textBlock || !view.dom.contains(textBlock)) return false;

  const structuredBlock = target.closest(STRUCTURED_BLOCK_SELECTOR);
  return !structuredBlock || structuredBlock === textBlock;
}

export function resolveBlankAreaDragStartZone(view: EditorView, event: MouseEvent): BlockDragStartZone | null {
  if (!(event.target instanceof HTMLElement)) return null;
  const target = event.target;

  const editorScrollRoot = getScrollRoot(view.dom);
  const targetScrollRoot = getScrollRoot(target);
  const isSameEditorScrollRoot = !!editorScrollRoot && !!targetScrollRoot && editorScrollRoot === targetScrollRoot;
  const isSidebarBlankStart = isSidebarBlankStartTarget(target);
  if (!isSameEditorScrollRoot && !isSidebarBlankStart) return null;

  if (target.closest(COVER_REGION_SELECTOR)) return null;
  if (target.closest(INTERACTIVE_SELECTOR)) return null;

  if (view.dom.contains(target)) {
    const textLineHit = resolveTextLinePointerHit(view.dom, event.clientX, event.clientY);

    if (textLineHit) {
      return null;
    }
    if (target === view.dom && isClickBelowLastBlock(view.dom, event.clientY)) {
      return 'below-last-block';
    }
    if (target === view.dom && view.dom.childElementCount === 0) {
      return 'outside-editor';
    }
    if (isTextBlockBlankSurfaceTarget(view, target)) {
      return 'outside-editor';
    }
    return null;
  }

  const externalTextGutterHit = isSameEditorScrollRoot
    ? resolveTextSelectionGutterHit(view.dom, event.clientX, event.clientY)
    : null;
  if (externalTextGutterHit) {
    return null;
  }

  if (isSidebarBlankStart) {
    return 'outside-editor';
  }

  return 'outside-editor';
}
