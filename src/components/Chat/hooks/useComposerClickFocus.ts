import { useCallback, type MouseEvent } from 'react';
import { focusComposerInput, isComposerFocusTarget } from '@/lib/ui/composerFocusRegistry';
import { isEditableShortcutTarget } from '@/lib/shortcuts/editableGuards';

const NON_FOCUSABLE_SELECTOR = [
  'button',
  'a',
  'label',
  'summary',
  '[role="button"]',
  '[data-no-focus-input="true"]'
].join(', ');

const READABLE_CONTENT_SELECTOR = [
  'p',
  'li',
  'pre',
  'code',
  'blockquote',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'table',
  'td',
  'th'
].join(', ');
export const MAX_CHAT_READABLE_TEXT_HIT_CHARS = 100_000;
export const MAX_CHAT_READABLE_TEXT_HIT_NODES = 512;
export const MAX_CHAT_READABLE_TEXT_HIT_RECTS = 1024;

interface ReadableTextPointer {
  clientX: number;
  clientY: number;
}

function getClosestElement(target: EventTarget | null, selector: string): Element | null {
  if (target instanceof Element) {
    return target.closest(selector);
  }
  if (target instanceof Node && target.parentElement) {
    return target.parentElement.closest(selector);
  }
  return null;
}

function shouldFocusComposer(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (isComposerFocusTarget(target)) return false;
  if (isEditableShortcutTarget(target)) return false;
  if (getClosestElement(target, NON_FOCUSABLE_SELECTOR)) return false;
  return true;
}

export function isPointInsideReadableText(element: Element, event: ReadableTextPointer): boolean {
  if ((element.textContent?.length ?? 0) > MAX_CHAT_READABLE_TEXT_HIT_CHARS) {
    return true;
  }

  const doc = element.ownerDocument;
  const walker = doc.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let textNode = walker.nextNode();
  let sawText = false;
  let sawRect = false;
  let measuredTextNodes = 0;
  let measuredRects = 0;

  while (textNode) {
    if (textNode.textContent?.trim()) {
      sawText = true;
      measuredTextNodes += 1;
      if (measuredTextNodes > MAX_CHAT_READABLE_TEXT_HIT_NODES) {
        return true;
      }

      const range = doc.createRange();
      try {
        range.selectNodeContents(textNode);
        const rects = range.getClientRects();

        if (rects.length > 0) {
          sawRect = true;
        }
        for (let index = 0; index < rects.length; index += 1) {
          measuredRects += 1;
          if (measuredRects > MAX_CHAT_READABLE_TEXT_HIT_RECTS) {
            return true;
          }

          const rect = rects[index];
          if (!rect) continue;
          if (
            event.clientX >= rect.left &&
            event.clientX <= rect.right &&
            event.clientY >= rect.top &&
            event.clientY <= rect.bottom
          ) {
            return true;
          }
        }
      } finally {
        range.detach();
      }
    }
    textNode = walker.nextNode();
  }

  return (sawText || !!element.textContent?.trim()) && !sawRect;
}

function isScrollbarTrackHit(target: EventTarget | null, event: MouseEvent): boolean {
  if (!(target instanceof Element)) return false;
  const scrollable = target.closest('[data-chat-scrollable="true"]') as HTMLElement | null;
  if (!scrollable) return false;

  const rect = scrollable.getBoundingClientRect();
  const verticalScrollbarWidth = scrollable.offsetWidth - scrollable.clientWidth;
  if (
    verticalScrollbarWidth > 0 &&
    event.clientX >= rect.right - verticalScrollbarWidth &&
    event.clientX <= rect.right
  ) {
    return true;
  }

  const horizontalScrollbarHeight = scrollable.offsetHeight - scrollable.clientHeight;
  if (
    horizontalScrollbarHeight > 0 &&
    event.clientY >= rect.bottom - horizontalScrollbarHeight &&
    event.clientY <= rect.bottom
  ) {
    return true;
  }

  return false;
}

interface UseComposerClickFocusParams {
  requestFocusFallback: () => void;
}

export function useComposerClickFocus({ requestFocusFallback }: UseComposerClickFocusParams) {
  return useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    if (!shouldFocusComposer(event.target)) {
      return;
    }
    const readableContent = getClosestElement(event.target, READABLE_CONTENT_SELECTOR);
    if (readableContent) {
      if (!readableContent.closest('[data-chat-selection-surface="true"]')) {
        return;
      }
      if (isPointInsideReadableText(readableContent, event)) {
        return;
      }
    }
    if (isScrollbarTrackHit(event.target, event)) {
      return;
    }

    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) {
      return;
    }

    event.preventDefault();
    if (!focusComposerInput()) {
      requestFocusFallback();
    }
  }, [requestFocusFallback]);
}
