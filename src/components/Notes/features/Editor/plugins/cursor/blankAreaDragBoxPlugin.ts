import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey, type EditorState, type Transaction } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet, type EditorView } from '@milkdown/kit/prose/view';
import { dispatchTailBlankClickAction, isClickBelowLastBlock } from './endBlankClickUtils';
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
const BLOCK_SELECTION_CLASS = 'neko-block-selected';
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
  box.style.borderRadius = '2px';
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

    clearSession();

    const startX = event.clientX;
    const startY = event.clientY;
    let activated = false;
    let dragBox: HTMLDivElement | null = null;
    let selectedBlocksKey = getBlockRangesKey(getPluginState(view.state).selectedBlocks);
    const previousBodyCursor = document.body.style.cursor;
    const previousBodyUserSelect = document.body.style.userSelect;

    const teardown = () => {
      if (dragBox) {
        dragBox.remove();
        dragBox = null;
      }
      document.body.style.cursor = previousBodyCursor;
      document.body.style.userSelect = previousBodyUserSelect;
      document.removeEventListener('mousemove', handleMouseMove, true);
      document.removeEventListener('mouseup', handleMouseUp, true);
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
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'none';
        window.getSelection()?.removeAllRanges();
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
    if (startZone === 'below-last-block') {
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
      handleDOMEvents: {
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
        destroy() {
          doc.removeEventListener('mousedown', handleDocumentMouseDown, true);
          clearSession();
        },
      };
    },
  });
});
