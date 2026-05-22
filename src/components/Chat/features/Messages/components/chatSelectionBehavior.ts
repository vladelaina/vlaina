import { isComposerFocusTarget } from "@/lib/ui/composerFocusRegistry";
import { normalizeSelectedTextForComposer } from "@/lib/ui/normalizeSelectedTextForComposer";

export interface SelectionInsertState {
  text: string;
  x: number;
  y: number;
  placeBelow: boolean;
}

export interface OutsideMoveDecision {
  nextFrozen: boolean;
  shouldPreventDefault: boolean;
  shouldRestore: boolean;
}

export interface LastValidSelectionSnapshot {
  anchorNode: Node;
  anchorOffset: number;
  focusNode: Node;
  focusOffset: number;
  range: Range;
  text: string;
}

export function resolveOutsideMoveDecision({
  isSelectingFromChat,
  pointerInsideSelectionSurface,
  isSelectionFrozen,
}: {
  isSelectingFromChat: boolean;
  pointerInsideSelectionSurface: boolean;
  isSelectionFrozen: boolean;
}): OutsideMoveDecision {
  if (!isSelectingFromChat) {
    return {
      nextFrozen: isSelectionFrozen,
      shouldPreventDefault: false,
      shouldRestore: false,
    };
  }
  if (pointerInsideSelectionSurface) {
    return {
      nextFrozen: false,
      shouldPreventDefault: false,
      shouldRestore: false,
    };
  }
  return {
    nextFrozen: true,
    shouldPreventDefault: true,
    shouldRestore: !isSelectionFrozen,
  };
}

export function setChatSelectionLock(active: boolean) {
  if (typeof document === "undefined") {
    return;
  }
  if (active) {
    document.body.setAttribute("data-chat-selection-lock", "1");
    return;
  }
  document.body.removeAttribute("data-chat-selection-lock");
}

function toElement(node: Node | null): Element | null {
  if (!node) return null;
  if (node instanceof Element) return node;
  return node.parentElement;
}

function isInsideCollapsedThinking(element: Element | null): boolean {
  return !!element?.closest('[data-chat-thinking-collapsed="true"]');
}

const FILTERED_SELECTION_SELECTOR = [
  '[data-chat-selection-excluded="true"]',
  '[data-chat-thinking-collapsed="true"]',
  'button',
  '[role="button"]',
  'input',
  'textarea',
  'select',
].join(',');

const BLOCK_TEXT_TAGS = new Set([
  'ADDRESS',
  'ARTICLE',
  'ASIDE',
  'BLOCKQUOTE',
  'BR',
  'DD',
  'DIV',
  'DL',
  'DT',
  'FIGCAPTION',
  'FIGURE',
  'FOOTER',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'HEADER',
  'HR',
  'LI',
  'MAIN',
  'NAV',
  'OL',
  'P',
  'PRE',
  'SECTION',
  'TABLE',
  'TBODY',
  'TD',
  'TFOOT',
  'TH',
  'THEAD',
  'TR',
  'UL',
]);

function rangeIntersectsSelector(range: Range, root: ParentNode, selector: string): boolean {
  if (root instanceof Element && root.matches(selector)) {
    try {
      if (range.intersectsNode(root)) {
        return true;
      }
    } catch {}
  }
  const elements = root.querySelectorAll(selector);
  for (const element of elements) {
    try {
      if (range.intersectsNode(element)) {
        return true;
      }
    } catch {}
  }
  return false;
}

function appendNewline(buffer: string[]): void {
  const last = buffer[buffer.length - 1];
  if (last !== '\n') {
    buffer.push('\n');
  }
}

function extractTextWithBlockBreaks(node: Node, buffer: string[]): void {
  if (node.nodeType === Node.TEXT_NODE) {
    buffer.push(node.textContent ?? '');
    return;
  }
  if (!(node instanceof Element || node instanceof DocumentFragment)) {
    return;
  }

  const element = node instanceof Element ? node : null;
  if (element?.matches(FILTERED_SELECTION_SELECTOR)) {
    return;
  }

  if (element?.tagName === 'BR') {
    appendNewline(buffer);
    return;
  }

  const isBlock = element ? BLOCK_TEXT_TAGS.has(element.tagName) : false;
  if (isBlock && buffer.some((part) => part.trim())) {
    appendNewline(buffer);
  }
  for (const child of Array.from(node.childNodes)) {
    extractTextWithBlockBreaks(child, buffer);
  }
  if (isBlock) {
    appendNewline(buffer);
  }
}

export function getSelectionTextForComposer(selection: Selection, range: Range): string {
  const rawText = selection.toString();
  const commonAncestorElement = toElement(range.commonAncestorContainer);
  const chatScrollable =
    commonAncestorElement?.closest('[data-chat-scrollable="true"]') ??
    toElement(selection.anchorNode)?.closest('[data-chat-scrollable="true"]') ??
    toElement(selection.focusNode)?.closest('[data-chat-scrollable="true"]') ??
    document.querySelector('[data-chat-scrollable="true"]');
  const filterSearchRoot =
    commonAncestorElement && isInsideChatScrollable(commonAncestorElement)
      ? commonAncestorElement
      : chatScrollable;

  if (!filterSearchRoot || !rangeIntersectsSelector(range, filterSearchRoot, FILTERED_SELECTION_SELECTOR)) {
    return normalizeSelectedTextForComposer(rawText);
  }

  const fragment = range.cloneContents();
  const filteredTextParts: string[] = [];
  extractTextWithBlockBreaks(fragment, filteredTextParts);
  return normalizeSelectedTextForComposer(filteredTextParts.join(''));
}

export function isInsideMessageItem(element: Element | null): boolean {
  return !!element?.closest('[data-message-item="true"]');
}

export function isInsideAssistantMessageItem(element: Element | null): boolean {
  return !!element?.closest('[data-message-item="true"][data-role="assistant"]');
}

export function isInsideSelectionSurface(element: Element | null): boolean {
  return !!element?.closest('[data-chat-selection-surface="true"]') && !isInsideSelectionExcluded(element) && !isInsideCollapsedThinking(element);
}

export function isInsideSelectionStartSurface(element: Element | null): boolean {
  return !!element?.closest('[data-chat-selection-start="true"]') && !isInsideSelectionExcluded(element) && !isInsideCollapsedThinking(element);
}

export function isInsideSelectionExcluded(element: Element | null): boolean {
  return !!element?.closest(FILTERED_SELECTION_SELECTOR);
}

export function canStartChatSelection(element: Element | null): boolean {
  return isInsideMessageItem(element) && isInsideSelectionStartSurface(element);
}

export function isInsideChatScrollable(element: Element | null): boolean {
  return !!element?.closest('[data-chat-scrollable="true"]');
}

function isSelectionInsideChatMessages(selection: Selection, range: Range): boolean {
  const anchorElement = toElement(selection.anchorNode);
  const focusElement = toElement(selection.focusNode);
  const ancestorElement = toElement(range.commonAncestorContainer);

  if (anchorElement && isComposerFocusTarget(anchorElement)) return false;
  if (focusElement && isComposerFocusTarget(focusElement)) return false;
  if (ancestorElement && isComposerFocusTarget(ancestorElement)) return false;

  const endpointInChat = [anchorElement, focusElement, ancestorElement].some((element) =>
    isInsideChatScrollable(element)
  );
  if (!endpointInChat) {
    return false;
  }

  const endpointInMessageItem = [anchorElement, focusElement, ancestorElement].some((element) =>
    isInsideMessageItem(element)
  );
  if (endpointInMessageItem) {
    return true;
  }

  const chatScrollable =
    ancestorElement?.closest('[data-chat-scrollable="true"]') ??
    anchorElement?.closest('[data-chat-scrollable="true"]') ??
    focusElement?.closest('[data-chat-scrollable="true"]') ??
    document.querySelector('[data-chat-scrollable="true"]');
  if (!chatScrollable) {
    return false;
  }

  const messageItems = chatScrollable.querySelectorAll('[data-message-item="true"]');
  for (const item of messageItems) {
    try {
      if (range.intersectsNode(item)) {
        return true;
      }
    } catch {}
  }

  return false;
}

export function isSelectionFullyInsideChatMessages(selection: Selection, range: Range): boolean {
  const anchorElement = toElement(selection.anchorNode);
  const focusElement = toElement(selection.focusNode);

  if (!isInsideChatScrollable(anchorElement) || !isInsideChatScrollable(focusElement)) {
    return false;
  }

  const chatScrollable =
    anchorElement?.closest('[data-chat-scrollable="true"]') ??
    focusElement?.closest('[data-chat-scrollable="true"]') ??
    document.querySelector('[data-chat-scrollable="true"]');
  if (!chatScrollable) {
    return false;
  }

  const messageItems = chatScrollable.querySelectorAll('[data-message-item="true"]');
  for (const item of messageItems) {
    try {
      if (range.intersectsNode(item)) {
        return true;
      }
    } catch {}
  }

  return false;
}

export function isSameRange(a: Range, b: Range): boolean {
  try {
    return (
      a.compareBoundaryPoints(Range.START_TO_START, b) === 0 &&
      a.compareBoundaryPoints(Range.END_TO_END, b) === 0
    );
  } catch {
    return false;
  }
}

function isConnectedNode(node: Node | null): node is Node {
  return !!node?.isConnected;
}

export function createSelectionSnapshot(
  selection: Selection,
  range: Range,
  text: string,
): LastValidSelectionSnapshot | null {
  if (!selection.anchorNode || !selection.focusNode) {
    return null;
  }

  return {
    anchorNode: selection.anchorNode,
    anchorOffset: selection.anchorOffset,
    focusNode: selection.focusNode,
    focusOffset: selection.focusOffset,
    range: range.cloneRange(),
    text,
  };
}

export function restoreSelectionSnapshot(selection: Selection, snapshot: LastValidSelectionSnapshot): boolean {
  if (isConnectedNode(snapshot.anchorNode) && isConnectedNode(snapshot.focusNode)) {
    try {
      selection.setBaseAndExtent(
        snapshot.anchorNode,
        snapshot.anchorOffset,
        snapshot.focusNode,
        snapshot.focusOffset,
      );
      return true;
    } catch {}
  }

  if (!isConnectedNode(snapshot.range.commonAncestorContainer)) {
    return false;
  }

  selection.removeAllRanges();
  selection.addRange(snapshot.range);
  return true;
}

export function computeStateFromSelection(): SelectionInsertState | null {
  if (typeof window === "undefined") {
    return null;
  }
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }

  const range = selection.getRangeAt(0);
  if (!isSelectionInsideChatMessages(selection, range)) {
    return null;
  }

  const text = getSelectionTextForComposer(selection, range);
  if (!text) {
    return null;
  }

  const rect = range.getBoundingClientRect();
  if (!rect || (rect.width === 0 && rect.height === 0)) {
    return null;
  }

  const minX = 24;
  const maxX = Math.max(24, window.innerWidth - 24);
  const centerX = rect.left + rect.width / 2;
  const x = Math.min(Math.max(centerX, minX), maxX);

  const placeBelow = rect.top < 64;
  const y = placeBelow ? rect.bottom + 10 : rect.top - 10;

  return { text, x, y, placeBelow };
}

export function getStateSignature(state: SelectionInsertState | null): string {
  if (!state) {
    return "";
  }
  return `${state.text}|${Math.round(state.x)}|${Math.round(state.y)}|${state.placeBelow ? "1" : "0"}`;
}
