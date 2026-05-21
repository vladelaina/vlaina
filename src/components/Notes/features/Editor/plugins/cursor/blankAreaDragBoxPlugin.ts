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
  writeTextToClipboard,
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

export { blankAreaDragBoxPluginKey } from './blockSelectionPluginState';

const DRAG_THRESHOLD = 4;
const DRAG_BOX_COLOR = 'rgb(190 223 254 / 0.42)';
const DRAG_SESSION_CURSOR = 'crosshair';
const SCROLL_ROOT_SELECTOR = '[data-note-scroll-root="true"]';

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

function isClipboardShortcut(event: KeyboardEvent, key: 'c' | 'x'): boolean {
  return (
    (event.metaKey || event.ctrlKey) &&
    !event.altKey &&
    !event.shiftKey &&
    event.key.toLowerCase() === key
  );
}

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
      onPlainClick({ zone, action }) {
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
        if (selectedBlocks.length === 0) return false;

        if (isClipboardShortcut(event, 'c')) {
          const text = serializeSelectedBlocks(view.state, selectedBlocks);
          if (text.length === 0) return false;

          event.preventDefault();
          void writeTextToClipboard(text);
          return true;
        }

        if (isClipboardShortcut(event, 'x')) {
          const text = serializeSelectedBlocks(view.state, selectedBlocks);
          if (text.length === 0) return false;

          event.preventDefault();
          void writeTextToClipboard(text).then((didCopy) => {
            if (didCopy) {
              deleteSelectedBlocks(view, selectedBlocks);
            }
          });
          return true;
        }

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
