// Drag handle plugin for block reordering
import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import type { DragHandleState } from './types';

export const dragPluginKey = new PluginKey<DragHandleState>('dragHandle');

export const dragPlugin = $prose(() => {
  // Throttle state for mousemove - avoid excessive dispatches
  let lastUpdateTime = 0;
  let pendingUpdate: { visible: boolean; position?: { x: number; y: number }; nodePos?: number } | null = null;
  let rafId: number | null = null;
  
  const THROTTLE_MS = 16; // ~60fps
  
  return new Plugin({
    key: dragPluginKey,
    state: {
      init: () => ({
        visible: false,
        position: { x: 0, y: 0 },
        nodePos: -1
      }),
      apply(tr, state) {
        const meta = tr.getMeta(dragPluginKey);
        if (meta) {
          return { ...state, ...meta };
        }
        return state;
      }
    },
    props: {
      handleDOMEvents: {
        mousemove(view, event) {
          const now = performance.now();
          
          // Calculate new state without dispatching
          const pos = view.posAtCoords({ left: event.clientX, top: event.clientY });
          if (!pos) {
            pendingUpdate = { visible: false };
          } else {
            const $pos = view.state.doc.resolve(pos.pos);
            let depth = $pos.depth;
            while (depth > 1) depth--;
            
            if (depth < 1) {
              pendingUpdate = { visible: false };
            } else {
              const nodePos = $pos.before(depth);
              const node = view.state.doc.nodeAt(nodePos);
              
              if (!node || (node.type.name === 'heading' && node.attrs.level === 1)) {
                pendingUpdate = { visible: false };
              } else {
                const coords = view.coordsAtPos(nodePos);
                pendingUpdate = {
                  visible: true,
                  position: { x: coords.left - 24, y: coords.top },
                  nodePos
                };
              }
            }
          }
          
          // Throttle dispatches using RAF
          if (now - lastUpdateTime >= THROTTLE_MS && pendingUpdate) {
            if (rafId !== null) {
              cancelAnimationFrame(rafId);
            }
            rafId = requestAnimationFrame(() => {
              if (pendingUpdate) {
                view.dispatch(view.state.tr.setMeta(dragPluginKey, pendingUpdate));
                lastUpdateTime = performance.now();
                pendingUpdate = null;
              }
              rafId = null;
            });
          }
          
          return false;
        },
        mouseleave(view) {
          if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
          }
          pendingUpdate = null;
          view.dispatch(view.state.tr.setMeta(dragPluginKey, { visible: false }));
          return false;
        }
      }
    },
    view(editorView) {
      let handleElement: HTMLElement | null = null;
      let draggedNodePos: number | null = null;
      let dropIndicator: HTMLElement | null = null;
      
      const createHandle = () => {
        const handle = document.createElement('div');
        handle.className = 'drag-handle';
        handle.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="6" r="2"/><circle cx="15" cy="6" r="2"/>
          <circle cx="9" cy="12" r="2"/><circle cx="15" cy="12" r="2"/>
          <circle cx="9" cy="18" r="2"/><circle cx="15" cy="18" r="2"/>
        </svg>`;
        handle.draggable = true;
        
        handle.addEventListener('dragstart', (e) => {
          const state = dragPluginKey.getState(editorView.state);
          if (!state || state.nodePos < 0) return;
          
          draggedNodePos = state.nodePos;
          handle.classList.add('dragging');
          
          e.dataTransfer?.setData('text/plain', '');
          e.dataTransfer!.effectAllowed = 'move';
        });
        
        handle.addEventListener('dragend', () => {
          handle.classList.remove('dragging');
          draggedNodePos = null;
          if (dropIndicator) {
            dropIndicator.remove();
            dropIndicator = null;
          }
        });
        
        return handle;
      };
      
      const editorContainer = editorView.dom.parentElement;
      
      if (editorContainer) {
        editorContainer.addEventListener('dragover', (e) => {
          if (draggedNodePos === null) return;
          
          e.preventDefault();
          e.dataTransfer!.dropEffect = 'move';
          
          const pos = editorView.posAtCoords({ left: e.clientX, top: e.clientY });
          if (!pos) return;
          
          const $pos = editorView.state.doc.resolve(pos.pos);
          let depth = $pos.depth;
          while (depth > 1) depth--;
          
          if (depth < 1) return;
          
          const targetPos = $pos.before(depth);
          const coords = editorView.coordsAtPos(targetPos);
          
          if (!dropIndicator) {
            dropIndicator = document.createElement('div');
            dropIndicator.className = 'drop-indicator';
            document.body.appendChild(dropIndicator);
          }
          
          dropIndicator.style.left = `${coords.left}px`;
          dropIndicator.style.top = `${coords.top - 2}px`;
          dropIndicator.style.width = `${editorView.dom.clientWidth}px`;
        });
        
        editorContainer.addEventListener('drop', (e) => {
          if (draggedNodePos === null) return;
          
          e.preventDefault();
          
          const pos = editorView.posAtCoords({ left: e.clientX, top: e.clientY });
          if (!pos) return;
          
          const $pos = editorView.state.doc.resolve(pos.pos);
          let depth = $pos.depth;
          while (depth > 1) depth--;
          
          if (depth < 1) return;
          
          const targetPos = $pos.before(depth);
          
          if (targetPos === draggedNodePos) return;
          
          const { state } = editorView;
          const node = state.doc.nodeAt(draggedNodePos);
          
          if (!node) return;
          
          let tr = state.tr;
          tr = tr.delete(draggedNodePos, draggedNodePos + node.nodeSize);
          
          let adjustedTarget = targetPos;
          if (targetPos > draggedNodePos) {
            adjustedTarget -= node.nodeSize;
          }
          
          tr = tr.insert(adjustedTarget, node);
          editorView.dispatch(tr);
          
          if (dropIndicator) {
            dropIndicator.remove();
            dropIndicator = null;
          }
          
          draggedNodePos = null;
        });
      }
      
      return {
        update() {
          const state = dragPluginKey.getState(editorView.state);
          
          if (!state?.visible) {
            if (handleElement) {
              handleElement.style.display = 'none';
            }
            return;
          }
          
          if (!handleElement) {
            handleElement = createHandle();
            document.body.appendChild(handleElement);
          }
          
          handleElement.style.display = 'flex';
          handleElement.style.left = `${state.position.x}px`;
          handleElement.style.top = `${state.position.y}px`;
        },
        destroy() {
          if (rafId !== null) {
            cancelAnimationFrame(rafId);
          }
          if (handleElement) {
            handleElement.remove();
          }
          if (dropIndicator) {
            dropIndicator.remove();
          }
        }
      };
    }
  });
});