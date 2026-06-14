import type { EditorView } from '@milkdown/kit/prose/view';
import {
  createCaretOverlayRect,
  createCaretOverlayStyle,
  holdCaretBlink,
  releaseCaretBlink,
} from '@/lib/ui/caretOverlayStyles';
import { themeDomStyleTokens, themeStyleResetTokens } from '@/styles/themeTokens';
import { applyBlankAreaPlainClickSelection, type BlankAreaPlainClickAction } from './blankAreaPlainClick';
import { blankAreaDragBoxPluginKey, CLEAR_BLOCKS_ACTION } from './blockSelectionPluginState';
import { resolveBlockElementAtPos } from './topLevelBlockDom';
import { SCROLL_ROOT_SELECTOR } from './blankAreaInteractionUtils';
import { floatingToolbarKey } from '../floating-toolbar/floatingToolbarKey';
import { TOOLBAR_ACTIONS } from '../floating-toolbar/types';

const TRAILING_LINE_END_CLICK_GAP_PX = 8;
const LEADING_LINE_START_CLICK_GAP_PX = 8;
const FORCED_CARET_CLASS = 'editor-forced-line-end-caret-active';
const FORCED_CARET_STYLE_ID = 'editor-forced-line-end-caret-style';
const TEXTBLOCK_CARET_CLASS = 'editor-textblock-caret-overlay-active';
const TEXTBLOCK_CARET_ELEMENT_SELECTOR = '.editor-textblock-caret-overlay';
export const MAX_FORCED_LINE_EDGE_TEXT_CHARS = 100_000;
export const MAX_FORCED_LINE_EDGE_TEXT_NODES = 512;
export const MAX_FORCED_LINE_EDGE_RECTS = 1024;
export const MAX_TEXTBLOCK_CARET_OVERLAY_SCAN_ELEMENTS = 10_000;

interface SerializedRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

interface RefinedBlankAreaPlainClickAction extends BlankAreaPlainClickAction {
  textRect?: SerializedRect;
  forcedCaretX?: number;
}

interface VisualLineEdgeResolution {
  pos: number;
  textRect: SerializedRect;
  forcedCaretX: number;
}

interface ActiveForcedCaret {
  owner: HTMLElement;
  cleanup: () => void;
}

let activeForcedCaret: ActiveForcedCaret | null = null;

function roundCoord(value: number): number {
  return Math.round(value * 100) / 100;
}

function serializeRect(rect: Pick<DOMRect, 'left' | 'top' | 'right' | 'bottom' | 'width' | 'height'>): SerializedRect {
  return {
    left: roundCoord(rect.left),
    top: roundCoord(rect.top),
    right: roundCoord(rect.right),
    bottom: roundCoord(rect.bottom),
    width: roundCoord(rect.width),
    height: roundCoord(rect.height),
  };
}

function ensureForcedCaretStyle(doc: Document): void {
  if (doc.getElementById(FORCED_CARET_STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = FORCED_CARET_STYLE_ID;
  style.textContent = createCaretOverlayStyle({
    activeSelector: `.ProseMirror.${FORCED_CARET_CLASS}, .ProseMirror.${FORCED_CARET_CLASS} *`,
    caretClass: 'editor-forced-line-end-caret',
    keyframesName: 'editor-forced-line-end-caret-blink',
  });
  doc.head.appendChild(style);
}

export function clearTextBlockCaretOverlay(view: EditorView): number {
  const doc = view.dom.ownerDocument;
  const overlays: Element[] = [];
  const walker = doc.createTreeWalker(doc.body, 1);
  let scanned = 0;

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    scanned += 1;
    if (scanned > MAX_TEXTBLOCK_CARET_OVERLAY_SCAN_ELEMENTS) {
      break;
    }

    if (node instanceof Element && node.matches(TEXTBLOCK_CARET_ELEMENT_SELECTOR)) {
      overlays.push(node);
    }
  }

  overlays.forEach((overlay) => overlay.remove());
  view.dom.classList.remove(TEXTBLOCK_CARET_CLASS);
  return overlays.length;
}

function createForcedLineEdgeCaret(
  view: EditorView,
  textRect: SerializedRect,
  forcedCaretX: number,
): () => void {
  const doc = view.dom.ownerDocument;
  ensureForcedCaretStyle(doc);

  const caret = doc.createElement('div');
  const overlayRect = createCaretOverlayRect({
    left: forcedCaretX,
    top: textRect.top,
    bottom: textRect.bottom,
  });
  caret.className = 'editor-forced-line-end-caret';
  caret.style.left = `${overlayRect.left}px`;
  caret.style.top = `${overlayRect.top}px`;
  caret.style.height = `${overlayRect.height}px`;
  caret.style.zIndex = themeDomStyleTokens.zIndexForcedCaret;
  const previousInlineCaretColor = view.dom.style.caretColor;
  clearTextBlockCaretOverlay(view);
  doc.body.appendChild(caret);
  holdCaretBlink(caret);
  view.dom.classList.add(FORCED_CARET_CLASS);
  view.dom.style.caretColor = themeStyleResetTokens.colorTransparent;

  let disposed = false;
  const scrollRoot = view.dom.closest(SCROLL_ROOT_SELECTOR);
  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    releaseCaretBlink(caret);
    caret.remove();
    view.dom.classList.remove(FORCED_CARET_CLASS);
    view.dom.style.caretColor = previousInlineCaretColor;
    doc.removeEventListener('mousedown', handleDocumentMouseDown, true);
    view.dom.removeEventListener('keydown', handleKeyDown, true);
    view.dom.removeEventListener('beforeinput', handleBeforeInput, true);
    view.dom.removeEventListener('input', handleInput, true);
    view.dom.removeEventListener('mousedown', handleEditorMouseDown, true);
    view.dom.removeEventListener('blur', handleBlur, true);
    scrollRoot?.removeEventListener('scroll', handleScroll);
    window.removeEventListener('resize', handleResize);
  };
  const handleDocumentMouseDown = () => cleanup();
  const handleKeyDown = () => cleanup();
  const handleBeforeInput = () => cleanup();
  const handleInput = () => cleanup();
  const handleEditorMouseDown = () => cleanup();
  const handleBlur = () => cleanup();
  const handleScroll = () => cleanup();
  const handleResize = () => cleanup();

  window.setTimeout(() => {
    if (disposed) return;
    doc.addEventListener('mousedown', handleDocumentMouseDown, true);
    view.dom.addEventListener('keydown', handleKeyDown, true);
    view.dom.addEventListener('beforeinput', handleBeforeInput, true);
    view.dom.addEventListener('input', handleInput, true);
    view.dom.addEventListener('mousedown', handleEditorMouseDown, true);
    view.dom.addEventListener('blur', handleBlur, true);
    scrollRoot?.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });
  }, 0);

  return cleanup;
}

export function clearForcedCaretForOwner(owner: HTMLElement): void {
  if (activeForcedCaret?.owner !== owner) return;
  const { cleanup } = activeForcedCaret;
  activeForcedCaret = null;
  cleanup();
}

function setActiveForcedCaret(view: EditorView, textRect: SerializedRect, forcedCaretX: number): void {
  activeForcedCaret?.cleanup();
  activeForcedCaret = null;

  const cleanup = createForcedLineEdgeCaret(view, textRect, forcedCaretX);
  activeForcedCaret = {
    owner: view.dom,
    cleanup: () => {
      if (activeForcedCaret?.owner === view.dom) {
        activeForcedCaret = null;
      }
      cleanup();
    },
  };
}

function isIgnoredTrailingLineEndElement(element: Element): boolean {
  return Boolean(element.closest([
    'a',
    'button',
    'input',
    'textarea',
    'select',
    '[role="button"]',
    '[contenteditable="false"]',
  ].join(', ')));
}

function isPointVerticallyInsideRect(rect: Pick<DOMRect, 'top' | 'bottom' | 'height'>, clientY: number): boolean {
  const verticalSlack = Math.max(2, Math.min(6, rect.height * 0.2));
  return clientY >= rect.top - verticalSlack && clientY <= rect.bottom + verticalSlack;
}

export function resolveVisualLineEdgePos(
  view: EditorView,
  action: BlankAreaPlainClickAction,
  clientX: number,
  clientY: number,
): VisualLineEdgeResolution | null {
  const blockNode = view.state.doc.nodeAt(action.blockFrom);
  if (blockNode && blockNode.nodeSize > MAX_FORCED_LINE_EDGE_TEXT_CHARS + 2) {
    return null;
  }

  const blockElement = resolveBlockElementAtPos(view, action.blockFrom);
  if (!blockElement) {
    return null;
  }

  const doc = blockElement.ownerDocument;
  let measuredTextChars = 0;
  const walker = doc.createTreeWalker(blockElement, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const text = node.textContent ?? '';
      measuredTextChars += text.length;
      if (measuredTextChars > MAX_FORCED_LINE_EDGE_TEXT_CHARS) return NodeFilter.FILTER_ACCEPT;
      if (!text.trim()) return NodeFilter.FILTER_REJECT;
      const parent = node.parentElement;
      if (!parent || isIgnoredTrailingLineEndElement(parent)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const blockContentStart = action.blockFrom + 1;
  const blockContentEnd = blockNode
    ? Math.max(blockContentStart, action.blockFrom + blockNode.nodeSize - 1)
    : Math.max(blockContentStart, action.targetPos);
  let lineEdgeRect: DOMRect | null = null;
  let measuredTextNodes = 0;
  let measuredRects = 0;

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (measuredTextChars > MAX_FORCED_LINE_EDGE_TEXT_CHARS) {
      return null;
    }

    measuredTextNodes += 1;
    if (measuredTextNodes > MAX_FORCED_LINE_EDGE_TEXT_NODES) {
      return null;
    }

    const range = doc.createRange();
    try {
      range.selectNodeContents(node);
      const rects = range.getClientRects();

      for (let index = 0; index < rects.length; index += 1) {
        measuredRects += 1;
        if (measuredRects > MAX_FORCED_LINE_EDGE_RECTS) {
          return null;
        }

        const rect = rects[index];
        if (!rect || rect.width <= 0 || rect.height <= 0) {
          continue;
        }
        if (!isPointVerticallyInsideRect(rect, clientY)) {
          continue;
        }

        if (!lineEdgeRect) {
          lineEdgeRect = rect;
          continue;
        }

        if (action.bias === -1) {
          if (rect.right > lineEdgeRect.right) {
            lineEdgeRect = rect;
          }
        } else if (rect.left < lineEdgeRect.left) {
          lineEdgeRect = rect;
        }
      }
    } finally {
      range.detach();
    }
  }

  if (!lineEdgeRect) {
    return null;
  }

  if (action.bias === -1) {
    if (clientX < lineEdgeRect.right + TRAILING_LINE_END_CLICK_GAP_PX) {
      return null;
    }
  } else if (clientX > lineEdgeRect.left - LEADING_LINE_START_CLICK_GAP_PX) {
    return null;
  }

  const forcedCaretX = action.bias === -1 ? lineEdgeRect.right : lineEdgeRect.left;
  const pos = action.bias === -1 ? blockContentEnd : blockContentStart;
  const serializedTextRect = serializeRect(lineEdgeRect);
  return { pos, textRect: serializedTextRect, forcedCaretX };
}

function refineBlankAreaPlainClickAction(
  view: EditorView,
  action: BlankAreaPlainClickAction,
  clientX?: number,
  clientY?: number,
): RefinedBlankAreaPlainClickAction {
  if (typeof clientX !== 'number' || typeof clientY !== 'number') return action;
  const lineEdgePos = resolveVisualLineEdgePos(view, action, clientX, clientY);
  const refinedAction = lineEdgePos === null
    ? action
    : {
      ...action,
      targetPos: lineEdgePos.pos,
      textRect: lineEdgePos.textRect,
      forcedCaretX: lineEdgePos.forcedCaretX,
    };
  return refinedAction;
}

function showForcedLineEndCaret(view: EditorView, action: RefinedBlankAreaPlainClickAction): boolean {
  if (!action.textRect || typeof action.forcedCaretX !== 'number') return false;
  setActiveForcedCaret(view, action.textRect, action.forcedCaretX);
  return true;
}

export function dispatchBlankAreaPlainClick(
  view: EditorView,
  action: BlankAreaPlainClickAction,
  clientX?: number,
  clientY?: number,
): void {
  const refinedAction = refineBlankAreaPlainClickAction(view, action, clientX, clientY);
  let tr = applyBlankAreaPlainClickSelection(view.state.tr, refinedAction);
  tr = tr
    .setMeta(blankAreaDragBoxPluginKey, CLEAR_BLOCKS_ACTION)
    .setMeta(floatingToolbarKey, { type: TOOLBAR_ACTIONS.HIDE })
    .setMeta('addToHistory', false);
  view.dispatch(tr.scrollIntoView());
  view.focus();
  showForcedLineEndCaret(view, refinedAction);
}
