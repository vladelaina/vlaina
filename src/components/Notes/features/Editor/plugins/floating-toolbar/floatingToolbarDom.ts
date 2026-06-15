import { translate } from '@/lib/i18n';
import { themeDomStyleTokens } from '@/styles/themeTokens';

const SCROLL_ROOT_SELECTOR = '[data-note-scroll-root="true"]';
const TOOLBAR_ROOT_SELECTOR = '[data-note-toolbar-root="true"]';
export const TABLE_RESIZE_TOOLBAR_SUPPRESS_ATTR = 'data-table-resize-toolbar-suppress';

export function isFloatingToolbarSuppressed(): boolean {
  if (typeof document === 'undefined') {
    return false;
  }

  return (
    document.documentElement.hasAttribute(TABLE_RESIZE_TOOLBAR_SUPPRESS_ATTR) ||
    document.body.hasAttribute(TABLE_RESIZE_TOOLBAR_SUPPRESS_ATTR)
  );
}

export function getCurrentBlockElement(view: {
  state: { selection: { $from: { pos: number } } };
  domAtPos: (pos: number) => { node: Node };
}): HTMLElement | null {
  return getBlockElementAtPos(view, view.state.selection.$from.pos);
}

export function getBlockElementAtPos(view: {
  domAtPos: (pos: number) => { node: Node };
}, pos: number): HTMLElement | null {
  try {
    const domAtPos = view.domAtPos(pos);
    let node = domAtPos.node as Node;
    if (node.nodeType === Node.TEXT_NODE) {
      node = node.parentNode as Node;
    }

    let element = node as HTMLElement;
    while (element && element.parentElement) {
      const tagName = element.tagName?.toUpperCase();
      if (tagName === 'P' || tagName === 'PRE' || (tagName && /^H[1-6]$/.test(tagName))) {
        return element;
      }

      if (element.classList?.contains('milkdown') || element.classList?.contains('editor')) {
        break;
      }

      element = element.parentElement;
    }

    return null;
  } catch {
    return null;
  }
}

export function getScrollRoot(view: { dom: HTMLElement }): HTMLElement | null {
  return view.dom.closest(SCROLL_ROOT_SELECTOR) as HTMLElement | null;
}

export function getToolbarRoot(view: { dom: HTMLElement }): HTMLElement | null {
  return view.dom.closest(TOOLBAR_ROOT_SELECTOR) as HTMLElement | null;
}

export function toContainerPosition(
  position: { x: number; y: number },
  container: HTMLElement | null
): { x: number; y: number } {
  if (!container) {
    return position;
  }

  const containerRect = container.getBoundingClientRect();
  return {
    x: position.x - containerRect.left,
    y: position.y - containerRect.top,
  };
}

export function clampToolbarX(
  x: number,
  container: HTMLElement | null,
  isAiMode: boolean,
  toolbarElement: HTMLElement,
  contentBounds?: { left: number; right: number } | null,
  fallbackToolbarWidth?: number | null
): {
  clampedX: number;
  toolbarWidth: number;
  minX: number;
  maxX: number;
} {
  if (!container) {
    return {
      clampedX: x,
      toolbarWidth: toolbarElement.offsetWidth || fallbackToolbarWidth || 0,
      minX: Number.NEGATIVE_INFINITY,
      maxX: Number.POSITIVE_INFINITY,
    };
  }

  const margin = themeDomStyleTokens.editorPopupHorizontalMarginPx;
  const minX = contentBounds
    ? Math.max(margin, contentBounds.left + margin)
    : margin;
  const maxX = contentBounds
    ? Math.min(container.clientWidth - margin, contentBounds.right - margin)
    : container.clientWidth - margin;
  const contentWidth = contentBounds ? Math.max(0, contentBounds.right - contentBounds.left) : null;
  const toolbarBodyNode = toolbarElement.querySelector('.floating-toolbar-inner');
  const toolbarBody = toolbarBodyNode instanceof HTMLElement ? toolbarBodyNode : null;
  const toolbarWidth =
    toolbarBody?.offsetWidth ||
    toolbarElement.offsetWidth ||
    fallbackToolbarWidth ||
    (!isAiMode && contentWidth !== null ? contentWidth : 0);

  if (isAiMode) {
    return {
      clampedX: Math.min(x, Math.max(minX, maxX - toolbarWidth)),
      toolbarWidth,
      minX,
      maxX,
    };
  }

  if (contentBounds && contentWidth !== null && toolbarWidth >= contentWidth) {
    return {
      clampedX: contentBounds.left + toolbarWidth / 2,
      toolbarWidth,
      minX,
      maxX,
    };
  }

  const halfWidth = toolbarWidth / 2;
  return {
    clampedX: Math.max(minX + halfWidth, Math.min(x, maxX - halfWidth)),
    toolbarWidth,
    minX,
    maxX,
  };
}

export function correctToolbarYToViewportBounds(
  toolbarElement: HTMLElement,
  y: number,
  bounds: { top: number; bottom: number },
): number {
  const margin = themeDomStyleTokens.editorPopupHorizontalMarginPx;
  const minTop = bounds.top + margin;
  const maxBottom = bounds.bottom - margin;
  const toolbarBodyNode = toolbarElement.querySelector('.floating-toolbar-inner');
  const toolbarBody = toolbarBodyNode instanceof HTMLElement ? toolbarBodyNode : toolbarElement;
  const toolbarRect = toolbarBody.getBoundingClientRect();

  let correctedY = y;
  if (toolbarRect.top < minTop) {
    correctedY += minTop - toolbarRect.top;
  } else if (toolbarRect.bottom > maxBottom) {
    correctedY -= toolbarRect.bottom - maxBottom;
  }

  if (correctedY !== y) {
    toolbarElement.style.top = `${correctedY}px`;
  }

  return correctedY;
}

export function createToolbarElement(): HTMLElement {
  const toolbar = document.createElement('div');
  toolbar.className = 'floating-toolbar hidden';
  toolbar.setAttribute('role', 'toolbar');
  toolbar.setAttribute('aria-label', translate('editor.textFormatting'));
  toolbar.setAttribute('data-no-editor-drag-box', 'true');
  return toolbar;
}

export function showToolbar(
  toolbarElement: HTMLElement,
  position: { x: number; y: number },
  placement: 'top' | 'bottom',
  isReviewMode = false
) {
  const reviewMode = isReviewMode ? 'true' : 'false';
  const left = `${position.x}px`;
  const top = `${position.y}px`;
  const transform = isReviewMode
    ? `translateX(var(--vlaina-translate-0)) translateY(${placement === 'top' ? 'var(--vlaina-translate--100pct)' : 'var(--vlaina-translate-0)'})`
    : `translateX(var(--vlaina-translate--50pct)) translateY(${placement === 'top' ? 'var(--vlaina-translate--100pct)' : 'var(--vlaina-translate-0)'})`;
  if (toolbarElement.dataset.reviewMode !== reviewMode) {
    toolbarElement.dataset.reviewMode = reviewMode;
  }
  if (toolbarElement.style.position !== themeDomStyleTokens.positionAbsolute) {
    toolbarElement.style.position = themeDomStyleTokens.positionAbsolute;
  }
  if (toolbarElement.style.left !== left) {
    toolbarElement.style.left = left;
  }
  if (toolbarElement.style.top !== top) {
    toolbarElement.style.top = top;
  }
  if (toolbarElement.style.transform !== transform) {
    toolbarElement.style.transform = transform;
  }

  if (!toolbarElement.classList.contains('visible')) {
    toolbarElement.classList.add('visible');
    toolbarElement.classList.remove('hidden');
  }
}

export function hideToolbar(toolbarElement: HTMLElement) {
  if (!toolbarElement.classList.contains('visible')) {
    return;
  }

  toolbarElement.classList.remove('visible');
  toolbarElement.classList.add('hidden');
}
