import { normalizeSelectedTextForComposer } from "@/lib/ui/normalizeSelectedTextForComposer";
import {
  FILTERED_SELECTION_SELECTOR,
  isInsideChatScrollable,
  rangeIntersectsSelector,
  safeRangeIntersectsNode,
  toElement,
} from "./chatSelectionDom";

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
