import { $prose } from '@milkdown/kit/utils';
import { serializerCtx } from '@milkdown/kit/core';
import {
  NodeSelection,
  Plugin,
  Selection,
  TextSelection,
  type EditorState,
  type Transaction,
} from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import type { Serializer } from '@milkdown/kit/transformer';
import { createCaretOverlayRect, createCaretOverlayStyle } from '@/lib/ui/caretOverlayStyles';
import { dispatchTailBlankClickAction } from './endBlankClickPlugin';
import {
  createBlockSelectionDecorations,
  mapBlockRangesThroughTransaction,
  normalizeBlockRanges,
  type BlockRange,
} from './blockSelectionUtils';
import {
  deleteSelectedBlocks as deleteSelectedBlocksCommand,
  serializeSelectedBlocksToText,
} from './blockSelectionCommands';
import { startBlankAreaSelectionSession } from './blankAreaSelectionSession';
import { type BlockDragStartZone } from './blockDragSession';
import {
  applyBlankAreaPlainClickSelection,
  resolveInsideBlockTrailingPlainClickAction,
  type BlankAreaPlainClickAction,
} from './blankAreaPlainClick';
import { createBlockRectResolver } from './blockRectResolver';
import { resolveBlockElementAtPos } from './topLevelBlockDom';
import {
  blankAreaDragBoxPluginKey,
  CLEAR_BLOCKS_ACTION,
  clearBlockSelection,
  dispatchBlockSelectionAction,
  EMPTY_BLOCK_SELECTION_PLUGIN_STATE,
  getBlockSelectionPluginState,
  hasSelectedBlocks,
  setBlockSelectionVisualState,
  syncBlockSelectionVisualState,
  type BlankAreaDragBoxState,
  type BlockSelectionAction,
} from './blockSelectionPluginState';
import {
  isIgnoredBlankAreaDragBoxTarget,
  resolveBlankAreaDragStartZone,
} from './blankAreaDragTargets';
import {
  handleBlockSelectionCopy,
  handleBlockSelectionCut,
  handleBlockSelectionKeyDown,
  isClipboardEvent,
} from './blockSelectionInputHandlers';
import { createBlockSelectionLineFillOverlay } from './blockSelectionLineFillOverlay';

export { blankAreaDragBoxPluginKey } from './blockSelectionPluginState';

const DRAG_THRESHOLD = 4;
const DRAG_BOX_COLOR = 'var(--vlaina-color-editor-block-selection-drag-box, rgb(190 223 254 / 0.42))';
const DRAG_SESSION_CURSOR = 'crosshair';
const SCROLL_ROOT_SELECTOR = '[data-note-scroll-root="true"]';
const TRAILING_LINE_END_CLICK_GAP_PX = 8;
const LEADING_LINE_START_CLICK_GAP_PX = 8;
const FORCED_CARET_CLASS = 'vlaina-forced-line-end-caret-active';
const FORCED_CARET_STYLE_ID = 'vlaina-forced-line-end-caret-style';
const TEXTBLOCK_CARET_CLASS = 'vlaina-textblock-caret-overlay-active';
const TEXTBLOCK_CARET_ELEMENT_SELECTOR = '.vlaina-textblock-caret-overlay';
const EDITABLE_LIST_GAP_PLACEHOLDER = '\u2800';

interface RefinedBlankAreaPlainClickAction extends BlankAreaPlainClickAction {
  textRect?: ReturnType<typeof serializeRect>;
  forcedCaretX?: number;
}

interface VisualLineEdgeResolution {
  pos: number;
  textRect: ReturnType<typeof serializeRect>;
  forcedCaretX: number;
}

interface ActiveForcedCaret {
  owner: HTMLElement;
  cleanup: () => void;
}

let activeForcedCaret: ActiveForcedCaret | null = null;

function snapshotSelection(state: EditorState) {
  return {
    type: state.selection.constructor.name,
    from: state.selection.from,
    to: state.selection.to,
    empty: state.selection.empty,
  };
}

function isSameSelectionSnapshot(
  left: ReturnType<typeof snapshotSelection>,
  right: ReturnType<typeof snapshotSelection>,
): boolean {
  return left.type === right.type
    && left.from === right.from
    && left.to === right.to
    && left.empty === right.empty;
}

function roundCoord(value: number): number {
  return Math.round(value * 100) / 100;
}

function serializeRect(rect: Pick<DOMRect, 'left' | 'top' | 'right' | 'bottom' | 'width' | 'height'>) {
  return {
    left: roundCoord(rect.left),
    top: roundCoord(rect.top),
    right: roundCoord(rect.right),
    bottom: roundCoord(rect.bottom),
    width: roundCoord(rect.width),
    height: roundCoord(rect.height),
  };
}

function isPointInsideActualText(root: HTMLElement, clientX: number, clientY: number): boolean {
  const doc = root.ownerDocument;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.textContent?.trim()) return NodeFilter.FILTER_REJECT;
      const parent = node.parentElement;
      if (!parent || parent.closest('[contenteditable="false"]')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const range = doc.createRange();
    range.selectNodeContents(node);
    const rects = Array.from(range.getClientRects());
    range.detach();

    for (const rect of rects) {
      if (rect.width <= 0 || rect.height <= 0) continue;
      const verticalSlack = Math.max(2, Math.min(5, rect.height * 0.15));
      if (
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top - verticalSlack &&
        clientY <= rect.bottom + verticalSlack
      ) {
        return true;
      }
    }
  }

  return false;
}

function shouldResolveNearbyListGapPlaceholder(view: EditorView, event: MouseEvent): boolean {
  const target = event.target instanceof HTMLElement ? event.target : event.target instanceof Node ? event.target.parentElement : null;
  if (!target || !view.dom.contains(target)) return true;
  const textBlock = target.closest('p, li') as HTMLElement | null;
  if (!textBlock || !view.dom.contains(textBlock)) return true;
  return !isPointInsideActualText(textBlock, event.clientX, event.clientY);
}

function resolvePosAtCoordsForBlankClick(view: EditorView, event: MouseEvent) {
  try {
    return view.posAtCoords({ left: event.clientX, top: event.clientY });
  } catch {
    return null;
  }
}

function isListGapPlaceholderText(text: string): boolean {
  return text.replace(new RegExp(EDITABLE_LIST_GAP_PLACEHOLDER, 'g'), '').trim().length === 0
    && text.includes(EDITABLE_LIST_GAP_PLACEHOLDER);
}

function findListGapPlaceholderParagraphStartInListItem(listItem: { type: { name: string }; childCount: number; child: (index: number) => { type: { name: string }; nodeSize: number; textContent: string } }, listItemStart: number): number | null {
  if (listItem.type.name !== 'list_item') return null;
  let childStart = listItemStart + 1;
  for (let index = 0; index < listItem.childCount; index += 1) {
    const child = listItem.child(index);
    if (child.type.name === 'paragraph' && isListGapPlaceholderText(child.textContent)) {
      return childStart;
    }
    childStart += child.nodeSize;
  }
  return null;
}

function findListGapPlaceholderParagraphStart(view: EditorView, pos: number): number | null {
  const docSize = view.state.doc.content.size;
  const safePos = Math.max(0, Math.min(pos, docSize));
  const $pos = view.state.doc.resolve(safePos);
  const afterStart = $pos.nodeAfter
    ? findListGapPlaceholderParagraphStartInListItem($pos.nodeAfter, safePos)
    : null;
  if (afterStart !== null) return afterStart;
  if (
    $pos.nodeAfter?.type.name === 'paragraph'
    && isListGapPlaceholderText($pos.nodeAfter.textContent)
  ) {
    for (let depth = $pos.depth; depth > 0; depth -= 1) {
      if ($pos.node(depth).type.name === 'list_item') {
        return safePos;
      }
    }
  }

  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    const node = $pos.node(depth);
    if (node.type.name !== 'paragraph') continue;
    if (!isListGapPlaceholderText(node.textContent)) continue;

    for (let parentDepth = depth - 1; parentDepth > 0; parentDepth -= 1) {
      if ($pos.node(parentDepth).type.name === 'list_item') {
        return $pos.before(depth);
      }
    }
  }

  return null;
}

function resolveListGapPlaceholderFromNearbyBlock(view: EditorView, event: MouseEvent): number | null {
  const resolver = createBlockRectResolver({
    view,
    scrollRootSelector: SCROLL_ROOT_SELECTOR,
  });
  const blockRects = resolver.getTopLevelBlockRects();
  resolver.invalidate();

  let nearestParagraphStart: number | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const block of blockRects) {
    const paragraphStart = findListGapPlaceholderParagraphStart(view, block.from)
      ?? findListGapPlaceholderParagraphStart(view, block.from + 1);
    if (paragraphStart === null) continue;

    const distance = event.clientY < block.top
      ? block.top - event.clientY
      : event.clientY > block.bottom
        ? event.clientY - block.bottom
        : 0;
    if (distance > nearestDistance) continue;

    nearestParagraphStart = paragraphStart;
    nearestDistance = distance;
  }

  const maxDistance = shouldResolveNearbyListGapPlaceholder(view, event) ? 32 : 12;
  if (nearestParagraphStart === null || nearestDistance > maxDistance) {
    return null;
  }

  return nearestParagraphStart;
}

function handleListGapPlaceholderPointerDown(view: EditorView, event: MouseEvent): boolean {
  if (!isSameEditorScrollRoot(view, event.target)) return false;
  if (event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return false;

  const coords = resolvePosAtCoordsForBlankClick(view, event);
  if (!coords) {
    return false;
  }

  const paragraphStart = findListGapPlaceholderParagraphStart(view, coords.pos)
    ?? resolveListGapPlaceholderFromNearbyBlock(view, event);
  if (paragraphStart === null) return false;

  const targetPos = Math.min(paragraphStart + 1, view.state.doc.content.size);
  const selection = TextSelection.create(view.state.doc, targetPos);
  event.preventDefault();
  view.dispatch(view.state.tr.setSelection(selection).setMeta(blankAreaDragBoxPluginKey, CLEAR_BLOCKS_ACTION));
  view.focus();
  return true;
}

function resolveTopLevelListContainer(view: EditorView, target: EventTarget | null): HTMLElement | null {
  const targetElement = target instanceof HTMLElement
    ? target
    : target instanceof Node
      ? target.parentElement
      : null;
  if (!targetElement || !view.dom.contains(targetElement)) return null;

  for (let element: HTMLElement | null = targetElement; element && element !== view.dom; element = element.parentElement) {
    if ((element.tagName === 'OL' || element.tagName === 'UL') && element.parentElement === view.dom) {
      return element;
    }
  }

  return null;
}

function handleTrailingBlankClickInsideLastList(view: EditorView, event: MouseEvent): boolean {
  if (!isSameEditorScrollRoot(view, event.target)) return false;
  if (event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return false;

  const list = resolveTopLevelListContainer(view, event.target);
  if (!list || view.dom.lastElementChild !== list) return false;

  const resolver = createBlockRectResolver({
    view,
    scrollRootSelector: SCROLL_ROOT_SELECTOR,
  });
  const blockRects = resolver.getTopLevelBlockRects();
  resolver.invalidate();
  const lastBlock = blockRects[blockRects.length - 1];
  if (!lastBlock || event.clientY <= lastBlock.bottom) return false;

  const handled = dispatchTailBlankClickAction(view);
  if (!handled) return false;
  event.preventDefault();
  return true;
}

function ensureForcedCaretStyle(doc: Document): void {
  if (doc.getElementById(FORCED_CARET_STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = FORCED_CARET_STYLE_ID;
  style.textContent = createCaretOverlayStyle({
    activeSelector: `.ProseMirror.${FORCED_CARET_CLASS}, .ProseMirror.${FORCED_CARET_CLASS} *`,
    caretClass: 'vlaina-forced-line-end-caret',
    keyframesName: 'vlaina-forced-line-end-caret-blink',
  });
  doc.head.appendChild(style);
}

function clearTextBlockCaretOverlay(view: EditorView): number {
  const doc = view.dom.ownerDocument;
  const overlays = Array.from(doc.querySelectorAll(TEXTBLOCK_CARET_ELEMENT_SELECTOR));
  overlays.forEach((overlay) => overlay.remove());
  view.dom.classList.remove(TEXTBLOCK_CARET_CLASS);
  return overlays.length;
}

function createForcedLineEdgeCaret(
  view: EditorView,
  textRect: ReturnType<typeof serializeRect>,
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
  caret.className = 'vlaina-forced-line-end-caret';
  caret.style.left = `${overlayRect.left}px`;
  caret.style.top = `${overlayRect.top}px`;
  caret.style.height = `${overlayRect.height}px`;
  caret.style.zIndex = '2147483647';
  const previousInlineCaretColor = view.dom.style.caretColor;
  clearTextBlockCaretOverlay(view);
  doc.body.appendChild(caret);
  view.dom.classList.add(FORCED_CARET_CLASS);
  view.dom.style.caretColor = 'transparent';

  let disposed = false;
  const scrollRoot = view.dom.closest(SCROLL_ROOT_SELECTOR);
  const cleanup = () => {
    if (disposed) return;
    disposed = true;
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

function clearForcedCaretForOwner(owner: HTMLElement): void {
  if (activeForcedCaret?.owner !== owner) return;
  const { cleanup } = activeForcedCaret;
  activeForcedCaret = null;
  cleanup();
}

function setActiveForcedCaret(view: EditorView, textRect: ReturnType<typeof serializeRect>, forcedCaretX: number): void {
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

function resolveVisualLineEdgePos(
  view: EditorView,
  action: BlankAreaPlainClickAction,
  clientX: number,
  clientY: number,
): VisualLineEdgeResolution | null {
  const blockElement = resolveBlockElementAtPos(view, action.blockFrom);
  if (!blockElement) {
    return null;
  }

  const doc = blockElement.ownerDocument;
  const walker = doc.createTreeWalker(blockElement, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.textContent?.trim()) return NodeFilter.FILTER_REJECT;
      const parent = node.parentElement;
      if (!parent || isIgnoredTrailingLineEndElement(parent)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const blockContentStart = action.blockFrom + 1;
  const blockNode = view.state.doc.nodeAt(action.blockFrom);
  const blockContentEnd = blockNode
    ? Math.max(blockContentStart, action.blockFrom + blockNode.nodeSize - 1)
    : Math.max(blockContentStart, action.targetPos);
  let lineEdgeRect: DOMRect | null = null;

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const range = doc.createRange();
    range.selectNodeContents(node);
    const rects = Array.from(range.getClientRects());
    range.detach();

    for (const rect of rects) {
      if (rect.width <= 0 || rect.height <= 0) {
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

function dispatchBlankAreaPlainClick(
  view: EditorView,
  action: BlankAreaPlainClickAction,
  clientX?: number,
  clientY?: number,
): void {
  const refinedAction = refineBlankAreaPlainClickAction(view, action, clientX, clientY);
  let tr = applyBlankAreaPlainClickSelection(view.state.tr, refinedAction);
  tr = tr.setMeta(blankAreaDragBoxPluginKey, CLEAR_BLOCKS_ACTION);
  view.dispatch(tr.scrollIntoView());
  view.focus();
  showForcedLineEndCaret(view, refinedAction);
}

function isSameEditorScrollRoot(view: EditorView, target: EventTarget | null): boolean {
  if (!(target instanceof Node)) return false;
  if (view.dom.contains(target)) return true;
  const targetElement = target instanceof Element ? target : target.parentElement;
  if (!targetElement) return false;
  const editorScrollRoot = view.dom.closest(SCROLL_ROOT_SELECTOR);
  return !!editorScrollRoot && targetElement.closest(SCROLL_ROOT_SELECTOR) === editorScrollRoot;
}

function resolveInsideBlockTrailingPlainClick(view: EditorView, event: MouseEvent): BlankAreaPlainClickAction | null {
  if (!isSameEditorScrollRoot(view, event.target)) return null;
  if (event.button !== 0) return null;
  if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return null;

  const resolver = createBlockRectResolver({
    view,
    scrollRootSelector: SCROLL_ROOT_SELECTOR,
  });
  const blockRects = resolver.getTopLevelBlockRects();
  const action = resolveInsideBlockTrailingPlainClickAction({
    blockRects,
    clientX: event.clientX,
    clientY: event.clientY,
  });
  resolver.invalidate();
  return action;
}

function startInsideBlockTrailingPlainClickSession(
  view: EditorView,
  event: MouseEvent,
  action: BlankAreaPlainClickAction,
  getNativePointerSelectionVersion: () => number,
  dragThreshold = DRAG_THRESHOLD,
): () => void {
  const startX = event.clientX;
  const startY = event.clientY;
  const startSelection = snapshotSelection(view.state);
  const startNativePointerSelectionVersion = getNativePointerSelectionVersion();
  let didDrag = false;
  let isStopped = false;

  const stop = () => {
    if (isStopped) return;
    isStopped = true;
    window.removeEventListener('mousemove', handleMouseMove, true);
    window.removeEventListener('mouseup', handleMouseUp, true);
  };

  const handleMouseMove = (moveEvent: MouseEvent) => {
    const movedPastThreshold =
      Math.abs(moveEvent.clientX - startX) >= dragThreshold ||
      Math.abs(moveEvent.clientY - startY) >= dragThreshold;
    if (movedPastThreshold) {
      didDrag = true;
      stop();
    }
  };

  const handleMouseUp = () => {
    stop();
    if (didDrag) {
      return;
    }
    const currentSelection = snapshotSelection(view.state);
    const didNativePointerSelectionRun =
      getNativePointerSelectionVersion() !== startNativePointerSelectionVersion;
    if (didNativePointerSelectionRun || !isSameSelectionSnapshot(startSelection, currentSelection)) {
      return;
    }
    dispatchBlankAreaPlainClick(view, action, event.clientX, event.clientY);
  };

  window.addEventListener('mousemove', handleMouseMove, true);
  window.addEventListener('mouseup', handleMouseUp, true);
  return stop;
}

function clearTextSelectionForDragSession(view: EditorView): void {
  const { state } = view;
  if (!state.selection.empty && !(state.selection instanceof NodeSelection)) {
    const docSize = state.doc.content.size;
    const collapsePos = Math.max(0, Math.min(state.selection.from, docSize));
    const tr = state.tr.setSelection(Selection.near(state.doc.resolve(collapsePos), -1));
    view.dispatch(tr);
    view.focus();
  }
  const selection = view.dom.ownerDocument.defaultView?.getSelection();
  if (selection && selection.rangeCount > 0) {
    selection.removeAllRanges();
  }
}

function shouldHandleDocumentBlockSelectionEvent(view: EditorView, event: Event): boolean {
  const target = event.target;
  if (target instanceof Node && view.dom.contains(target)) return false;

  const activeElement = view.dom.ownerDocument.activeElement;
  if (
    activeElement instanceof HTMLElement
    && activeElement !== view.dom.ownerDocument.body
    && activeElement !== view.dom.ownerDocument.documentElement
    && activeElement !== view.dom
  ) {
    return false;
  }

  return getBlockSelectionPluginState(view.state).selectedBlocks.length > 0;
}

function handleDocumentBlockSelectionPaste(view: EditorView, event: ClipboardEvent): boolean {
  const capturedSelectedBlocks = getBlockSelectionPluginState(view.state).selectedBlocks;
  let handled = false;
  view.someProp('handleDOMEvents', (handleDOMEvents: { paste?: (view: EditorView, event: ClipboardEvent) => boolean }) => {
    if (handleDOMEvents.paste?.(view, event)) {
      handled = true;
      return true;
    }
    return undefined;
  });
  if (handled) return true;

  view.someProp('handlePaste', (handlePaste: (view: EditorView, event: ClipboardEvent, slice: null) => boolean) => {
    if (handlePaste(view, event, null)) {
      handled = true;
      return true;
    }
    return undefined;
  });
  if (handled) return true;

  const text = event.clipboardData?.getData('text/plain')?.replace(/\r\n?/g, '\n') ?? '';
  if (!text) return false;

  if (getBlockSelectionPluginState(view.state).selectedBlocks.length > 0) {
    if (!deleteSelectedBlocks(view, capturedSelectedBlocks)) return false;
  }
  view.dispatch(view.state.tr.insertText(text).scrollIntoView());
  view.focus();
  event.preventDefault();
  return true;
}

function deleteSelectedBlocks(view: EditorView, blocks: readonly BlockRange[]): boolean {
  return deleteSelectedBlocksCommand(
    view,
    blocks,
    (tr) => tr.setMeta(blankAreaDragBoxPluginKey, CLEAR_BLOCKS_ACTION),
  );
}

export function shouldClearBlockSelectionForTransaction(
  tr: Pick<Transaction, 'selection'> & { selectionSet?: boolean },
  pluginState: Pick<BlankAreaDragBoxState, 'selectedBlocks'>,
): boolean {
  return pluginState.selectedBlocks.length > 0
    && Boolean(tr.selectionSet)
    && tr.selection instanceof TextSelection;
}

export const blankAreaDragBoxPlugin = $prose((ctx) => {
  let stopSession: (() => void) | null = null;
  let stopInsideBlockTrailingPlainClickSession: (() => void) | null = null;
  let markdownSerializer: Serializer | null = null;
  let serializerResolved = false;
  let nativePointerSelectionVersion = 0;

  const resolveMarkdownSerializer = (): Serializer | null => {
    if (serializerResolved) return markdownSerializer;
    serializerResolved = true;
    try {
      markdownSerializer = ctx.get(serializerCtx);
    } catch {
      markdownSerializer = null;
    }
    return markdownSerializer;
  };

  const serializeSelectedBlocks = (state: EditorState, selectedBlocks: readonly BlockRange[]): string =>
    serializeSelectedBlocksToText(state, selectedBlocks, {
      markdownSerializer: resolveMarkdownSerializer(),
    });

  const clearSession = () => {
    if (!stopSession) return;
    stopSession();
    stopSession = null;
  };

  const clearInsideBlockTrailingPlainClickSession = () => {
    if (!stopInsideBlockTrailingPlainClickSession) return;
    stopInsideBlockTrailingPlainClickSession();
    stopInsideBlockTrailingPlainClickSession = null;
  };

  const tryStartSession = (view: EditorView, event: MouseEvent): BlockDragStartZone | null => {
    if (event.button !== 0) {
      return null;
    }
    if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
      return null;
    }
    const startZone = resolveBlankAreaDragStartZone(view, event);
    if (!startZone) return null;

    clearTextSelectionForDragSession(view);
    clearSession();

    const session = startBlankAreaSelectionSession({
      view,
      event,
      startZone,
      dragThreshold: DRAG_THRESHOLD,
      cursor: DRAG_SESSION_CURSOR,
      dragBoxColor: DRAG_BOX_COLOR,
      scrollRootSelector: SCROLL_ROOT_SELECTOR,
      initialSelectedBlocks: getBlockSelectionPluginState(view.state).selectedBlocks,
      onSelectionChange(blocks) {
        dispatchBlockSelectionAction(view, blocks.length > 0
          ? { type: 'set-blocks', blocks }
          : CLEAR_BLOCKS_ACTION);
      },
      onPlainClick({ zone, action, clientX, clientY }) {
        if (zone === 'below-last-block') {
          dispatchTailBlankClickAction(view);
          return;
        }
        if (!action) {
          clearBlockSelection(view);
          return;
        }
        dispatchBlankAreaPlainClick(view, action, clientX, clientY);
      },
      onActivateSelectionState() {
        setBlockSelectionVisualState(view, true);
      },
      onSyncSelectionState() {
        syncBlockSelectionVisualState(view);
      },
    });

    stopSession = session.stop;
    return startZone;
  };

  return new Plugin({
    key: blankAreaDragBoxPluginKey,
    state: {
      init() {
        return EMPTY_BLOCK_SELECTION_PLUGIN_STATE;
      },
      apply(tr, pluginState: BlankAreaDragBoxState) {
        const action = tr.getMeta(blankAreaDragBoxPluginKey) as BlockSelectionAction | undefined;
        if (action?.type === 'clear-blocks') {
          return EMPTY_BLOCK_SELECTION_PLUGIN_STATE;
        }
        if (action?.type === 'set-blocks') {
          const selectedBlocks = normalizeBlockRanges(action.blocks);
          const decorations = createBlockSelectionDecorations(tr.doc, selectedBlocks);
          return {
            selectedBlocks,
            decorations,
          };
        }

        if (pluginState.selectedBlocks.length === 0) {
          return pluginState;
        }

        if (shouldClearBlockSelectionForTransaction(tr, pluginState)) {
          return EMPTY_BLOCK_SELECTION_PLUGIN_STATE;
        }

        if (!tr.docChanged) {
          return pluginState;
        }

        const selectedBlocks = mapBlockRangesThroughTransaction(pluginState.selectedBlocks, tr);
        if (selectedBlocks.length === 0) return EMPTY_BLOCK_SELECTION_PLUGIN_STATE;
        const decorations = createBlockSelectionDecorations(tr.doc, selectedBlocks);
        return {
          selectedBlocks,
          decorations,
        };
      },
    },
    appendTransaction(transactions) {
      if (transactions.some((tr) => tr.selectionSet && tr.getMeta('pointer') === true)) {
        nativePointerSelectionVersion += 1;
      }
      return null;
    },
    props: {
      decorations(state) {
        return getBlockSelectionPluginState(state).decorations;
      },
      handleKeyDown(view, event) {
        const { selectedBlocks } = getBlockSelectionPluginState(view.state);
        return handleBlockSelectionKeyDown(event, {
          view,
          selectedBlocks,
          serializeSelectedBlocks,
          deleteSelectedBlocks,
        });
      },
      handleDOMEvents: {
        copy(view, event) {
          if (!isClipboardEvent(event)) return false;
          const { selectedBlocks } = getBlockSelectionPluginState(view.state);
          return handleBlockSelectionCopy(event, {
            view,
            selectedBlocks,
            serializeSelectedBlocks,
          });
        },
        cut(view, event) {
          if (!isClipboardEvent(event)) return false;
          const { selectedBlocks } = getBlockSelectionPluginState(view.state);
          return handleBlockSelectionCut(event, {
            view,
            selectedBlocks,
            serializeSelectedBlocks,
            deleteSelectedBlocks,
          });
        },
        mousedown(view, event) {
          if (!(event instanceof MouseEvent)) return false;
          if (isIgnoredBlankAreaDragBoxTarget(event.target)) {
            return false;
          }
          if (handleListGapPlaceholderPointerDown(view, event)) {
            return true;
          }
          if (handleTrailingBlankClickInsideLastList(view, event)) {
            return true;
          }
          const target = event.target;
          if (target instanceof Node && view.dom.contains(target) && hasSelectedBlocks(view.state)) {
            clearBlockSelection(view);
          }
          // `below-last-block` starts drag-or-click behavior here.
          // `outside-editor` is handled by document-level listener below.
          const startZone = tryStartSession(view, event);
          if (startZone !== null) return true;

          const insideBlockTrailingClickAction = resolveInsideBlockTrailingPlainClick(view, event);
          if (insideBlockTrailingClickAction) {
            clearInsideBlockTrailingPlainClickSession();
            stopInsideBlockTrailingPlainClickSession = startInsideBlockTrailingPlainClickSession(
              view,
              event,
              insideBlockTrailingClickAction,
              () => nativePointerSelectionVersion,
            );
            event.preventDefault();
            return true;
          }

          return false;
        },
      },
    },
    view(view) {
      const doc = view.dom.ownerDocument;
      const lineFillOverlay = createBlockSelectionLineFillOverlay(view);
      syncBlockSelectionVisualState(view);
      const handleDocumentKeyDown = (event: KeyboardEvent) => {
        if (!shouldHandleDocumentBlockSelectionEvent(view, event)) return;
        const { selectedBlocks } = getBlockSelectionPluginState(view.state);
        if (!handleBlockSelectionKeyDown(event, {
          view,
          selectedBlocks,
          serializeSelectedBlocks,
          deleteSelectedBlocks,
        })) {
          return;
        }
        event.stopImmediatePropagation();
      };
      const handleDocumentCopy = (event: ClipboardEvent) => {
        if (!shouldHandleDocumentBlockSelectionEvent(view, event)) return;
        const { selectedBlocks } = getBlockSelectionPluginState(view.state);
        if (!handleBlockSelectionCopy(event, {
          view,
          selectedBlocks,
          serializeSelectedBlocks,
        })) {
          return;
        }
        event.stopImmediatePropagation();
      };
      const handleDocumentCut = (event: ClipboardEvent) => {
        if (!shouldHandleDocumentBlockSelectionEvent(view, event)) return;
        const { selectedBlocks } = getBlockSelectionPluginState(view.state);
        if (!handleBlockSelectionCut(event, {
          view,
          selectedBlocks,
          serializeSelectedBlocks,
          deleteSelectedBlocks,
        })) {
          return;
        }
        event.stopImmediatePropagation();
      };
      const handleDocumentPaste = (event: ClipboardEvent) => {
        if (!shouldHandleDocumentBlockSelectionEvent(view, event)) return;
        if (!handleDocumentBlockSelectionPaste(view, event)) return;
        event.stopImmediatePropagation();
      };
      const handleDocumentMouseDown = (event: MouseEvent) => {
        if (isIgnoredBlankAreaDragBoxTarget(event.target)) {
          return;
        }
        const target = event.target;
        if (target instanceof Node && view.dom.contains(target)) {
          if (hasSelectedBlocks(view.state)) {
            clearBlockSelection(view);
          }
          return;
        }
        const startZone = tryStartSession(view, event);
        if (startZone) return;

        const insideBlockTrailingClickAction = resolveInsideBlockTrailingPlainClick(view, event);
        if (insideBlockTrailingClickAction) {
          clearInsideBlockTrailingPlainClickSession();
          stopInsideBlockTrailingPlainClickSession = startInsideBlockTrailingPlainClickSession(
            view,
            event,
            insideBlockTrailingClickAction,
            () => nativePointerSelectionVersion,
          );
          event.preventDefault();
          return;
        }

        clearBlockSelection(view);
      };

      doc.addEventListener('keydown', handleDocumentKeyDown, true);
      doc.addEventListener('copy', handleDocumentCopy, true);
      doc.addEventListener('cut', handleDocumentCut, true);
      doc.addEventListener('paste', handleDocumentPaste, true);
      doc.addEventListener('mousedown', handleDocumentMouseDown, true);

      return {
        update(updatedView) {
          syncBlockSelectionVisualState(updatedView);
          lineFillOverlay.update(updatedView);
        },
        destroy() {
          doc.removeEventListener('keydown', handleDocumentKeyDown, true);
          doc.removeEventListener('copy', handleDocumentCopy, true);
          doc.removeEventListener('cut', handleDocumentCut, true);
          doc.removeEventListener('paste', handleDocumentPaste, true);
          doc.removeEventListener('mousedown', handleDocumentMouseDown, true);
          clearForcedCaretForOwner(view.dom);
          lineFillOverlay.destroy();
          clearSession();
          clearInsideBlockTrailingPlainClickSession();
          setBlockSelectionVisualState(view, false);
        },
      };
    },
  });
});
