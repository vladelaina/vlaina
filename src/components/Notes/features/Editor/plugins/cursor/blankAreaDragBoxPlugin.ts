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
  setClipboardText,
} from './blockSelectionCommands';
import { startBlankAreaSelectionSession } from './blankAreaSelectionSession';
import { type BlockDragStartZone } from './blockDragSession';
import {
  applyBlankAreaPlainClickSelection,
  resolveInsideBlockTrailingPlainClickAction,
  type BlankAreaPlainClickAction,
} from './blankAreaPlainClick';
import { createBlockRectResolver } from './blockRectResolver';
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
  describeDebugTarget,
  formatDebugBlockRanges,
  logBlockSelectionDebug,
} from './blockSelectionDebugLog';

export { blankAreaDragBoxPluginKey } from './blockSelectionPluginState';

const DRAG_THRESHOLD = 4;
const DRAG_BOX_COLOR = 'color-mix(in srgb, var(--vlaina-color-editor-block-selection, var(--vlaina-color-accent, #1e96eb)) 18%, transparent)';
const DRAG_SESSION_CURSOR = 'crosshair';
const SCROLL_ROOT_SELECTOR = '[data-note-scroll-root="true"]';

function dispatchBlankAreaPlainClick(view: EditorView, action: BlankAreaPlainClickAction): void {
  let tr = applyBlankAreaPlainClickSelection(view.state.tr, action);
  tr = tr.setMeta(blankAreaDragBoxPluginKey, CLEAR_BLOCKS_ACTION);
  view.dispatch(tr.scrollIntoView());
  view.focus();
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
  const action = resolveInsideBlockTrailingPlainClickAction({
    blockRects: resolver.getTopLevelBlockRects(),
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
  dragThreshold = DRAG_THRESHOLD,
): () => void {
  const startX = event.clientX;
  const startY = event.clientY;
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
    dispatchBlankAreaPlainClick(view, action);
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

function isClipboardEvent(event: Event): event is ClipboardEvent {
  return 'clipboardData' in event;
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
      logBlockSelectionDebug('select:skip-start:button', { button: event.button });
      return null;
    }
    if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
      logBlockSelectionDebug('select:skip-start:modifier', {
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        shiftKey: event.shiftKey,
      });
      return null;
    }
    const startZone = resolveBlankAreaDragStartZone(view, event);
    logBlockSelectionDebug('select:mousedown-candidate', {
      target: describeDebugTarget(event.target),
      clientX: event.clientX,
      clientY: event.clientY,
      startZone,
      currentSelection: formatDebugBlockRanges(getBlockSelectionPluginState(view.state).selectedBlocks),
    });
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
        logBlockSelectionDebug('select:dispatch-selection', {
          blocks: formatDebugBlockRanges(blocks),
        });
        dispatchBlockSelectionAction(view, blocks.length > 0
          ? { type: 'set-blocks', blocks }
          : CLEAR_BLOCKS_ACTION);
      },
      onPlainClick({ zone, action }) {
        logBlockSelectionDebug('select:plain-click', {
          zone,
          action,
        });
        if (zone === 'below-last-block') {
          dispatchTailBlankClickAction(view);
          return;
        }
        if (!action) {
          clearBlockSelection(view);
          return;
        }
        dispatchBlankAreaPlainClick(view, action);
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
          logBlockSelectionDebug('select:state:set-blocks', {
            raw: formatDebugBlockRanges(action.blocks),
            normalized: formatDebugBlockRanges(selectedBlocks),
          });
          return {
            selectedBlocks,
            decorations: createBlockSelectionDecorations(tr.doc, selectedBlocks),
          };
        }

        if (pluginState.selectedBlocks.length === 0) {
          return pluginState;
        }

        if (shouldClearBlockSelectionForTransaction(tr, pluginState)) {
          logBlockSelectionDebug('select:state:clear-text-selection', {
            previous: formatDebugBlockRanges(pluginState.selectedBlocks),
            selectionFrom: tr.selection.from,
            selectionTo: tr.selection.to,
          });
          return EMPTY_BLOCK_SELECTION_PLUGIN_STATE;
        }

        if (!tr.docChanged) {
          return pluginState;
        }

        const selectedBlocks = mapBlockRangesThroughTransaction(pluginState.selectedBlocks, tr);
        logBlockSelectionDebug('select:state:map-transaction', {
          previous: formatDebugBlockRanges(pluginState.selectedBlocks),
          mapped: formatDebugBlockRanges(selectedBlocks),
        });
        if (selectedBlocks.length === 0) return EMPTY_BLOCK_SELECTION_PLUGIN_STATE;
        return {
          selectedBlocks,
          decorations: createBlockSelectionDecorations(tr.doc, selectedBlocks),
        };
      },
    },
    props: {
      decorations(state) {
        return getBlockSelectionPluginState(state).decorations;
      },
      handleKeyDown(view, event) {
        const { selectedBlocks } = getBlockSelectionPluginState(view.state);
        if (selectedBlocks.length === 0) return false;

        if (event.key === 'Delete' || event.key === 'Backspace') {
          if (event.metaKey || event.ctrlKey || event.altKey) return false;
          event.preventDefault();
          return deleteSelectedBlocks(view, selectedBlocks);
        }

        return false;
      },
      handleDOMEvents: {
        copy(view, event) {
          if (!isClipboardEvent(event)) return false;
          const { selectedBlocks } = getBlockSelectionPluginState(view.state);
          if (selectedBlocks.length === 0) return false;

          const text = serializeSelectedBlocks(view.state, selectedBlocks);
          setClipboardText(event, text);
          return true;
        },
        cut(view, event) {
          if (!isClipboardEvent(event)) return false;
          const { selectedBlocks } = getBlockSelectionPluginState(view.state);
          if (selectedBlocks.length === 0) return false;

          const text = serializeSelectedBlocks(view.state, selectedBlocks);
          setClipboardText(event, text);
          return deleteSelectedBlocks(view, selectedBlocks);
        },
        mousedown(view, event) {
          if (!(event instanceof MouseEvent)) return false;
          logBlockSelectionDebug('select:editor-mousedown', {
            target: describeDebugTarget(event.target),
            clientX: event.clientX,
            clientY: event.clientY,
            selectedBlocks: formatDebugBlockRanges(getBlockSelectionPluginState(view.state).selectedBlocks),
          });
          if (isIgnoredBlankAreaDragBoxTarget(event.target)) {
            logBlockSelectionDebug('select:editor-mousedown:ignored-target', {
              target: describeDebugTarget(event.target),
            });
            return false;
          }
          const target = event.target;
          if (target instanceof Node && view.dom.contains(target) && hasSelectedBlocks(view.state)) {
            clearBlockSelection(view);
          }
          const insideBlockTrailingClickAction = resolveInsideBlockTrailingPlainClick(view, event);
          if (insideBlockTrailingClickAction) {
            clearInsideBlockTrailingPlainClickSession();
            stopInsideBlockTrailingPlainClickSession = startInsideBlockTrailingPlainClickSession(
              view,
              event,
              insideBlockTrailingClickAction,
            );
            return false;
          }

          // `below-last-block` starts drag-or-click behavior here.
          // `outside-editor` is handled by document-level listener below.
          const startZone = tryStartSession(view, event);
          return startZone !== null;
        },
      },
    },
    view(view) {
      const doc = view.dom.ownerDocument;
      syncBlockSelectionVisualState(view);
      const handleDocumentMouseDown = (event: MouseEvent) => {
        logBlockSelectionDebug('select:document-mousedown', {
          target: describeDebugTarget(event.target),
          insideEditor: event.target instanceof Node && view.dom.contains(event.target),
          clientX: event.clientX,
          clientY: event.clientY,
          selectedBlocks: formatDebugBlockRanges(getBlockSelectionPluginState(view.state).selectedBlocks),
        });
        if (isIgnoredBlankAreaDragBoxTarget(event.target)) {
          logBlockSelectionDebug('select:document-mousedown:ignored-target', {
            target: describeDebugTarget(event.target),
          });
          return;
        }
        const insideBlockTrailingClickAction = resolveInsideBlockTrailingPlainClick(view, event);
        if (insideBlockTrailingClickAction) {
          clearInsideBlockTrailingPlainClickSession();
          stopInsideBlockTrailingPlainClickSession = startInsideBlockTrailingPlainClickSession(
            view,
            event,
            insideBlockTrailingClickAction,
          );
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
        if (!startZone) {
          clearBlockSelection(view);
        }
      };

      doc.addEventListener('mousedown', handleDocumentMouseDown, true);

      return {
        update(updatedView) {
          syncBlockSelectionVisualState(updatedView);
        },
        destroy() {
          doc.removeEventListener('mousedown', handleDocumentMouseDown, true);
          clearSession();
          clearInsideBlockTrailingPlainClickSession();
          setBlockSelectionVisualState(view, false);
        },
      };
    },
  });
});
