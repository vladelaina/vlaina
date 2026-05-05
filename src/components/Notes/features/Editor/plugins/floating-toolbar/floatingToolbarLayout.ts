import type { EditorView } from '@milkdown/kit/prose/view';
import { toContainerPosition } from './floatingToolbarDom';
import type { FloatingToolbarState } from './types';

export interface ContentLayoutContext {
  contentRoot: HTMLElement | null;
  contentElement: HTMLElement;
  container: HTMLElement | null;
  containerRect: DOMRect | null;
  contentRect: DOMRect;
  paddingLeft: number;
  paddingRight: number;
  viewportBounds: {
    left: number;
    right: number;
  };
  containerBounds: {
    left: number;
    right: number;
  } | null;
}

export function getContentLayoutContext(
  view: EditorView,
  container: HTMLElement | null
): ContentLayoutContext {
  const contentRoot = view.dom.closest('[data-note-content-root="true"]') as HTMLElement | null;
  const contentElement = contentRoot ?? view.dom;
  const contentRect = contentElement.getBoundingClientRect();
  const containerRect = container?.getBoundingClientRect() ?? null;
  const contentStyles = contentRoot ? window.getComputedStyle(contentRoot) : null;
  const paddingLeft = contentStyles ? Number.parseFloat(contentStyles.paddingLeft || '0') : 0;
  const paddingRight = contentStyles ? Number.parseFloat(contentStyles.paddingRight || '0') : 0;

  return {
    contentRoot,
    contentElement,
    container,
    containerRect,
    contentRect,
    paddingLeft,
    paddingRight,
    viewportBounds: {
      left: contentRect.left + paddingLeft,
      right: contentRect.right - paddingRight,
    },
    containerBounds: containerRect
      ? {
          left: contentRect.left - containerRect.left + paddingLeft,
          right: contentRect.right - containerRect.left - paddingRight,
        }
      : null,
  };
}

export function getAiReviewAnchorX(layout: ContentLayoutContext): number {
  return layout.viewportBounds.left;
}

export function getAiReviewPanelWidth(layout: ContentLayoutContext): number {
  return Math.max(0, layout.viewportBounds.right - layout.viewportBounds.left);
}

export function resolveToolbarViewportPosition(args: {
  aiPosition: { x: number; y: number; placement: 'top' | 'bottom' };
  layout: ContentLayoutContext;
  pluginState: FloatingToolbarState;
  selectionPosition: { x: number; y: number; placement: 'top' | 'bottom' };
}): { x: number; y: number; placement: 'top' | 'bottom' } {
  const { aiPosition, layout, pluginState, selectionPosition } = args;

  if (pluginState.dragPosition && pluginState.subMenu === 'aiReview') {
    return {
      x: pluginState.dragPosition.x,
      y: pluginState.dragPosition.y,
      placement: 'bottom',
    };
  }

  if (pluginState.subMenu === 'aiReview') {
    return {
      y: selectionPosition.placement === 'top' ? selectionPosition.y : aiPosition.y,
      placement: selectionPosition.placement,
      x: getAiReviewAnchorX(layout),
    };
  }

  if (pluginState.subMenu === 'ai') {
    return selectionPosition;
  }

  return selectionPosition;
}

export function resolveToolbarContainerPosition(
  pluginState: FloatingToolbarState,
  nextPosition: { x: number; y: number; placement: 'top' | 'bottom' },
  container: HTMLElement | null
): { x: number; y: number } {
  if (pluginState.dragPosition && pluginState.subMenu === 'aiReview') {
    return {
      x: pluginState.dragPosition.x,
      y: pluginState.dragPosition.y,
    };
  }

  return toContainerPosition(nextPosition, container);
}
