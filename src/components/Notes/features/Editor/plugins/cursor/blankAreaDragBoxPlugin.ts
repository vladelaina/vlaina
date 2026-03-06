import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey, Selection, type EditorState, type Transaction } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet, type EditorView } from '@milkdown/kit/prose/view';
import { dispatchTailBlankClickAction, isClickBelowLastBlock } from './endBlankClickUtils';
import { serializeSliceToText } from '../clipboard/serializer';
import {
  createDragSelectionRect,
  getBlockRangesKey,
  normalizeBlockRanges,
  resolveIntersectedBlockRanges,
  type BlockRange,
  type BlockRect,
} from './blockSelectionUtils';

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

function getScrollRoot(element: HTMLElement | null): HTMLElement | null {
  if (!element) return null;
  return element.closest(SCROLL_ROOT_SELECTOR) as HTMLElement | null;
}

type DragStartZone = 'outside-editor' | 'below-last-block' | null;

function resolveDragStartZone(view: EditorView, event: MouseEvent): DragStartZone {
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

function updateDragBox(box: HTMLDivElement, startX: number, startY: number, x: number, y: number): void {
  const rect = createDragSelectionRect(startX, startY, x, y);
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
  dispatchSelectionAction(view, { type: 'clear-blocks' });
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

function resolveTopLevelBlockElement(view: EditorView, blockFrom: number): HTMLElement | null {
  const docSize = view.state.doc.content.size;
  if (docSize <= 0) return null;

  const probePos = Math.max(1, Math.min(blockFrom + 1, docSize));
  try {
    const domPos = view.domAtPos(probePos);
    let element =
      domPos.node instanceof HTMLElement ? domPos.node : domPos.node.parentElement;
    while (element && element.parentElement !== view.dom) {
      element = element.parentElement;
    }
    if (element && element.parentElement === view.dom) return element;
  } catch {
  }

  const nodeDom = view.nodeDOM(blockFrom);
  if (!(nodeDom instanceof HTMLElement)) return null;
  let element: HTMLElement | null = nodeDom;
  while (element && element.parentElement !== view.dom) {
    element = element.parentElement;
  }
  return element && element.parentElement === view.dom ? element : null;
}

function collectTopLevelBlockRects(view: EditorView): BlockRect[] {
  const blocks: BlockRect[] = [];
  view.state.doc.forEach((_node, offset) => {
    const from = offset;
    const to = offset + _node.nodeSize;
    const element = resolveTopLevelBlockElement(view, from);
    if (!element) return;

    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    blocks.push({
      from,
      to,
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
    });
  });
  return blocks;
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

function serializeSelectedBlocksToText(state: EditorState, blocks: readonly BlockRange[]): string {
  const normalized = normalizeBlockRanges(blocks);
  if (normalized.length === 0) return '';

  const pieces = normalized
    .map((block) => serializeSliceToText(state.doc.slice(block.from, block.to)))
    .filter((text) => text.length > 0);

  return pieces.join('\n');
}

function setClipboardText(event: ClipboardEvent, text: string): void {
  event.preventDefault();
  if (event.clipboardData) {
    event.clipboardData.setData('text/plain', text);
    return;
  }
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    void navigator.clipboard.writeText(text);
  }
}

async function writeTextToClipboard(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
    }
  }

  if (typeof document === 'undefined') return;
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  try {
    document.execCommand('copy');
  } finally {
    textarea.remove();
  }
}

function isClipboardEvent(event: Event): event is ClipboardEvent {
  return 'clipboardData' in event;
}

function deleteSelectedBlocks(view: EditorView, blocks: readonly BlockRange[]): boolean {
  const normalized = normalizeBlockRanges(blocks);
  if (normalized.length === 0) return false;

  let tr = view.state.tr;
  for (let i = normalized.length - 1; i >= 0; i -= 1) {
    tr = tr.delete(normalized[i].from, normalized[i].to);
  }

  if (tr.doc.content.size === 0) {
    const paragraphType = tr.doc.type.schema.nodes.paragraph;
    if (paragraphType) {
      tr = tr.insert(0, paragraphType.create());
    }
  }

  const anchorPos = Math.min(1, tr.doc.content.size);
  tr = tr.setSelection(Selection.near(tr.doc.resolve(anchorPos), 1));
  tr = tr.setMeta(blankAreaDragBoxPluginKey, { type: 'clear-blocks' } as BlockSelectionAction);
  view.dispatch(tr.scrollIntoView());
  view.focus();
  return true;
}

export const blankAreaDragBoxPlugin = $prose(() => {
  let stopSession: (() => void) | null = null;

  const clearSession = () => {
    if (!stopSession) return;
    stopSession();
    stopSession = null;
  };

  const tryStartSession = (view: EditorView, event: MouseEvent): DragStartZone => {
    if (event.button !== 0) return null;
    if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return null;
    const startZone = resolveDragStartZone(view, event);
    if (!startZone) return null;

    clearTextSelectionForDragSession(view);

    clearSession();

    const startX = event.clientX;
    const startY = event.clientY;
    let activated = false;
    let dragBox: HTMLDivElement | null = null;
    let selectedBlocksKey = getBlockRangesKey(getPluginState(view.state).selectedBlocks);
    const editorRoot = view.dom.closest('.milkdown-editor') as HTMLElement | null;
    const previousBodyCursor = document.body.style.cursor;
    const previousBodyUserSelect = document.body.style.userSelect;
    const previousViewCursor = view.dom.style.cursor;
    const previousEditorRootCursor = editorRoot?.style.cursor ?? '';
    document.body.style.cursor = DRAG_SESSION_CURSOR;
    view.dom.style.cursor = DRAG_SESSION_CURSOR;
    if (editorRoot) editorRoot.style.cursor = DRAG_SESSION_CURSOR;

    const teardown = () => {
      if (dragBox) {
        dragBox.remove();
        dragBox = null;
      }
      document.body.style.cursor = previousBodyCursor;
      document.body.style.userSelect = previousBodyUserSelect;
      view.dom.style.cursor = previousViewCursor;
      if (editorRoot) editorRoot.style.cursor = previousEditorRootCursor;
      document.removeEventListener('mousemove', handleMouseMove, true);
      document.removeEventListener('mouseup', handleMouseUp, true);
      syncBlockSelectionVisualState(view);
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if ((moveEvent.buttons & 1) === 0) {
        clearSession();
        return;
      }

      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      if (!activated && Math.hypot(dx, dy) < DRAG_THRESHOLD) {
        return;
      }

      if (!activated) {
        activated = true;
        dragBox = createDragBox();
        document.body.appendChild(dragBox);
        document.body.style.cursor = DRAG_SESSION_CURSOR;
        document.body.style.userSelect = 'none';
        window.getSelection()?.removeAllRanges();
        setBlockSelectionVisualState(view, true);
        view.focus();
      }

      moveEvent.preventDefault();
      if (dragBox) {
        updateDragBox(dragBox, startX, startY, moveEvent.clientX, moveEvent.clientY);
      }

      const dragRect = createDragSelectionRect(startX, startY, moveEvent.clientX, moveEvent.clientY);
      const selectedBlocks = resolveIntersectedBlockRanges(collectTopLevelBlockRects(view), dragRect);
      const nextKey = getBlockRangesKey(selectedBlocks);
      if (nextKey !== selectedBlocksKey) {
        selectedBlocksKey = nextKey;
        dispatchSelectionAction(view, selectedBlocks.length > 0
          ? { type: 'set-blocks', blocks: selectedBlocks }
          : { type: 'clear-blocks' });
      }
    };

    const handleMouseUp = () => {
      if (!activated && startZone === 'below-last-block') {
        dispatchTailBlankClickAction(view);
      } else if (!activated && startZone === 'outside-editor') {
        clearBlockSelection(view);
      }
      clearSession();
    };

    stopSession = teardown;
    document.addEventListener('mousemove', handleMouseMove, true);
    document.addEventListener('mouseup', handleMouseUp, true);
    if (startZone === 'below-last-block' || startZone === 'outside-editor') {
      event.preventDefault();
    }
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
