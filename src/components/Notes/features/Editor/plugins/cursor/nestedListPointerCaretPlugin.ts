import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey, TextSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';

export const nestedListPointerCaretPluginKey = new PluginKey('nestedListPointerCaret');

const NESTED_LIST_SELECTOR = 'li > ol, li > ul';
const IGNORED_TEXT_TARGET_SELECTOR = [
  'button',
  'input',
  'textarea',
  'select',
  'summary',
  '[role="button"]',
  '[contenteditable="false"]',
].join(', ');
const MAX_NESTED_LIST_CARET_TEXT_NODES = 512;
const MAX_NESTED_LIST_CARET_TEXT_CHARS = 100_000;
const CLICK_MOVE_THRESHOLD_PX = 4;

interface TextOffsetResolution {
  offset: number;
  distance: number;
}

function isPrimaryPlainMouseDown(event: MouseEvent): boolean {
  return event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.altKey &&
    !event.shiftKey;
}

function isPointVerticallyInsideRect(rect: Pick<DOMRect, 'top' | 'bottom' | 'height'>, clientY: number): boolean {
  const verticalSlack = Math.max(2, Math.min(6, rect.height * 0.2));
  return clientY >= rect.top - verticalSlack && clientY <= rect.bottom + verticalSlack;
}

function resolveTextOffsetAtPoint(node: Text, clientX: number, clientY: number): TextOffsetResolution | null {
  const text = node.textContent ?? '';
  if (!text) return null;

  const doc = node.ownerDocument;
  let firstLeftOnLine: number | null = null;
  let lastRightOnLine: number | null = null;
  let caretOffset: number | null = null;

  for (let offset = 0; offset < text.length; offset += 1) {
    const range = doc.createRange();
    try {
      range.setStart(node, offset);
      range.setEnd(node, offset + 1);
      const rects = range.getClientRects();

      for (let index = 0; index < rects.length; index += 1) {
        const rect = rects[index];
        if (!rect || rect.width <= 0 || rect.height <= 0) continue;
        if (!isPointVerticallyInsideRect(rect, clientY)) continue;

        firstLeftOnLine ??= rect.left;
        lastRightOnLine = rect.right;

        if (caretOffset === null || clientX > rect.left + rect.width / 2) {
          caretOffset = clientX <= rect.left + rect.width / 2 ? offset : offset + 1;
        }
      }
    } finally {
      range.detach();
    }
  }

  if (firstLeftOnLine === null || lastRightOnLine === null || caretOffset === null) return null;

  const distance = clientX < firstLeftOnLine
    ? firstLeftOnLine - clientX
    : clientX > lastRightOnLine
      ? clientX - lastRightOnLine
      : 0;

  return {
    offset: caretOffset,
    distance,
  };
}

function clampDocPosition(view: EditorView, pos: number): number {
  return Math.max(0, Math.min(pos, view.state.doc.content.size));
}

function dispatchNestedListTextSelection(view: EditorView, anchor: number, head = anchor): boolean {
  if (!view.dom.isConnected) return false;

  const nextAnchor = clampDocPosition(view, anchor);
  const nextHead = clampDocPosition(view, head);
  try {
    const selection = TextSelection.create(view.state.doc, nextAnchor, nextHead);
    const tr = view.state.tr.setSelection(selection).scrollIntoView();
    view.dispatch(tr);
    view.dom.focus({ preventScroll: true });
    view.focus();
    return true;
  } catch {
    return false;
  }
}

export function resolveNestedListTextPositionAtPoint(
  view: EditorView,
  clientX: number,
  clientY: number,
  scanRoot: HTMLElement = view.dom,
): number | null {
  if (!view.dom.contains(scanRoot)) return null;

  const doc = view.dom.ownerDocument;
  let measuredTextNodes = 0;
  let measuredTextChars = 0;
  const walker = doc.createTreeWalker(scanRoot, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const text = node.textContent ?? '';
      measuredTextChars += text.length;
      if (measuredTextChars > MAX_NESTED_LIST_CARET_TEXT_CHARS) return NodeFilter.FILTER_ACCEPT;
      if (!text.trim()) return NodeFilter.FILTER_REJECT;

      const parent = node.parentElement;
      if (!parent || parent.closest(IGNORED_TEXT_TARGET_SELECTOR)) {
        return NodeFilter.FILTER_REJECT;
      }
      if (!parent.closest(NESTED_LIST_SELECTOR)) {
        return NodeFilter.FILTER_REJECT;
      }

      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let best: { distance: number; pos: number } | null = null;

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (measuredTextChars > MAX_NESTED_LIST_CARET_TEXT_CHARS) return null;
    measuredTextNodes += 1;
    if (measuredTextNodes > MAX_NESTED_LIST_CARET_TEXT_NODES) return null;
    if (!(node instanceof Text)) continue;

    const resolved = resolveTextOffsetAtPoint(node, clientX, clientY);
    if (resolved === null) continue;

    try {
      const pos = view.posAtDOM(node, resolved.offset, -1);
      if (best === null || resolved.distance < best.distance) {
        best = { distance: resolved.distance, pos };
      }
    } catch {
      continue;
    }
  }

  return best?.pos ?? null;
}

function startNestedListPointerSelection(view: EditorView, event: MouseEvent, pos: number, scanRoot: HTMLElement): void {
  const { ownerDocument } = view.dom;
  const startX = event.clientX;
  const startY = event.clientY;
  let moved = false;
  let stopped = false;

  const stop = () => {
    if (stopped) return;
    stopped = true;
    ownerDocument.removeEventListener('mousemove', handleMouseMove, true);
    ownerDocument.removeEventListener('mouseup', handleMouseUp, true);
  };

  const handleMouseMove = (moveEvent: MouseEvent) => {
    const hasDragged = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) > CLICK_MOVE_THRESHOLD_PX;
    if (!moved && !hasDragged) return;

    moved = true;
    const head = resolveNestedListTextPositionAtPoint(view, moveEvent.clientX, moveEvent.clientY, scanRoot);
    if (head !== null) {
      dispatchNestedListTextSelection(view, pos, head);
    }
  };

  const handleMouseUp = (upEvent: MouseEvent) => {
    stop();
    if (!moved) {
      dispatchNestedListTextSelection(view, pos);
      return;
    }

    const head = resolveNestedListTextPositionAtPoint(view, upEvent.clientX, upEvent.clientY, scanRoot);
    if (head !== null) {
      dispatchNestedListTextSelection(view, pos, head);
    }
  };

  event.preventDefault();
  dispatchNestedListTextSelection(view, pos);
  ownerDocument.addEventListener('mousemove', handleMouseMove, true);
  ownerDocument.addEventListener('mouseup', handleMouseUp, true);
}

export const nestedListPointerCaretPlugin = $prose(() => {
  return new Plugin({
    key: nestedListPointerCaretPluginKey,
    props: {
      handleDOMEvents: {
        mousedown(view, event) {
          if (!(event instanceof MouseEvent)) return false;
          if (!isPrimaryPlainMouseDown(event)) return false;
          if (!(event.target instanceof Node) || !view.dom.contains(event.target)) return false;

          const targetElement = event.target instanceof Element ? event.target : event.target.parentElement;
          const listItem = targetElement?.closest('li');
          const scanRoot = listItem instanceof HTMLElement && view.dom.contains(listItem) ? listItem : view.dom;
          const pos = resolveNestedListTextPositionAtPoint(view, event.clientX, event.clientY, scanRoot);
          if (pos === null) return false;

          startNestedListPointerSelection(view, event, pos, scanRoot);
          return true;
        },
      },
    },
  });
});
