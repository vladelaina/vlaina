import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey, Selection, type EditorState, type Transaction } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet, type EditorView } from '@milkdown/kit/prose/view';
import { dispatchTailBlankClickAction, isClickBelowLastBlock } from './endBlankClickUtils';
import {
  getBlockRangesKey,
  normalizeBlockRanges,
  resolveIntersectedBlockRanges,
  type BlockRange,
  type RectBounds,
} from './blockSelectionUtils';
import {
  deleteSelectedBlocks as deleteSelectedBlocksCommand,
  serializeSelectedBlocksToText,
  setClipboardText,
  writeTextToClipboard,
} from './blockSelectionCommands';
import { createBlockRectResolver } from './blockRectResolver';
import { startBlockDragSession, type BlockDragStartZone } from './blockDragSession';

export const blankAreaDragBoxPluginKey = new PluginKey('blankAreaDragBox');

const DRAG_THRESHOLD = 4;
const DRAG_BOX_COLOR = 'rgba(39, 131, 222, 0.18)';
const DRAG_SESSION_CURSOR = 'crosshair';
const BLOCK_SELECTION_CLASS = 'neko-block-selected';
const BLOCK_SELECTION_ACTIVE_CLASS = 'neko-block-selection-active';
const SCROLL_ROOT_SELECTOR = '[data-note-scroll-root="true"]';
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

function resolveDragStartZone(view: EditorView, event: MouseEvent): BlockDragStartZone | null {
  if (!(event.target instanceof HTMLElement)) return null;
  const target = event.target;

  const editorScrollRoot = getScrollRoot(view.dom);
  const targetScrollRoot = getScrollRoot(target);
  if (!editorScrollRoot || !targetScrollRoot || editorScrollRoot !== targetScrollRoot) return null;

  if (target.closest(COVER_REGION_SELECTOR)) return null;
  if (target.closest(INTERACTIVE_SELECTOR)) return null;

  if (view.dom.contains(target)) {
    if (target === view.dom && isClickBelowLastBlock(view.dom, event.clientY)) {
      return 'below-last-block';
    }
    return null;
  }

  return 'outside-editor';
}

function createDragBox(): HTMLDivElement {
  const box = document.createElement('div');
  box.setAttribute('data-editor-drag-box', 'true');
  box.style.position = 'fixed';
  box.style.pointerEvents = 'none';
  box.style.zIndex = '9999';
  box.style.border = `1px solid ${DRAG_BOX_COLOR}`;
  box.style.background = DRAG_BOX_COLOR;
  box.style.borderRadius = '0';
  box.style.left = '0px';
  box.style.top = '0px';
  box.style.width = '0px';
  box.style.height = '0px';
  return box;
}

function updateDragBox(box: HTMLDivElement, rect: RectBounds): void {
  const width = rect.right - rect.left;
  const height = rect.bottom - rect.top;

  box.style.left = `${rect.left}px`;
  box.style.top = `${rect.top}px`;
  box.style.width = `${width}px`;
  box.style.height = `${height}px`;
}

function createSelectionDecorations(doc: EditorState['doc'], blocks: readonly BlockRange[]): DecorationSet {
  if (blocks.length === 0) return DecorationSet.empty;
  const decorations = blocks.map((block) =>
    Decoration.node(block.from, block.to, {
      class: BLOCK_SELECTION_CLASS,
    }),
  );
  return DecorationSet.create(doc, decorations);
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

function mapSelectedBlocks(blocks: readonly BlockRange[], tr: Transaction): BlockRange[] {
  if (blocks.length === 0) return [];

  const mapped = blocks
    .map((block) => ({
      from: tr.mapping.map(block.from, 1),
      to: tr.mapping.map(block.to, -1),
    }))
    .filter((block) => block.to > block.from);

  return normalizeBlockRanges(mapped);
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

export const blankAreaDragBoxPlugin = $prose(() => {
  let stopSession: (() => void) | null = null;

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

    let dragBox: HTMLDivElement | null = null;
    let selectedBlocksKey = getBlockRangesKey(getPluginState(view.state).selectedBlocks);
    const rectResolver = createBlockRectResolver({
      view,
      scrollRootSelector: SCROLL_ROOT_SELECTOR,
    });

    const session = startBlockDragSession({
      view,
      event,
      startZone,
      dragThreshold: DRAG_THRESHOLD,
      cursor: DRAG_SESSION_CURSOR,
      onActivate() {
        dragBox = createDragBox();
        document.body.appendChild(dragBox);
        window.getSelection()?.removeAllRanges();
        setBlockSelectionVisualState(view, true);
        view.focus();
      },
      onDragMove(dragRect) {
        if (dragBox) {
          updateDragBox(dragBox, dragRect);
        }

        const selectedBlocks = resolveIntersectedBlockRanges(rectResolver.getTopLevelBlockRects(), dragRect);
        const nextKey = getBlockRangesKey(selectedBlocks);
        if (nextKey !== selectedBlocksKey) {
          selectedBlocksKey = nextKey;
          dispatchSelectionAction(view, selectedBlocks.length > 0
            ? { type: 'set-blocks', blocks: selectedBlocks }
            : CLEAR_BLOCKS_ACTION);
        }
      },
      onPlainClick(zone) {
        if (zone === 'below-last-block') {
          dispatchTailBlankClickAction(view);
          return;
        }
        clearBlockSelection(view);
      },
      onTeardown() {
        if (dragBox) {
          dragBox.remove();
          dragBox = null;
        }
        rectResolver.invalidate();
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
            decorations: createSelectionDecorations(tr.doc, selectedBlocks),
          };
        }

        if (!tr.docChanged || pluginState.selectedBlocks.length === 0) {
          return pluginState;
        }

        const selectedBlocks = mapSelectedBlocks(pluginState.selectedBlocks, tr);
        if (selectedBlocks.length === 0) return EMPTY_PLUGIN_STATE;
        return {
          selectedBlocks,
          decorations: createSelectionDecorations(tr.doc, selectedBlocks),
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
          const text = serializeSelectedBlocksToText(view.state, selectedBlocks);
          void writeTextToClipboard(text);
          return true;
        }

        if (hasPrimaryModifier && key === 'x') {
          event.preventDefault();
          const text = serializeSelectedBlocksToText(view.state, selectedBlocks);
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

          const text = serializeSelectedBlocksToText(view.state, selectedBlocks);
          setClipboardText(event, text);
          return true;
        },
        cut(view, event) {
          if (!isClipboardEvent(event)) return false;
          const { selectedBlocks } = getPluginState(view.state);
          if (selectedBlocks.length === 0) return false;

          const text = serializeSelectedBlocksToText(view.state, selectedBlocks);
          setClipboardText(event, text);
          return deleteSelectedBlocks(view, selectedBlocks);
        },
        mousedown(view, event) {
          if (!(event instanceof MouseEvent)) return false;
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
        const target = event.target;
        if (target instanceof Node && view.dom.contains(target)) return;
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
