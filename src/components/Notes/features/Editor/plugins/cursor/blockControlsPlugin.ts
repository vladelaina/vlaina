import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey, Selection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { blankAreaDragBoxPluginKey } from './blankAreaDragBoxPlugin';
import type { BlockRange } from './blockSelectionUtils';

export const blockControlsPluginKey = new PluginKey('blockControls');

const SCROLL_ROOT_SELECTOR = '[data-note-scroll-root="true"]';
const CONTROLS_LEFT_OFFSET = 44;
const CONTROLS_RIGHT_OFFSET = 10;
const HANDLE_BUTTON_SIZE = 24;

interface HoveredBlock {
  pos: number;
  rect: DOMRect;
  horizontalAlign: 'left' | 'right';
  verticalAlign: 'center' | 'top';
}

interface DropTarget {
  insertPos: number;
  lineY: number;
  lineLeft: number;
  lineWidth: number;
}

function resolveTopLevelBlockElement(view: EditorView, blockPos: number): HTMLElement | null {
  const docSize = view.state.doc.content.size;
  if (docSize <= 0) return null;

  const probePos = Math.max(1, Math.min(blockPos + 1, docSize));
  try {
    const domPos = view.domAtPos(probePos);
    let element = domPos.node instanceof HTMLElement ? domPos.node : domPos.node.parentElement;
    while (element && element.parentElement !== view.dom) {
      element = element.parentElement;
    }
    if (element && element.parentElement === view.dom) return element;
  } catch {
  }

  const nodeDom = view.nodeDOM(blockPos);
  if (!(nodeDom instanceof HTMLElement)) return null;

  let element: HTMLElement | null = nodeDom;
  while (element && element.parentElement !== view.dom) {
    element = element.parentElement;
  }
  return element && element.parentElement === view.dom ? element : null;
}

function normalizeTopLevelBlockPos(view: EditorView, pos: number): number | null {
  const docSize = view.state.doc.content.size;
  if (docSize <= 0) return null;

  const safePos = Math.max(0, Math.min(pos, docSize));
  try {
    const $pos = view.state.doc.resolve(safePos);
    let indexAtRoot = $pos.index(0);
    if (indexAtRoot >= view.state.doc.childCount) {
      indexAtRoot = view.state.doc.childCount - 1;
    }
    if (indexAtRoot < 0) return null;
    return $pos.posAtIndex(indexAtRoot, 0);
  } catch {
    return null;
  }
}

function resolveBlockByPos(
  view: EditorView,
  blockPos: number,
): HoveredBlock | null {
  const normalizedPos = normalizeTopLevelBlockPos(view, blockPos);
  if (normalizedPos === null) return null;

  const blockNode = view.state.doc.nodeAt(normalizedPos);
  if (!blockNode) return null;
  const blockElement = resolveTopLevelBlockElement(view, normalizedPos);
  if (!blockElement) return null;

  const rect = blockElement.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;

  return {
    pos: normalizedPos,
    rect,
    horizontalAlign: 'left',
    verticalAlign: 'center',
  };
}

function setControlsPosition(controls: HTMLElement, block: HoveredBlock): void {
  const { rect, horizontalAlign, verticalAlign } = block;
  const rawLeft = horizontalAlign === 'right'
    ? rect.right + CONTROLS_RIGHT_OFFSET
    : rect.left - CONTROLS_LEFT_OFFSET;
  const maxLeft = window.innerWidth - HANDLE_BUTTON_SIZE - 8;
  const left = Math.max(8, Math.min(rawLeft, maxLeft));
  const top = verticalAlign === 'top' ? rect.top + HANDLE_BUTTON_SIZE / 2 : rect.top + rect.height / 2;
  controls.style.left = `${Math.round(left)}px`;
  controls.style.top = `${Math.round(top)}px`;
}

interface BlockSelectionPluginState {
  selectedBlocks: BlockRange[];
}

function resolveActiveBlockAtPointer(view: EditorView, pointerY: number | null): HoveredBlock | null {
  const pluginState = blankAreaDragBoxPluginKey.getState(view.state) as BlockSelectionPluginState | undefined;
  if (!pluginState || !Array.isArray(pluginState.selectedBlocks)) return null;

  if (pluginState.selectedBlocks.length > 0) {
    const resolvedBlocks: HoveredBlock[] = [];
    for (const selected of pluginState.selectedBlocks) {
      const resolved = resolveBlockByPos(view, selected.from);
      if (resolved) resolvedBlocks.push(resolved);
    }
    if (resolvedBlocks.length === 0) return null;
    if (resolvedBlocks.length === 1) return resolvedBlocks[0];

    if (pointerY === null) {
      return {
        ...resolvedBlocks[0],
        horizontalAlign: 'left',
      };
    }

    let matched = resolvedBlocks.find((block) => pointerY >= block.rect.top && pointerY <= block.rect.bottom);
    if (!matched) {
      let minDistance = Number.POSITIVE_INFINITY;
      for (const block of resolvedBlocks) {
        const centerY = block.rect.top + block.rect.height / 2;
        const distance = Math.abs(pointerY - centerY);
        if (distance < minDistance) {
          minDistance = distance;
          matched = block;
        }
      }
    }
    if (!matched) return null;

    return {
      ...matched,
      horizontalAlign: 'left',
    };
  }

  return null;
}

function resolveDropTarget(view: EditorView, clientX: number, clientY: number): DropTarget | null {
  const pos = view.posAtCoords({ left: clientX, top: clientY });
  const editorRect = view.dom.getBoundingClientRect();

  if (!pos && clientY > editorRect.bottom) {
    let lastFrom = -1;
    let lastNodeSize = 0;
    view.state.doc.forEach((node, offset) => {
      lastFrom = offset;
      lastNodeSize = node.nodeSize;
    });
    if (lastFrom < 0) return null;

    const lastElement = resolveTopLevelBlockElement(view, lastFrom);
    const lineY = lastElement?.getBoundingClientRect().bottom ?? editorRect.bottom;
    const lineLeft = lastElement?.getBoundingClientRect().left ?? editorRect.left;
    const lineWidth = lastElement?.getBoundingClientRect().width ?? editorRect.width;
    return {
      insertPos: lastFrom + lastNodeSize,
      lineY,
      lineLeft,
      lineWidth,
    };
  }

  if (!pos) return null;

  const docSize = view.state.doc.content.size;
  const safePos = Math.max(0, Math.min(pos.pos, docSize));
  const $pos = view.state.doc.resolve(safePos);
  let indexAtRoot = $pos.index(0);
  if (indexAtRoot >= view.state.doc.childCount) {
    indexAtRoot = view.state.doc.childCount - 1;
  }
  if (indexAtRoot < 0) return null;

  const blockPos = $pos.posAtIndex(indexAtRoot, 0);
  const blockNode = view.state.doc.child(indexAtRoot);
  if (!blockNode) return null;

  const blockElement = resolveTopLevelBlockElement(view, blockPos);
  if (!blockElement) return null;
  const rect = blockElement.getBoundingClientRect();
  const insertBefore = clientY < rect.top + rect.height / 2;
  return {
    insertPos: insertBefore ? blockPos : blockPos + blockNode.nodeSize,
    lineY: insertBefore ? rect.top : rect.bottom,
    lineLeft: rect.left,
    lineWidth: rect.width,
  };
}

function applyBlockMove(view: EditorView, draggedPos: number, insertPos: number): boolean {
  const { state } = view;
  const blockNode = state.doc.nodeAt(draggedPos);
  if (!blockNode) return false;
  if (insertPos > draggedPos && insertPos <= draggedPos + blockNode.nodeSize) return false;

  let targetPos = insertPos;
  if (targetPos > draggedPos) {
    targetPos -= blockNode.nodeSize;
  }
  if (targetPos === draggedPos) return false;

  let tr = state.tr.delete(draggedPos, draggedPos + blockNode.nodeSize);
  tr = tr.insert(targetPos, blockNode);

  const selectionAnchor = Math.max(0, Math.min(targetPos + 1, tr.doc.content.size));
  tr = tr.setSelection(Selection.near(tr.doc.resolve(selectionAnchor), 1)).scrollIntoView();
  view.dispatch(tr);
  view.focus();
  return true;
}

export const blockControlsPlugin = $prose(() => {
  return new Plugin({
    key: blockControlsPluginKey,
    view(view) {
      const doc = view.dom.ownerDocument;
      const scrollRoot = view.dom.closest(SCROLL_ROOT_SELECTOR) as HTMLElement | null;
      const controls = doc.createElement('div');
      controls.className = 'neko-block-controls';
      controls.setAttribute('data-no-block-controls', 'true');
      controls.setAttribute('data-no-editor-drag-box', 'true');

      const handleButton = doc.createElement('button');
      handleButton.type = 'button';
      handleButton.className = 'neko-block-control-btn neko-block-control-handle';
      handleButton.setAttribute('aria-label', 'Drag block');
      handleButton.setAttribute('data-no-block-controls', 'true');
      handleButton.setAttribute('data-no-editor-drag-box', 'true');
      handleButton.draggable = true;
      handleButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="20" height="20" aria-hidden="true" focusable="false">
          <path d="M108,60A16,16,0,1,1,92,44,16,16,0,0,1,108,60Zm56,16a16,16,0,1,0-16-16A16,16,0,0,0,164,76ZM92,112a16,16,0,1,0,16,16A16,16,0,0,0,92,112Zm72,0a16,16,0,1,0,16,16A16,16,0,0,0,164,112ZM92,180a16,16,0,1,0,16,16A16,16,0,0,0,92,180Zm72,0a16,16,0,1,0,16,16A16,16,0,0,0,164,180Z" fill="currentColor"></path>
        </svg>
      `;

      controls.appendChild(handleButton);
      doc.body.appendChild(controls);

      const dropIndicator = doc.createElement('div');
      dropIndicator.className = 'neko-block-drop-indicator';
      dropIndicator.setAttribute('aria-hidden', 'true');
      doc.body.appendChild(dropIndicator);

      let selectedBlock: HoveredBlock | null = null;
      let draggedBlockPos: number | null = null;
      let pendingDrop: DropTarget | null = null;
      let pointerY: number | null = null;

      const hideControls = () => {
        selectedBlock = null;
        controls.classList.remove('visible');
      };

      const hideDropIndicator = () => {
        pendingDrop = null;
        dropIndicator.classList.remove('visible');
      };

      const showSelectedBlockControl = (block: HoveredBlock | null) => {
        if (!block) {
          hideControls();
          return;
        }
        selectedBlock = block;
        setControlsPosition(controls, block);
        controls.classList.add('visible');
      };

      const refreshSelectedBlockControl = () => {
        if (draggedBlockPos !== null) return;
        const next = resolveActiveBlockAtPointer(view, pointerY);
        showSelectedBlockControl(next);
      };

      const handleScrollOrResize = () => {
        if (draggedBlockPos !== null) {
          hideDropIndicator();
          return;
        }
        refreshSelectedBlockControl();
      };

      const handleDocumentDragOver = (event: DragEvent) => {
        if (draggedBlockPos === null) return;
        const target = resolveDropTarget(view, event.clientX, event.clientY);
        if (!target) {
          hideDropIndicator();
          return;
        }

        event.preventDefault();
        pendingDrop = target;
        dropIndicator.style.left = `${Math.round(target.lineLeft)}px`;
        dropIndicator.style.top = `${Math.round(target.lineY - 1)}px`;
        dropIndicator.style.width = `${Math.round(target.lineWidth)}px`;
        dropIndicator.classList.add('visible');
      };

      const handleDocumentMouseMove = (event: MouseEvent) => {
        pointerY = event.clientY;
        if (draggedBlockPos !== null) return;
        refreshSelectedBlockControl();
      };

      const finishDrag = () => {
        draggedBlockPos = null;
        controls.classList.remove('dragging');
        hideDropIndicator();
      };

      const handleDocumentDrop = (event: DragEvent) => {
        if (draggedBlockPos === null) return;
        event.preventDefault();
        if (!pendingDrop) {
          finishDrag();
          return;
        }
        applyBlockMove(view, draggedBlockPos, pendingDrop.insertPos);
        finishDrag();
        refreshSelectedBlockControl();
      };

      handleButton.addEventListener('mousedown', (event) => {
        event.stopPropagation();
      });

      handleButton.addEventListener('dragstart', (event) => {
        if (!selectedBlock) {
          event.preventDefault();
          return;
        }
        draggedBlockPos = selectedBlock.pos;
        controls.classList.add('dragging');
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', '');
        }
      });

      handleButton.addEventListener('dragend', () => {
        finishDrag();
      });

      doc.addEventListener('mousemove', handleDocumentMouseMove, true);
      doc.addEventListener('dragover', handleDocumentDragOver, true);
      doc.addEventListener('drop', handleDocumentDrop, true);
      scrollRoot?.addEventListener('scroll', handleScrollOrResize, { passive: true });
      window.addEventListener('resize', handleScrollOrResize);
      refreshSelectedBlockControl();

      return {
        update() {
          refreshSelectedBlockControl();
        },
        destroy() {
          doc.removeEventListener('mousemove', handleDocumentMouseMove, true);
          doc.removeEventListener('dragover', handleDocumentDragOver, true);
          doc.removeEventListener('drop', handleDocumentDrop, true);
          scrollRoot?.removeEventListener('scroll', handleScrollOrResize);
          window.removeEventListener('resize', handleScrollOrResize);
          controls.remove();
          dropIndicator.remove();
        },
      };
    },
  });
});
