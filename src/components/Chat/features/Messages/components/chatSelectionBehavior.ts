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
  '[aria-hidden="true"]',
  'button',
  '[role="button"]',
  'input',
  'textarea',
  'select',
].join(',');

export const MAX_CHAT_SELECTION_FILTER_SCAN_ELEMENTS = 10_000;
export const MAX_CHAT_SELECTION_MESSAGE_SCAN_ELEMENTS = 20_000;
export const MAX_CHAT_SELECTION_TEXT_NODES = 20_000;
export const MAX_CHAT_SELECTION_TEXT_DEPTH = 512;
export const MAX_CHAT_SELECTION_TEXT_CHARS = 200_000;

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

function safeRangeIntersectsNode(range: Range, node: Node): boolean {
  try {
    return range.intersectsNode(node);
  } catch {
    return false;
  }
}

function rangeIntersectsSelector(range: Range, root: ParentNode, selector: string): boolean {
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

function rangeIntersectsMessageItem(range: Range, root: ParentNode): boolean {
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

interface SelectionTextExtractionState {
  buffer: string[];
  nodeCount: number;
  charCount: number;
  hasNonWhitespaceText: boolean;
  truncated: boolean;
}

function appendText(state: SelectionTextExtractionState, text: string): void {
  if (!text || state.truncated) return;
  if (!state.hasNonWhitespaceText && !/\S/.test(text)) return;

  const remaining = MAX_CHAT_SELECTION_TEXT_CHARS - state.charCount;
  if (remaining <= 0) {
    state.truncated = true;
    return;
  }

  const nextText = text.length > remaining ? text.slice(0, remaining) : text;
  state.buffer.push(nextText);
  state.charCount += nextText.length;
  if (/\S/.test(nextText)) {
    state.hasNonWhitespaceText = true;
  }
  if (text.length > remaining) {
    state.truncated = true;
  }
}

function appendNewline(state: SelectionTextExtractionState): void {
  if (state.truncated) return;
  const last = state.buffer[state.buffer.length - 1];
  if (last !== '\n') {
    appendText(state, '\n');
  }
}

export function extractTextWithBlockBreaks(
  node: Node,
  range: Range,
  state: SelectionTextExtractionState,
  depth = 0,
): void {
  if (state.truncated) return;
  state.nodeCount += 1;
  if (state.nodeCount > MAX_CHAT_SELECTION_TEXT_NODES || depth > MAX_CHAT_SELECTION_TEXT_DEPTH) {
    state.truncated = true;
    return;
  }
  if (!safeRangeIntersectsNode(range, node)) {
    return;
  }

  if (node.nodeType === Node.TEXT_NODE) {
    const parentElement = node.parentElement;
    if (parentElement?.closest(FILTERED_SELECTION_SELECTOR)) {
      return;
    }

    const text = node.textContent ?? '';
    const start = node === range.startContainer ? range.startOffset : 0;
    const end = node === range.endContainer ? range.endOffset : text.length;
    appendText(state, text.slice(start, end));
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
    appendNewline(state);
    return;
  }

  const isBlock = element ? BLOCK_TEXT_TAGS.has(element.tagName) : false;
  if (isBlock && state.hasNonWhitespaceText) {
    appendNewline(state);
  }
  for (let index = 0; index < node.childNodes.length; index += 1) {
    extractTextWithBlockBreaks(node.childNodes.item(index), range, state, depth + 1);
    if (state.truncated) break;
  }
  if (isBlock) {
    appendNewline(state);
  }
}

export function getSelectionTextForComposer(selection: Selection, range: Range): string {
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
    const rawText = selection.toString();
    return normalizeSelectedTextForComposer(rawText);
  }

  const filteredTextState: SelectionTextExtractionState = {
    buffer: [],
    nodeCount: 0,
    charCount: 0,
    hasNonWhitespaceText: false,
    truncated: false,
  };
  extractTextWithBlockBreaks(filterSearchRoot, range, filteredTextState);
  return normalizeSelectedTextForComposer(filteredTextState.buffer.join(''));
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

  return rangeIntersectsMessageItem(range, chatScrollable);
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

  return rangeIntersectsMessageItem(range, chatScrollable);
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
