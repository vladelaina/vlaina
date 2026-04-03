import { $prose } from '@milkdown/kit/utils';
import { serializerCtx } from '@milkdown/kit/core';
import { Plugin, PluginKey, Selection, type EditorState } from '@milkdown/kit/prose/state';
import { DecorationSet, type EditorView } from '@milkdown/kit/prose/view';
import type { Serializer } from '@milkdown/kit/transformer';
import { isClickBelowLastBlock } from './endBlankClickUtils';
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
} from './blankAreaPlainClick';

export const blankAreaDragBoxPluginKey = new PluginKey('blankAreaDragBox');

const DRAG_THRESHOLD = 4;
const DRAG_BOX_COLOR = 'color-mix(in srgb, var(--vlaina-text-tertiary, #71717a) 18%, transparent)';
const DRAG_SESSION_CURSOR = 'crosshair';
const BLOCK_SELECTION_ACTIVE_CLASS = 'vlaina-block-selection-active';
const SCROLL_ROOT_SELECTOR = '[data-note-scroll-root="true"]';
const NOTES_SIDEBAR_SCROLL_ROOT_SELECTOR = '[data-notes-sidebar-scroll-root="true"]';
const COVER_REGION_SELECTOR = '[data-note-cover-region="true"]';
const INTERACTIVE_SELECTOR = [
  'a',
  'button',
  'input',
  'textarea',
  'select',
  'summary',
  'label',
  '[role="button"]',
  '[contenteditable="false"]',
  '[data-no-editor-drag-box="true"]',
].join(', ');

interface BlankAreaDragBoxState {
  selectedBlocks: BlockRange[];
  decorations: DecorationSet;
}

type BlockSelectionAction =
  | { type: 'set-blocks'; blocks: BlockRange[] }
  | { type: 'clear-blocks' };

const EMPTY_PLUGIN_STATE: BlankAreaDragBoxState = {
  selectedBlocks: [],
  decorations: DecorationSet.empty,
};

const CLEAR_BLOCKS_ACTION: BlockSelectionAction = { type: 'clear-blocks' };

function getScrollRoot(element: HTMLElement | null): HTMLElement | null {
  if (!element) return null;
  return element.closest(SCROLL_ROOT_SELECTOR) as HTMLElement | null;
}

function isSidebarBlankStartTarget(target: HTMLElement): boolean {
  const sidebarScrollRoot = target.closest(NOTES_SIDEBAR_SCROLL_ROOT_SELECTOR) as HTMLElement | null;
  if (!sidebarScrollRoot) return false;
  return target === sidebarScrollRoot;
}

function resolveDragStartZone(view: EditorView, event: MouseEvent): BlockDragStartZone | null {
  if (!(event.target instanceof HTMLElement)) return null;
  const target = event.target;

  const editorScrollRoot = getScrollRoot(view.dom);
  const targetScrollRoot = getScrollRoot(target);
  const isSameEditorScrollRoot = !!editorScrollRoot && !!targetScrollRoot && editorScrollRoot === targetScrollRoot;
  const isSidebarBlankStart = isSidebarBlankStartTarget(target);
  if (!isSameEditorScrollRoot && !isSidebarBlankStart) return null;

  if (target.closest(COVER_REGION_SELECTOR)) return null;
  if (target.closest(INTERACTIVE_SELECTOR)) return null;

  if (view.dom.contains(target)) {
    if (target === view.dom && isClickBelowLastBlock(view.dom, event.clientY)) {
      return 'below-last-block';
    }
    return null;
  }

  if (isSidebarBlankStart) {
    return 'outside-editor';
  }

  return 'outside-editor';
}

function getPluginState(state: EditorState): BlankAreaDragBoxState {
  return blankAreaDragBoxPluginKey.getState(state) ?? EMPTY_PLUGIN_STATE;
}

function dispatchSelectionAction(view: EditorView, action: BlockSelectionAction): void {
  view.dispatch(view.state.tr.setMeta(blankAreaDragBoxPluginKey, action));
}

function clearBlockSelection(view: EditorView): void {
  if (getPluginState(view.state).selectedBlocks.length === 0) return;
  dispatchSelectionAction(view, CLEAR_BLOCKS_ACTION);
}

function dispatchBlankAreaPlainClick(view: EditorView, action: {
  targetPos: number;
  bias: 1 | -1;
}): void {
  let tr = applyBlankAreaPlainClickSelection(view.state.tr, action);
  tr = tr.setMeta(blankAreaDragBoxPluginKey, CLEAR_BLOCKS_ACTION);
  view.dispatch(tr.scrollIntoView());
  view.focus();
}

function clearTextSelectionForDragSession(view: EditorView): void {
  const { state } = view;
  if (!state.selection.empty) {
    const docSize = state.doc.content.size;
    const collapsePos = Math.max(0, Math.min(state.selection.from, docSize));
    const tr = state.tr.setSelection(Selection.near(state.doc.resolve(collapsePos), -1));
    view.dispatch(tr);
    view.focus();
  }
  window.getSelection()?.removeAllRanges();
}

function setBlockSelectionVisualState(view: EditorView, active: boolean): void {
  view.dom.classList.toggle(BLOCK_SELECTION_ACTIVE_CLASS, active);
}

function syncBlockSelectionVisualState(view: EditorView): void {
  const active = getPluginState(view.state).selectedBlocks.length > 0;
  setBlockSelectionVisualState(view, active);
}

function isClipboardEvent(event: Event): event is ClipboardEvent {
  return 'clipboardData' in event;
}

function isIgnoredDragBoxTarget(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest('[data-no-editor-drag-box="true"]');
}

function deleteSelectedBlocks(view: EditorView, blocks: readonly BlockRange[]): boolean {
  return deleteSelectedBlocksCommand(
    view,
    blocks,
    (tr) => tr.setMeta(blankAreaDragBoxPluginKey, CLEAR_BLOCKS_ACTION),
  );
}

export const blankAreaDragBoxPlugin = $prose((ctx) => {
  let stopSession: (() => void) | null = null;
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

  const tryStartSession = (view: EditorView, event: MouseEvent): BlockDragStartZone | null => {
    if (event.button !== 0) return null;
    if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return null;
    const startZone = resolveDragStartZone(view, event);
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
      initialSelectedBlocks: getPluginState(view.state).selectedBlocks,
      onSelectionChange(blocks) {
        dispatchSelectionAction(view, blocks.length > 0
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
        return EMPTY_PLUGIN_STATE;
      },
      apply(tr, pluginState: BlankAreaDragBoxState) {
        const action = tr.getMeta(blankAreaDragBoxPluginKey) as BlockSelectionAction | undefined;
        if (action?.type === 'clear-blocks') {
          return EMPTY_PLUGIN_STATE;
        }
        if (action?.type === 'set-blocks') {
          const selectedBlocks = normalizeBlockRanges(action.blocks);
          return {
            selectedBlocks,
            decorations: createBlockSelectionDecorations(tr.doc, selectedBlocks),
          };
        }

        if (!tr.docChanged || pluginState.selectedBlocks.length === 0) {
          return pluginState;
        }

        const selectedBlocks = mapBlockRangesThroughTransaction(pluginState.selectedBlocks, tr);
        if (selectedBlocks.length === 0) return EMPTY_PLUGIN_STATE;
        return {
          selectedBlocks,
          decorations: createBlockSelectionDecorations(tr.doc, selectedBlocks),
        };
      },
    },
    props: {
      decorations(state) {
        return getPluginState(state).decorations;
      },
      handleKeyDown(view, event) {
        const { selectedBlocks } = getPluginState(view.state);
        if (selectedBlocks.length === 0) return false;

        const key = event.key.toLowerCase();
        const hasPrimaryModifier = (event.metaKey || event.ctrlKey) && !event.altKey;

        if (event.key === 'Delete' || event.key === 'Backspace') {
          if (event.metaKey || event.ctrlKey || event.altKey) return false;
          event.preventDefault();
          return deleteSelectedBlocks(view, selectedBlocks);
        }

        if (hasPrimaryModifier && key === 'c') {
          event.preventDefault();
          const text = serializeSelectedBlocks(view.state, selectedBlocks);
          void writeTextToClipboard(text);
          return true;
        }

        if (hasPrimaryModifier && key === 'x') {
          event.preventDefault();
          const text = serializeSelectedBlocks(view.state, selectedBlocks);
          void writeTextToClipboard(text);
          return deleteSelectedBlocks(view, selectedBlocks);
        }

        return false;
      },
      handleDOMEvents: {
        copy(view, event) {
          if (!isClipboardEvent(event)) return false;
          const { selectedBlocks } = getPluginState(view.state);
          if (selectedBlocks.length === 0) return false;

          const text = serializeSelectedBlocks(view.state, selectedBlocks);
          setClipboardText(event, text);
          return true;
        },
        cut(view, event) {
          if (!isClipboardEvent(event)) return false;
          const { selectedBlocks } = getPluginState(view.state);
          if (selectedBlocks.length === 0) return false;

          const text = serializeSelectedBlocks(view.state, selectedBlocks);
          setClipboardText(event, text);
          return deleteSelectedBlocks(view, selectedBlocks);
        },
        mousedown(view, event) {
          if (!(event instanceof MouseEvent)) return false;
          if (isIgnoredDragBoxTarget(event.target)) return false;
          const target = event.target;
          if (target instanceof Node && view.dom.contains(target) && getPluginState(view.state).selectedBlocks.length > 0) {
            clearBlockSelection(view);
          }

          // `below-last-block` starts drag-or-click behavior here.
          // `outside-editor` is handled by document-level listener below.
          const startZone = tryStartSession(view, event);
          return startZone === 'below-last-block';
        },
      },
    },
    view(view) {
      const doc = view.dom.ownerDocument;
      syncBlockSelectionVisualState(view);
      const handleDocumentMouseDown = (event: MouseEvent) => {
        if (isIgnoredDragBoxTarget(event.target)) return;
        const target = event.target;
        if (target instanceof Node && view.dom.contains(target)) {
          if (getPluginState(view.state).selectedBlocks.length > 0) {
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
          setBlockSelectionVisualState(view, false);
        },
      };
    },
  });
});
