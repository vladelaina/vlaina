import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';

import type { TableMenuState } from './types';
import {
  isTableMenuAction,
  isTableMenuCellPosValid,
  runTableMenuAction,
} from './tableMenuActions';
import { shouldIgnoreTableContextMenuTarget } from './tableContextMenuTarget';

export const tablePluginKey = new PluginKey<TableMenuState>('tableMenu');

export const tableContextMenuPlugin = $prose(() => {
  return new Plugin({
    key: tablePluginKey,
    state: {
      init: () => ({
        isOpen: false,
        position: { x: 0, y: 0 },
        cellPos: -1,
      }),
      apply(tr, state) {
        const meta = tr.getMeta(tablePluginKey);
        if (meta) {
          return { ...state, ...meta };
        }
        return state;
      },
    },
    props: {
      handleDOMEvents: {
        contextmenu(view, event) {
          if (shouldIgnoreTableContextMenuTarget(event.target)) {
            event.preventDefault();
            return true;
          }

          const { state } = view;
          const pos = view.posAtCoords({ left: event.clientX, top: event.clientY });
          if (!pos) return false;

          const $pos = state.doc.resolve(pos.pos);
          for (let depth = $pos.depth; depth > 0; depth--) {
            const node = $pos.node(depth);
            if (node.type.name !== 'table_cell' && node.type.name !== 'table_header') {
              continue;
            }

            event.preventDefault();
            view.dispatch(
              state.tr.setMeta(tablePluginKey, {
                isOpen: true,
                position: { x: event.clientX, y: event.clientY },
                cellPos: $pos.before(depth),
              })
            );
            return true;
          }

          return false;
        },
      },
    },
    view(editorView) {
      let menuElement: HTMLElement | null = null;

      const closeMenu = () => {
        const menuState = tablePluginKey.getState(editorView.state);
        if (!menuElement && !menuState?.isOpen) {
          return;
        }
        if (menuElement) {
          menuElement.remove();
          menuElement = null;
        }
        editorView.dispatch(
          editorView.state.tr.setMeta(tablePluginKey, {
            isOpen: false,
            position: { x: 0, y: 0 },
            cellPos: -1,
          })
        );
      };

      const handleClickOutside = (event: MouseEvent) => {
        if (menuElement && !menuElement.contains(event.target as Node)) {
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

          if (state.cellPos < 0 || !isTableMenuCellPosValid(editorView, state.cellPos)) {
            closeMenu();
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

          menuElement.querySelectorAll('.table-menu-item').forEach((button) => {
            button.addEventListener('click', () => {
              const action = (button as HTMLElement).dataset.action || '';
              if (!isTableMenuAction(action)) {
                closeMenu();
                return;
              }
              const menuState = tablePluginKey.getState(editorView.state);
              if (menuState && menuState.cellPos >= 0) {
                runTableMenuAction(action, editorView, menuState.cellPos);
              }
              closeMenu();
            });
          });
        },
        destroy() {
          document.removeEventListener('click', handleClickOutside);
          if (menuElement) {
            menuElement.remove();
          }
        },
      };
    },
  });
});
