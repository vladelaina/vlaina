import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { $prose } from '@milkdown/kit/utils';
import { blankAreaDragBoxPluginKey } from './blankAreaDragBoxPlugin';
import { getBlockRangesKey, normalizeBlockRanges, type BlockRange } from './blockSelectionUtils';
import { pickPointerBlock } from './blockControlsUtils';
import {
  applyBlockMove,
  getDraggableBlockRanges,
  resolveBlockTargetByPos,
  resolveDropTarget,
  setControlsPosition,
  type DropTarget,
  type HandleBlockTarget,
} from './blockControlsInteractions';

export const blockControlsPluginKey = new PluginKey('blockControls');

const SCROLL_ROOT_SELECTOR = '[data-note-scroll-root="true"]';
const CONTROLS_LEFT_OFFSET = 44;

interface BlockSelectionPluginState {
  selectedBlocks: BlockRange[];
}

function getSelectedBlockRanges(view: EditorView): BlockRange[] {
  const pluginState = blankAreaDragBoxPluginKey.getState(view.state) as BlockSelectionPluginState | undefined;
  if (!pluginState || !Array.isArray(pluginState.selectedBlocks)) return [];
  return normalizeBlockRanges(pluginState.selectedBlocks);
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

      let draggedRanges: BlockRange[] | null = null;
      let pendingDrop: DropTarget | null = null;
      let pointerY: number | null = null;
      let refreshRafId = 0;

      let cachedTargets: HandleBlockTarget[] = [];
      let cachedSelectionKey = '';
      let cachedDoc = view.state.doc;
      let cachedScrollLeft = Number.NaN;
      let cachedScrollTop = Number.NaN;

      const hideControls = () => {
        controls.classList.remove('visible');
      };

      const hideDropIndicator = () => {
        pendingDrop = null;
        dropIndicator.classList.remove('visible');
      };

      const invalidateTargetCache = () => {
        cachedTargets = [];
        cachedSelectionKey = '';
        cachedDoc = view.state.doc;
        cachedScrollLeft = Number.NaN;
        cachedScrollTop = Number.NaN;
      };

      const getCachedHandleTargets = (): HandleBlockTarget[] => {
        const draggableRanges = getDraggableBlockRanges(view, getSelectedBlockRanges(view));
        if (draggableRanges.length === 0) return [];

        const selectionKey = getBlockRangesKey(draggableRanges);
        const nextScrollLeft = scrollRoot?.scrollLeft ?? 0;
        const nextScrollTop = scrollRoot?.scrollTop ?? 0;
        if (
          cachedSelectionKey === selectionKey
          && cachedDoc === view.state.doc
          && cachedScrollLeft === nextScrollLeft
          && cachedScrollTop === nextScrollTop
        ) {
          return cachedTargets;
        }

        cachedSelectionKey = selectionKey;
        cachedDoc = view.state.doc;
        cachedScrollLeft = nextScrollLeft;
        cachedScrollTop = nextScrollTop;
        cachedTargets = draggableRanges
          .map((range) => resolveBlockTargetByPos(view, range.from))
          .filter((target): target is HandleBlockTarget => target !== null);
        return cachedTargets;
      };

      const showHandleForPointer = () => {
        if (draggedRanges) return;
        const targets = getCachedHandleTargets();
        const nextTarget = pickPointerBlock(targets, pointerY);
        if (!nextTarget) {
          hideControls();
          return;
        }
        setControlsPosition(controls, nextTarget, CONTROLS_LEFT_OFFSET);
        controls.classList.add('visible');
      };

      const scheduleHandleRefresh = () => {
        if (refreshRafId !== 0) return;
        refreshRafId = window.requestAnimationFrame(() => {
          refreshRafId = 0;
          showHandleForPointer();
        });
      };

      const handleDocumentMouseMove = (event: MouseEvent) => {
        pointerY = event.clientY;
        if (draggedRanges) return;
        scheduleHandleRefresh();
      };

      const handleScrollOrResize = () => {
        if (draggedRanges) {
          hideDropIndicator();
          return;
        }
        invalidateTargetCache();
        scheduleHandleRefresh();
      };

      const handleDocumentDragOver = (event: DragEvent) => {
        if (!draggedRanges) return;
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

      const finishDrag = () => {
        draggedRanges = null;
        controls.classList.remove('dragging');
        hideDropIndicator();
      };

      const handleDocumentDrop = (event: DragEvent) => {
        if (!draggedRanges) return;
        event.preventDefault();
        if (!pendingDrop) {
          finishDrag();
          return;
        }
        applyBlockMove(view, draggedRanges, pendingDrop.insertPos);
        finishDrag();
        invalidateTargetCache();
        scheduleHandleRefresh();
      };

      handleButton.addEventListener('mousedown', (event) => {
        event.stopPropagation();
      });

      handleButton.addEventListener('dragstart', (event) => {
        const draggableRanges = getDraggableBlockRanges(view, getSelectedBlockRanges(view));
        if (draggableRanges.length === 0) {
          event.preventDefault();
          return;
        }

        draggedRanges = draggableRanges;
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
      scheduleHandleRefresh();

      return {
        update() {
          invalidateTargetCache();
          scheduleHandleRefresh();
        },
        destroy() {
          if (refreshRafId !== 0) {
            window.cancelAnimationFrame(refreshRafId);
            refreshRafId = 0;
          }
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
