import { useCallback, type MouseEvent } from 'react';
import { focusComposerInput, isComposerFocusTarget } from '@/lib/ui/composerFocusRegistry';

const NON_FOCUSABLE_SELECTOR = [
  'textarea',
  'input',
  'select',
  'button',
  'a',
  'label',
  'summary',
  '[contenteditable="true"]',
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

function shouldFocusComposer(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (isComposerFocusTarget(target)) return false;
  if (target.closest('[data-message-item="true"]')) return false;
  if (target.closest(NON_FOCUSABLE_SELECTOR)) return false;
  if (target.closest(READABLE_CONTENT_SELECTOR)) return false;
  return true;
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
