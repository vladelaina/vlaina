// Enhanced table plugin
import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { Selection } from '@milkdown/kit/prose/state';
import type { TableMenuState } from './types';

export const tablePluginKey = new PluginKey<TableMenuState>('tableMenu');

// Table enhancement plugin for better interactions
export const tablePlugin = $prose(() => {
  return new Plugin({
    key: tablePluginKey,
    state: {
      init: () => ({
        isOpen: false,
        position: { x: 0, y: 0 },
        cellPos: -1
      }),
      apply(tr, state) {
        const meta = tr.getMeta(tablePluginKey);
        if (meta) {
          return { ...state, ...meta };
        }
        return state;
      }
    },
    props: {
      handleKeyDown(view, event) {
        const { state } = view;
        const { selection } = state;
        const { $from } = selection;
        
        // Check if we're in a table cell
        let depth = $from.depth;
        let inTable = false;
        while (depth > 0) {
          const node = $from.node(depth);
          if (node.type.name === 'table_cell' || node.type.name === 'table_header') {
            inTable = true;
            break;
          }
          depth--;
        }
        
        if (!inTable) return false;
        
        // Tab navigation in tables
        if (event.key === 'Tab') {
          event.preventDefault();
          
          const { doc } = state;
          const cellPos = $from.before(depth);
          const cell = doc.nodeAt(cellPos);
          
          if (!cell) return false;
          
          // Find next/prev cell
          const tableStart = $from.start(depth - 2);
          const table = doc.nodeAt(tableStart - 1);
          
          if (!table) return false;
          
          let targetPos: number | null = null;
          const cells: number[] = [];
          
          table.descendants((node, pos) => {
            if (node.type.name === 'table_cell' || node.type.name === 'table_header') {
              cells.push(tableStart + pos);
            }
            return true;
          });
          
          const currentIndex = cells.indexOf(cellPos);
          
          if (event.shiftKey) {
            // Previous cell
            if (currentIndex > 0) {
              targetPos = cells[currentIndex - 1];
            }
          } else {
            // Next cell
            if (currentIndex < cells.length - 1) {
              targetPos = cells[currentIndex + 1];
            }
          }
          
          if (targetPos !== null) {
            const $target = doc.resolve(targetPos + 1);
            const newSelection = Selection.near($target);
            view.dispatch(state.tr.setSelection(newSelection));
          }
          
          return true;
        }
        
        return false;
      },
      handleDOMEvents: {
        contextmenu(view, event) {
          const { state } = view;
          const pos = view.posAtCoords({ left: event.clientX, top: event.clientY });
          
          if (!pos) return false;
          
          const $pos = state.doc.resolve(pos.pos);
          let depth = $pos.depth;
          
          while (depth > 0) {
            const node = $pos.node(depth);
            if (node.type.name === 'table_cell' || node.type.name === 'table_header') {
              event.preventDefault();
              
              view.dispatch(
                state.tr.setMeta(tablePluginKey, {
                  isOpen: true,
                  position: { x: event.clientX, y: event.clientY },
                  cellPos: $pos.before(depth)
                })
              );
              
              return true;
            }
            depth--;
          }
          
          return false;
        }
      }
    },
    view(editorView) {
      let menuElement: HTMLElement | null = null;
      
      const closeMenu = () => {
        if (menuElement) {
          menuElement.remove();
          menuElement = null;
        }
        editorView.dispatch(
          editorView.state.tr.setMeta(tablePluginKey, {
            isOpen: false,
            position: { x: 0, y: 0 },
            cellPos: -1
          })
        );
      };
      
      const handleClickOutside = (e: MouseEvent) => {
        if (menuElement && !menuElement.contains(e.target as Node)) {
          closeMenu();
        }
      };
      
      document.addEventListener('click', handleClickOutside);
      
      return {
        update() {
          const state = tablePluginKey.getState(editorView.state);
          
          if (!state?.isOpen) {
            if (menuElement) {
              menuElement.remove();
              menuElement = null;
            }
            return;
          }
          
          if (!menuElement) {
            menuElement = document.createElement('div');
            menuElement.className = 'table-context-menu';
            document.body.appendChild(menuElement);
          }
          
          menuElement.style.left = `${state.position.x}px`;
          menuElement.style.top = `${state.position.y}px`;
          
          menuElement.innerHTML = `
            <button class="table-menu-item" data-action="insert-row-above">Insert row above</button>
            <button class="table-menu-item" data-action="insert-row-below">Insert row below</button>
            <button class="table-menu-item" data-action="insert-col-left">Insert column left</button>
            <button class="table-menu-item" data-action="insert-col-right">Insert column right</button>
            <div class="table-menu-divider"></div>
            <button class="table-menu-item danger" data-action="delete-row">Delete row</button>
            <button class="table-menu-item danger" data-action="delete-col">Delete column</button>
            <button class="table-menu-item danger" data-action="delete-table">Delete table</button>
          `;
          
          menuElement.querySelectorAll('.table-menu-item').forEach(btn => {
            btn.addEventListener('click', () => {
              // Table commands would be executed here based on data-action
              closeMenu();
            });
          });
        },
        destroy() {
          document.removeEventListener('click', handleClickOutside);
          if (menuElement) {
            menuElement.remove();
          }
        }
      };
    }
  });
});
