export function toElement(node: Node | null): Element | null {
  if (!node) return null;
  if (node instanceof Element) return node;
  return node.parentElement;
}

function isInsideCollapsedThinking(element: Element | null): boolean {
  return !!element?.closest('[data-chat-thinking-collapsed="true"]');
}

export const FILTERED_SELECTION_SELECTOR = [
  '[data-chat-selection-excluded="true"]',
  '[data-chat-thinking-collapsed="true"]',
  '[aria-hidden="true"]',
  'button',
  '[role="button"]',
  'input',
  'textarea',
  'select',
].join(',');

export const MAX_CHAT_SELECTION_FILTER_SCAN_ELEMENTS = 10_000;
export const MAX_CHAT_SELECTION_MESSAGE_SCAN_ELEMENTS = 20_000;

export function safeRangeIntersectsNode(range: Range, node: Node): boolean {
  try {
    return range.intersectsNode(node);
  } catch {
    return false;
  }
}

export function rangeIntersectsSelector(range: Range, root: ParentNode, selector: string): boolean {
  if (root instanceof Element && root.matches(selector)) {
    if (safeRangeIntersectsNode(range, root)) return true;
  }

  const ownerDocument = root instanceof Document
    ? root
    : root.ownerDocument ?? document;
  const walker = ownerDocument.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let scanned = 0;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    scanned += 1;
    if (scanned > MAX_CHAT_SELECTION_FILTER_SCAN_ELEMENTS) {
      return true;
    }

    if (node instanceof Element && node.matches(selector) && safeRangeIntersectsNode(range, node)) {
      return true;
    }
  }
  return false;
}

export function rangeIntersectsMessageItem(range: Range, root: ParentNode): boolean {
  if (root instanceof Element && root.matches('[data-message-item="true"]')) {
    if (safeRangeIntersectsNode(range, root)) return true;
  }

  const ownerDocument = root instanceof Document
    ? root
    : root.ownerDocument ?? document;
  const walker = ownerDocument.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let scanned = 0;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    scanned += 1;
    if (scanned > MAX_CHAT_SELECTION_MESSAGE_SCAN_ELEMENTS) {
      return true;
    }

    if (
      node instanceof Element &&
      node.matches('[data-message-item="true"]') &&
      safeRangeIntersectsNode(range, node)
    ) {
      return true;
    }
  }
  return false;
}

export function isInsideMessageItem(element: Element | null): boolean {
  return !!element?.closest('[data-message-item="true"]');
}

export function isInsideAssistantMessageItem(element: Element | null): boolean {
  return !!element?.closest('[data-message-item="true"][data-role="assistant"]');
}

export function isInsideSelectionExcluded(element: Element | null): boolean {
  return !!element?.closest(FILTERED_SELECTION_SELECTOR);
}

export function isInsideSelectionSurface(element: Element | null): boolean {
  return !!element?.closest('[data-chat-selection-surface="true"]') &&
    !isInsideSelectionExcluded(element) &&
    !isInsideCollapsedThinking(element);
}

export function isInsideSelectionStartSurface(element: Element | null): boolean {
  return !!element?.closest('[data-chat-selection-start="true"]') &&
    !isInsideSelectionExcluded(element) &&
    !isInsideCollapsedThinking(element);
}

export function canStartChatSelection(element: Element | null): boolean {
  return isInsideMessageItem(element) && isInsideSelectionStartSurface(element);
}

export function isInsideChatScrollable(element: Element | null): boolean {
  return !!element?.closest('[data-chat-scrollable="true"]');
}
