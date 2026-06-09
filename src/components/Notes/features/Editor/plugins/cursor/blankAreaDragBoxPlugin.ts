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
import { DecorationSet, type EditorView } from '@milkdown/kit/prose/view';
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
  handleBlockSelectionCopy,
  handleBlockSelectionCut,
  handleBlockSelectionKeyDown,
  isClipboardEvent,
} from './blockSelectionInputHandlers';
import { createBlockSelectionLineFillOverlay } from './blockSelectionLineFillOverlay';
import {
  DRAG_BOX_COLOR,
  DRAG_SESSION_CURSOR,
  DRAG_THRESHOLD,
  isSameEditorScrollRoot,
  SCROLL_ROOT_SELECTOR,
} from './blankAreaInteractionUtils';
import { handleListGapPlaceholderPointerDown } from './listGapPlaceholder';
import {
  createEditableMarkdownBlankLineDecorations,
  handleMarkdownBlankLinePointerDown,
  handleMarkdownBlankLineTextInput,
} from './markdownBlankLineInteraction';
import {
  clearForcedCaretForOwner,
  dispatchBlankAreaPlainClick,
} from './forcedLineEdgeCaret';

export { blankAreaDragBoxPluginKey } from './blockSelectionPluginState';

export const MAX_DOCUMENT_BLOCK_SELECTION_PASTE_CHARS = 1024 * 1024;

const editorInteractionDecorationsCache = new WeakMap<
  EditorState['doc'],
  WeakMap<DecorationSet, WeakMap<DecorationSet, DecorationSet>>
>();

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

function getEditorInteractionDecorations(state: EditorState): DecorationSet {
  const blockSelectionDecorations = getBlockSelectionPluginState(state).decorations;
  const editableBlankLineDecorations = createEditableMarkdownBlankLineDecorations(state.doc);
  if (blockSelectionDecorations === DecorationSet.empty) {
    return editableBlankLineDecorations;
  }
  if (editableBlankLineDecorations === DecorationSet.empty) {
    return blockSelectionDecorations;
  }

  let blockCache = editorInteractionDecorationsCache.get(state.doc);
  if (!blockCache) {
    blockCache = new WeakMap();
    editorInteractionDecorationsCache.set(state.doc, blockCache);
  }
  let blankLineCache = blockCache.get(blockSelectionDecorations);
  if (!blankLineCache) {
    blankLineCache = new WeakMap();
    blockCache.set(blockSelectionDecorations, blankLineCache);
  }
  const cached = blankLineCache.get(editableBlankLineDecorations);
  if (cached) return cached;

  const decorations = [
    ...blockSelectionDecorations.find(),
    ...editableBlankLineDecorations.find(),
  ];
  const decorationSet = DecorationSet.create(state.doc, decorations);
  blankLineCache.set(editableBlankLineDecorations, decorationSet);
  return decorationSet;
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

  const rawText = event.clipboardData?.getData('text/plain') ?? '';
  if (!rawText) return false;
  if (rawText.length > MAX_DOCUMENT_BLOCK_SELECTION_PASTE_CHARS) {
    event.preventDefault();
    return true;
  }
  const text = rawText.replace(/\r\n?/g, '\n');

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
        return getEditorInteractionDecorations(state);
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
      handleTextInput(view, from, to, text) {
        return handleMarkdownBlankLineTextInput(view, from, to, text);
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
          if (handleMarkdownBlankLinePointerDown(view, event)) {
            return true;
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
