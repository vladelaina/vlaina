import { $prose } from '@milkdown/kit/utils';
import { serializerCtx } from '@milkdown/kit/core';
import { writeTextToClipboard } from '@/lib/clipboard';
import { getNotesDebugLogText, logNotesDebug } from '@/stores/notes/lineBreakDebugLog';
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
const DRAG_BOX_COLOR = 'rgb(190 223 254 / 0.42)';
const DRAG_SESSION_CURSOR = 'crosshair';
const SCROLL_ROOT_SELECTOR = '[data-note-scroll-root="true"]';
const TRAILING_LINE_END_CLICK_GAP_PX = 8;
const LEADING_LINE_START_CLICK_GAP_PX = 8;
const CARET_DEBUG_LABEL = 'NotesCaretClick';
const FORCED_CARET_CLASS = 'vlaina-forced-line-end-caret-active';
const FORCED_CARET_STYLE_ID = 'vlaina-forced-line-end-caret-style';
const CARET_DEBUG_QUERY_PARAM = 'debugCaret';
const CARET_DEBUG_STORAGE_KEY = 'vlaina_debug_caret_click';

type CaretDocument = Document & {
  caretRangeFromPoint?: (x: number, y: number) => Range | null;
};

interface CaretLineCandidateDebug {
  rect: ReturnType<typeof serializeRect>;
  nodeLength: number;
  parentTag: string | null;
  accepted: boolean;
  reason?: string;
  probe?: { x: number; y: number; pos: number | null; textRect?: ReturnType<typeof serializeRect> };
}

interface DomCaretPoint {
  pos: number;
  node: Node;
  offset: number;
}

interface RefinedBlankAreaPlainClickAction extends BlankAreaPlainClickAction {
  textRect?: ReturnType<typeof serializeRect>;
  forcedCaretX?: number;
  domCaret?: DomCaretPoint;
}

interface VisualLineEdgeResolution {
  pos: number;
  textRect: ReturnType<typeof serializeRect>;
  forcedCaretX: number;
  domCaret?: DomCaretPoint;
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

function logCaretClick(scope: string, payload?: unknown): void {
  if (!isCaretDebugUiEnabled()) return;
  logNotesDebug(CARET_DEBUG_LABEL, scope, payload);
}

function isCaretDebugUiEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (new URLSearchParams(window.location.search).has(CARET_DEBUG_QUERY_PARAM)) return true;
  } catch {
  }
  try {
    return window.localStorage?.getItem(CARET_DEBUG_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function serializeDomCaretForDebug(domCaret: DomCaretPoint | undefined) {
  if (!domCaret) return null;
  return {
    pos: domCaret.pos,
    nodeType: domCaret.node.nodeType,
    offset: domCaret.offset,
    parentTag: domCaret.node.parentElement?.tagName ?? null,
  };
}

function serializeActionForDebug(action: RefinedBlankAreaPlainClickAction | BlankAreaPlainClickAction) {
  const refined = action as RefinedBlankAreaPlainClickAction;
  return {
    targetPos: action.targetPos,
    bias: action.bias,
    blockFrom: action.blockFrom,
    textRect: refined.textRect ?? null,
    forcedCaretX: refined.forcedCaretX ?? null,
    domCaret: serializeDomCaretForDebug(refined.domCaret),
  };
}

function ensureForcedCaretStyle(doc: Document): void {
  if (doc.getElementById(FORCED_CARET_STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = FORCED_CARET_STYLE_ID;
  style.textContent = `
    .${FORCED_CARET_CLASS} {
      caret-color: transparent !important;
    }
    .vlaina-forced-line-end-caret {
      position: fixed;
      width: var(--vlaina-caret-width, 1px);
      background: var(--vlaina-caret-color, #41ace2);
      pointer-events: none;
      z-index: 10001;
      animation: vlaina-forced-line-end-caret-blink 1.05s steps(2, start) infinite;
    }
    @keyframes vlaina-forced-line-end-caret-blink {
      0%, 45% { opacity: 1; }
      46%, 100% { opacity: 0; }
    }
  `;
  doc.head.appendChild(style);
}

function createForcedLineEdgeCaret(
  view: EditorView,
  textRect: ReturnType<typeof serializeRect>,
  forcedCaretX: number,
): () => void {
  const doc = view.dom.ownerDocument;
  ensureForcedCaretStyle(doc);

  const caret = doc.createElement('div');
  caret.className = 'vlaina-forced-line-end-caret';
  caret.style.left = `${forcedCaretX}px`;
  caret.style.top = `${textRect.top}px`;
  caret.style.height = `${Math.max(12, textRect.bottom - textRect.top)}px`;
  doc.body.appendChild(caret);
  view.dom.classList.add(FORCED_CARET_CLASS);

  let disposed = false;
  const scrollRoot = view.dom.closest(SCROLL_ROOT_SELECTOR);
  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    caret.remove();
    view.dom.classList.remove(FORCED_CARET_CLASS);
    doc.removeEventListener('selectionchange', cleanup);
    doc.removeEventListener('mousedown', cleanup, true);
    view.dom.removeEventListener('keydown', cleanup, true);
    view.dom.removeEventListener('beforeinput', cleanup, true);
    view.dom.removeEventListener('input', cleanup, true);
    view.dom.removeEventListener('mousedown', cleanup, true);
    view.dom.removeEventListener('blur', cleanup, true);
    scrollRoot?.removeEventListener('scroll', cleanup);
    window.removeEventListener('resize', cleanup);
  };

  window.setTimeout(() => {
    if (disposed) return;
    doc.addEventListener('selectionchange', cleanup, { once: true });
    doc.addEventListener('mousedown', cleanup, true);
    view.dom.addEventListener('keydown', cleanup, true);
    view.dom.addEventListener('beforeinput', cleanup, true);
    view.dom.addEventListener('input', cleanup, true);
    view.dom.addEventListener('mousedown', cleanup, true);
    view.dom.addEventListener('blur', cleanup, true);
    scrollRoot?.addEventListener('scroll', cleanup, { passive: true });
    window.addEventListener('resize', cleanup, { passive: true });
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

function resolveDomCaretFromPoint(view: EditorView, root: HTMLElement, clientX: number, clientY: number): DomCaretPoint | null {
  const doc = root.ownerDocument as CaretDocument;

  const caretPosition = doc.caretPositionFromPoint?.(clientX, clientY);
  if (caretPosition && root.contains(caretPosition.offsetNode)) {
    try {
      const pos = view.posAtDOM(caretPosition.offsetNode, caretPosition.offset);
      logCaretClick('resolve-dom-caret:caret-position', {
        clientX: roundCoord(clientX),
        clientY: roundCoord(clientY),
        offset: caretPosition.offset,
        nodeType: caretPosition.offsetNode.nodeType,
        parentTag: caretPosition.offsetNode.parentElement?.tagName ?? null,
        pos,
      });
      return { pos, node: caretPosition.offsetNode, offset: caretPosition.offset };
    } catch {
    }
  }

  const caretRange = doc.caretRangeFromPoint?.(clientX, clientY);
  if (caretRange && root.contains(caretRange.startContainer)) {
    try {
      const pos = view.posAtDOM(caretRange.startContainer, caretRange.startOffset);
      logCaretClick('resolve-dom-caret:caret-range', {
        clientX: roundCoord(clientX),
        clientY: roundCoord(clientY),
        offset: caretRange.startOffset,
        nodeType: caretRange.startContainer.nodeType,
        parentTag: caretRange.startContainer.parentElement?.tagName ?? null,
        pos,
      });
      return { pos, node: caretRange.startContainer, offset: caretRange.startOffset };
    } catch {
    }
  }

  try {
    const coordsPos = view.posAtCoords({ left: clientX, top: clientY });
    logCaretClick('resolve-dom-caret:pos-at-coords', {
      clientX: roundCoord(clientX),
      clientY: roundCoord(clientY),
      result: coordsPos ? { pos: coordsPos.pos, inside: coordsPos.inside } : null,
    });
    return coordsPos ? { pos: coordsPos.pos, node: root, offset: 0 } : null;
  } catch {
    return null;
  }
}

function resolveVisualLineEdgePos(
  view: EditorView,
  action: BlankAreaPlainClickAction,
  clientX: number,
  clientY: number,
): VisualLineEdgeResolution | null {
  const blockElement = resolveBlockElementAtPos(view, action.blockFrom);
  if (!blockElement) {
    logCaretClick('line-edge:no-block-element', {
      action,
      clientX: roundCoord(clientX),
      clientY: roundCoord(clientY),
    });
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
  const candidates: CaretLineCandidateDebug[] = [];

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const range = doc.createRange();
    range.selectNodeContents(node);
    const rects = Array.from(range.getClientRects());
    range.detach();

    for (const rect of rects) {
      const candidate: CaretLineCandidateDebug = {
        rect: serializeRect(rect),
        nodeLength: node.textContent?.length ?? 0,
        parentTag: node.parentElement?.tagName ?? null,
        accepted: false,
      };
      candidates.push(candidate);
      if (rect.width <= 0 || rect.height <= 0) {
        candidate.reason = 'empty-rect';
        continue;
      }
      if (!isPointVerticallyInsideRect(rect, clientY)) {
        candidate.reason = 'y-miss';
        continue;
      }
      if (action.bias === -1) {
        if (clientX < rect.right + TRAILING_LINE_END_CLICK_GAP_PX) {
          candidate.reason = 'x-before-trailing-gap';
          continue;
        }
      } else if (clientX > rect.left - LEADING_LINE_START_CLICK_GAP_PX) {
        candidate.reason = 'x-after-leading-gap';
        continue;
      }

      const forcedCaretX = action.bias === -1 ? rect.right : rect.left;
      const caretX = action.bias === -1
        ? Math.max(rect.left, rect.right - 1)
        : Math.min(rect.right, rect.left + 1);
      const caretY = rect.top + rect.height / 2;
      const domCaret = resolveDomCaretFromPoint(view, blockElement, caretX, caretY);
      candidate.probe = { x: roundCoord(caretX), y: roundCoord(caretY), pos: domCaret?.pos ?? null };
      if (!domCaret) {
        candidate.reason = 'null-pos';
        continue;
      }
      const { pos } = domCaret;
      if (pos < blockContentStart || pos > blockContentEnd) {
        candidate.reason = 'pos-outside-block';
        continue;
      }
      const serializedTextRect = serializeRect(rect);
      candidate.probe.textRect = serializedTextRect;
      candidate.accepted = true;
      logCaretClick('line-edge:resolved', {
        action,
        clientX: roundCoord(clientX),
        clientY: roundCoord(clientY),
        blockTag: blockElement.tagName,
        blockContentStart,
        blockContentEnd,
        pos,
        textRect: serializedTextRect,
        forcedCaretX: roundCoord(forcedCaretX),
        domCaret: {
          nodeType: domCaret.node.nodeType,
          offset: domCaret.offset,
          parentTag: domCaret.node.parentElement?.tagName ?? null,
        },
        candidates,
      });
      return { pos, textRect: serializedTextRect, forcedCaretX, domCaret };
    }
  }

  logCaretClick('line-edge:unresolved', {
    action,
    clientX: roundCoord(clientX),
    clientY: roundCoord(clientY),
    blockTag: blockElement.tagName,
    blockContentStart,
    blockContentEnd,
    candidates,
  });
  return null;
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
      domCaret: lineEdgePos.domCaret,
    };
  logCaretClick('refine-action', {
    original: serializeActionForDebug(action),
    refined: serializeActionForDebug(refinedAction),
    clientX: roundCoord(clientX),
    clientY: roundCoord(clientY),
  });
  return refinedAction;
}

function showForcedLineEndCaret(view: EditorView, action: RefinedBlankAreaPlainClickAction): boolean {
  if (!action.textRect || typeof action.forcedCaretX !== 'number') return false;
  setActiveForcedCaret(view, action.textRect, action.forcedCaretX);
  logCaretClick('dispatch-selection:forced-caret', {
    targetPos: action.targetPos,
    textRect: action.textRect,
    forcedCaretX: roundCoord(action.forcedCaretX),
  });
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
  const selection = view.state.selection;
  let coords: ReturnType<typeof serializeRect> | null = null;
  try {
    coords = serializeRect(view.coordsAtPos(selection.from) as DOMRect);
  } catch {
  }
  logCaretClick('dispatch-selection', {
    action: serializeActionForDebug(action),
    refinedAction: serializeActionForDebug(refinedAction),
    clientX: typeof clientX === 'number' ? roundCoord(clientX) : null,
    clientY: typeof clientY === 'number' ? roundCoord(clientY) : null,
    selection: {
      type: selection.constructor.name,
      from: selection.from,
      to: selection.to,
      empty: selection.empty,
    },
    coords,
  });
}

function createCaretDebugCopyButton(doc: Document): HTMLButtonElement {
  const button = doc.createElement('button');
  button.type = 'button';
  button.textContent = 'Copy caret log';
  button.setAttribute('data-no-editor-drag-box', 'true');
  button.setAttribute('data-notes-caret-debug-copy', 'true');
  Object.assign(button.style, {
    position: 'fixed',
    right: '16px',
    bottom: '72px',
    zIndex: '10000',
    padding: '6px 10px',
    borderRadius: '8px',
    border: '1px solid rgb(180 190 205 / 0.65)',
    background: 'rgb(255 255 255 / 0.94)',
    color: '#111827',
    fontSize: '12px',
    lineHeight: '16px',
    boxShadow: '0 8px 24px rgb(15 23 42 / 0.18)',
    cursor: 'pointer',
  });

  button.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    const text = getNotesDebugLogText();
    const copied = await writeTextToClipboard(text);
    if (copied) {
      button.textContent = 'Copied caret log';
    } else {
      console.debug('[NotesCaretClick] copy failed', text);
      button.textContent = 'Copy failed - see console';
    }
    window.setTimeout(() => {
      button.textContent = 'Copy caret log';
    }, 1400);
  });

  return button;
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
    if (didDrag) return;
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
  window.getSelection()?.removeAllRanges();
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
          return {
            selectedBlocks,
            decorations: createBlockSelectionDecorations(tr.doc, selectedBlocks),
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
        return {
          selectedBlocks,
          decorations: createBlockSelectionDecorations(tr.doc, selectedBlocks),
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
            return false;
          }

          return false;
        },
      },
    },
    view(view) {
      const doc = view.dom.ownerDocument;
      const lineFillOverlay = createBlockSelectionLineFillOverlay(view);
      const debugCopyButton = isCaretDebugUiEnabled() ? createCaretDebugCopyButton(doc) : null;
      if (debugCopyButton) {
        doc.body.appendChild(debugCopyButton);
      }
      syncBlockSelectionVisualState(view);
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
          return;
        }

        clearBlockSelection(view);
      };

      doc.addEventListener('mousedown', handleDocumentMouseDown, true);

      return {
        update(updatedView) {
          syncBlockSelectionVisualState(updatedView);
          lineFillOverlay.update(updatedView);
        },
        destroy() {
          doc.removeEventListener('mousedown', handleDocumentMouseDown, true);
          clearForcedCaretForOwner(view.dom);
          debugCopyButton?.remove();
          lineFillOverlay.destroy();
          clearSession();
          clearInsideBlockTrailingPlainClickSession();
          setBlockSelectionVisualState(view, false);
        },
      };
    },
  });
});
