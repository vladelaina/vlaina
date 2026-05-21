import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';

import type { TableMenuState } from './types';
import {
  isTableMenuAction,
  isTableMenuCellPosValid,
  runTableMenuAction,
} from './tableMenuActions';
import { shouldIgnoreTableContextMenuTarget } from './tableContextMenuTarget';
import { translate } from '@/lib/i18n';

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
      let lastRenderKey = '';

      const closeMenu = () => {
        const menuState = tablePluginKey.getState(editorView.state);
        if (!menuElement && !menuState?.isOpen) {
          return;
        }
        if (menuElement) {
          menuElement.remove();
          menuElement = null;
        }
        lastRenderKey = '';
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

      const handleMenuClick = (event: MouseEvent) => {
        const target = event.target;
        const button = target instanceof Element
          ? target.closest<HTMLElement>('.table-menu-item[data-action]')
          : null;
        if (!button || !menuElement?.contains(button)) {
          return;
        }

        const action = button.dataset.action || '';
        if (!isTableMenuAction(action)) {
          closeMenu();
          return;
        }
        const menuState = tablePluginKey.getState(editorView.state);
        if (menuState && menuState.cellPos >= 0) {
          runTableMenuAction(action, editorView, menuState.cellPos);
        }
        closeMenu();
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
            lastRenderKey = '';
            return;
          }

          if (state.cellPos < 0 || !isTableMenuCellPosValid(editorView, state.cellPos)) {
            closeMenu();
            return;
          }

          if (!menuElement) {
            menuElement = document.createElement('div');
            menuElement.className = 'table-context-menu';
            menuElement.addEventListener('click', handleMenuClick);
            document.body.appendChild(menuElement);
          }

          const renderKey = `${state.position.x}:${state.position.y}:${state.cellPos}`;
          if (renderKey !== lastRenderKey) {
            lastRenderKey = renderKey;
            menuElement.style.left = `${state.position.x}px`;
            menuElement.style.top = `${state.position.y}px`;
            menuElement.innerHTML = `
              <button class="table-menu-item" data-action="insert-row-above">${translate('editor.table.insertRowAbove')}</button>
              <button class="table-menu-item" data-action="insert-row-below">${translate('editor.table.insertRowBelow')}</button>
              <button class="table-menu-item" data-action="insert-col-left">${translate('editor.table.insertColumnLeft')}</button>
              <button class="table-menu-item" data-action="insert-col-right">${translate('editor.table.insertColumnRight')}</button>
              <div class="table-menu-divider"></div>
              <button class="table-menu-item danger" data-action="delete-row">${translate('editor.table.deleteRow')}</button>
              <button class="table-menu-item danger" data-action="delete-col">${translate('editor.table.deleteColumn')}</button>
              <button class="table-menu-item danger" data-action="delete-table">${translate('editor.table.deleteTable')}</button>
            `;
          }
        },
        destroy() {
          document.removeEventListener('click', handleClickOutside);
          if (menuElement) {
            menuElement.removeEventListener('click', handleMenuClick);
            menuElement.remove();
          }
        },
      };
    },
  });
});
