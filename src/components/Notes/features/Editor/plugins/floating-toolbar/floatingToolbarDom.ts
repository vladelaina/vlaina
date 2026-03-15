const SCROLL_ROOT_SELECTOR = '[data-note-scroll-root="true"]';
const TOOLBAR_ROOT_SELECTOR = '[data-note-toolbar-root="true"]';

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
  toolbarElement: HTMLElement
): {
  clampedX: number;
  toolbarWidth: number;
  minX: number;
  maxX: number;
} {
  if (!container) {
    return {
      clampedX: x,
      toolbarWidth: toolbarElement.offsetWidth,
      minX: Number.NEGATIVE_INFINITY,
      maxX: Number.POSITIVE_INFINITY,
    };
  }

  const margin = 12;
  const minX = margin;
  const maxX = container.clientWidth - margin;
  const toolbarBodyNode = toolbarElement.querySelector('.floating-toolbar-inner');
  const toolbarBody = toolbarBodyNode instanceof HTMLElement ? toolbarBodyNode : null;
  const toolbarWidth = toolbarBody?.offsetWidth || toolbarElement.offsetWidth;

  if (isAiMode) {
    return {
      clampedX: Math.min(x, Math.max(minX, maxX - toolbarWidth)),
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

export function createToolbarElement(): HTMLElement {
  const toolbar = document.createElement('div');
  toolbar.className = 'floating-toolbar hidden';
  toolbar.setAttribute('role', 'toolbar');
  toolbar.setAttribute('aria-label', 'Text formatting');
  return toolbar;
}

export function showToolbar(
  toolbarElement: HTMLElement,
  position: { x: number; y: number },
  placement: 'top' | 'bottom',
  isReviewMode = false
) {
  toolbarElement.style.left = `${position.x}px`;
  toolbarElement.style.top = `${position.y}px`;
  toolbarElement.style.transform = isReviewMode
    ? `translateX(0) translateY(${placement === 'top' ? '-100%' : '0'})`
    : `translateX(-50%) translateY(${placement === 'top' ? '-100%' : '0'})`;

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
