import type { EditorView } from '@milkdown/kit/prose/view';
import {
  NOTE_CONTENT_ROOT_SELECTOR,
  getScrollRoot,
} from './blankAreaDragTargetDom';
import { resolveTextLinePointerHit } from './blankAreaTextLineHit';

const CHAT_READABLE_SELECTION_TARGET_SELECTOR = [
  '[data-chat-selection-surface="true"]',
  '[data-message-item="true"]',
].join(', ');

export function isPointInSameEditorLayoutBlankArea(
  view: EditorView,
  target: HTMLElement,
  editorScrollRoot: HTMLElement | null,
  clientY: number,
): boolean {
  if (!editorScrollRoot || getScrollRoot(target) !== editorScrollRoot) return false;
  if (view.dom.contains(target)) return false;

  const contentRoot = view.dom.closest(NOTE_CONTENT_ROOT_SELECTOR);
  if (!(contentRoot instanceof HTMLElement)) return false;
  if (target === contentRoot || contentRoot.contains(target)) return false;

  const contentRect = contentRoot.getBoundingClientRect();
  if (contentRect.width <= 0 || contentRect.height <= 0) return false;

  const scrollRootRect = editorScrollRoot.getBoundingClientRect();
  const visibleTop = Math.max(contentRect.top, scrollRootRect.top);
  const visibleBottom = Math.min(contentRect.bottom, scrollRootRect.bottom);
  return clientY >= visibleTop && clientY <= visibleBottom;
}

export function isExternalChatReadableTextTarget(
  target: HTMLElement,
  clientX: number,
  clientY: number,
): boolean {
  const selectionSurface = target.closest('[data-chat-selection-surface="true"]');
  const messageItem = target.closest('[data-message-item="true"]');
  const readableRoot = selectionSurface instanceof HTMLElement
    ? selectionSurface
    : messageItem instanceof HTMLElement
      ? messageItem
      : null;
  if (!readableRoot || !target.closest(CHAT_READABLE_SELECTION_TARGET_SELECTOR)) return false;
  const hit = resolveTextLinePointerHit(readableRoot, clientX, clientY);
  return hit?.type === 'content' || hit?.type === 'measurement-limit';
}
