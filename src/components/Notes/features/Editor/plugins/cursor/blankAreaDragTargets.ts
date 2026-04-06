import type { EditorView } from '@milkdown/kit/prose/view';
import { isClickBelowLastBlock } from './endBlankClickUtils';
import { type BlockDragStartZone } from './blockDragSession';

const SCROLL_ROOT_SELECTOR = '[data-note-scroll-root="true"]';
const NOTES_SIDEBAR_SCROLL_ROOT_SELECTOR = '[data-notes-sidebar-scroll-root="true"]';
const COVER_REGION_SELECTOR = '[data-note-cover-region="true"]';
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
  '[data-no-editor-drag-box="true"]',
].join(', ');

function getScrollRoot(element: HTMLElement | null): HTMLElement | null {
  if (!element) return null;
  return element.closest(SCROLL_ROOT_SELECTOR) as HTMLElement | null;
}

function isSidebarBlankStartTarget(target: HTMLElement): boolean {
  const sidebarScrollRoot = target.closest(NOTES_SIDEBAR_SCROLL_ROOT_SELECTOR) as HTMLElement | null;
  if (!sidebarScrollRoot) return false;
  return target === sidebarScrollRoot;
}

export function isIgnoredBlankAreaDragBoxTarget(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest('[data-no-editor-drag-box="true"]');
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
    if (target === view.dom && isClickBelowLastBlock(view.dom, event.clientY)) {
      return 'below-last-block';
    }
    return null;
  }

  if (isSidebarBlankStart) {
    return 'outside-editor';
  }

  return 'outside-editor';
}
