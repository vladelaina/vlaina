import type { PluginKey } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';

import { translate } from '@/lib/i18n';
import { themeContextMenuTokens } from '@/styles/themeTokens';
import { escapeToolbarHtml } from '../floating-toolbar/htmlEscape';
import {
  isTableMenuAction,
  isTableMenuCellPosValid,
  runTableMenuAction,
} from './tableMenuActions';
import type { TableMenuState } from './types';

const TABLE_CONTEXT_MENU_MARGIN = 8;

function getTableShortcutLabel(keys: string): string {
  const platform = typeof navigator === 'undefined' ? '' : navigator.platform;
  if (!/Mac|iPhone|iPad/.test(platform)) return keys;
  return keys
    .replace('Ctrl', '⌘')
    .replaceAll('+Shift', '⇧')
    .replaceAll('+Alt', '⌥')
    .replaceAll('+', '');
}

function createTableMenuButton(
  action: string,
  label: string,
  options: { danger?: boolean; shortcut?: string } = {},
): string {
  const className = options.danger ? 'table-menu-item danger' : 'table-menu-item';
  const shortcut = options.shortcut
    ? `<span class="table-menu-shortcut">${escapeToolbarHtml(getTableShortcutLabel(options.shortcut))}</span>`
    : '';
  return `<button class="${className}" type="button" role="menuitem" data-action="${action}"><span>${escapeToolbarHtml(label)}</span>${shortcut}</button>`;
}

export function resolveTableContextMenuPosition({
  x,
  y,
  menuWidth,
  menuHeight,
  viewportWidth,
  viewportHeight,
}: {
  x: number;
  y: number;
  menuWidth: number;
  menuHeight: number;
  viewportWidth: number;
  viewportHeight: number;
}) {
  const maxLeft = Math.max(
    TABLE_CONTEXT_MENU_MARGIN,
    viewportWidth - menuWidth - TABLE_CONTEXT_MENU_MARGIN,
  );
  const maxTop = Math.max(
    TABLE_CONTEXT_MENU_MARGIN,
    viewportHeight - menuHeight - TABLE_CONTEXT_MENU_MARGIN,
  );

  return {
    left: Math.min(Math.max(x, TABLE_CONTEXT_MENU_MARGIN), maxLeft),
    top: Math.min(Math.max(y, TABLE_CONTEXT_MENU_MARGIN), maxTop),
  };
}

export function createTableContextMenuView(
  editorView: EditorView,
  pluginKey: PluginKey<TableMenuState>,
  openEventName: string,
) {
  let menuElement: HTMLElement | null = null;
  let lastRenderKey = '';

  const openMenu = (cellPos: number, x: number, y: number) => {
    if (!editorView.editable || !isTableMenuCellPosValid(editorView, cellPos)) return;
    editorView.dispatch(
      editorView.state.tr.setMeta(pluginKey, {
        isOpen: true,
        position: { x, y },
        cellPos,
      }),
    );
  };

  const handleExternalOpen = (event: Event) => {
    const detail = (event as CustomEvent<{ cellPos?: number; x?: number; y?: number }>).detail;
    if (
      typeof detail?.cellPos !== 'number'
      || typeof detail.x !== 'number'
      || typeof detail.y !== 'number'
    ) return;
    openMenu(detail.cellPos, detail.x, detail.y);
  };

  const positionMenuElement = (
    element: HTMLElement,
    position: { x: number; y: number },
  ) => {
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const resolved = resolveTableContextMenuPosition({
      x: position.x,
      y: position.y,
      menuWidth: element.offsetWidth || themeContextMenuTokens.tableMenuWidth,
      menuHeight: element.offsetHeight || 0,
      viewportWidth,
      viewportHeight,
    });

    element.style.left = `${resolved.left}px`;
    element.style.top = `${resolved.top}px`;
  };

  const closeMenu = () => {
    const menuState = pluginKey.getState(editorView.state);
    if (!menuElement && !menuState?.isOpen) return;
    if (menuElement) {
      menuElement.remove();
      menuElement = null;
    }
    lastRenderKey = '';
    editorView.dispatch(
      editorView.state.tr.setMeta(pluginKey, {
        isOpen: false,
        position: { x: 0, y: 0 },
        cellPos: -1,
      }),
    );
  };

  const handleClickOutside = (event: MouseEvent) => {
    if (menuElement && !menuElement.contains(event.target as Node)) closeMenu();
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (!event.isComposing && event.key === 'Escape') closeMenu();
  };

  const handleMenuClick = (event: MouseEvent) => {
    const target = event.target;
    const button = target instanceof Element
      ? target.closest<HTMLElement>('.table-menu-item[data-action]')
      : null;
    if (!button || !menuElement?.contains(button)) return;

    if (!editorView.editable) {
      closeMenu();
      return;
    }

    const action = button.dataset.action || '';
    if (!isTableMenuAction(action)) {
      closeMenu();
      return;
    }
    const menuState = pluginKey.getState(editorView.state);
    if (menuState && menuState.cellPos >= 0) {
      runTableMenuAction(action, editorView, menuState.cellPos);
    }
    closeMenu();
  };

  editorView.dom.addEventListener(openEventName, handleExternalOpen);
  window.addEventListener('mousedown', handleClickOutside, true);
  window.addEventListener('keydown', handleKeyDown, true);

  return {
    update() {
      const state = pluginKey.getState(editorView.state);
      if (!state?.isOpen) {
        if (menuElement) {
          menuElement.remove();
          menuElement = null;
        }
        lastRenderKey = '';
        return;
      }

      if (!editorView.editable || state.cellPos < 0) {
        closeMenu();
        return;
      }
      if (!isTableMenuCellPosValid(editorView, state.cellPos)) {
        closeMenu();
        return;
      }

      if (!menuElement) {
        menuElement = document.createElement('div');
        menuElement.className = 'table-context-menu';
        menuElement.setAttribute('data-no-editor-drag-box', 'true');
        menuElement.addEventListener('click', handleMenuClick);
        document.body.appendChild(menuElement);
      }

      const renderKey = `${state.position.x}:${state.position.y}:${state.cellPos}`;
      if (renderKey === lastRenderKey) return;
      lastRenderKey = renderKey;
      menuElement.innerHTML = `
        ${createTableMenuButton('insert-row-above', translate('editor.table.insertRowAbove'))}
        ${createTableMenuButton('insert-row-below', translate('editor.table.insertRowBelow'), { shortcut: 'Ctrl+Enter' })}
        ${createTableMenuButton('insert-col-left', translate('editor.table.insertColumnLeft'))}
        ${createTableMenuButton('insert-col-right', translate('editor.table.insertColumnRight'))}
        <div class="table-menu-divider"></div>
        ${createTableMenuButton('delete-row', translate('editor.table.deleteRow'), { danger: true, shortcut: 'Ctrl+Shift+Backspace' })}
        ${createTableMenuButton('delete-col', translate('editor.table.deleteColumn'), { danger: true })}
        ${createTableMenuButton('delete-table', translate('editor.table.deleteTable'), { danger: true })}
      `;
      menuElement.setAttribute('role', 'menu');
      menuElement.setAttribute('aria-orientation', 'vertical');
      positionMenuElement(menuElement, state.position);
    },
    destroy() {
      editorView.dom.removeEventListener(openEventName, handleExternalOpen);
      window.removeEventListener('mousedown', handleClickOutside, true);
      window.removeEventListener('keydown', handleKeyDown, true);
      if (menuElement) {
        menuElement.removeEventListener('click', handleMenuClick);
        menuElement.remove();
      }
    },
  };
}
