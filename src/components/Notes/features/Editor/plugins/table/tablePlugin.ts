// Enhanced table plugin
import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey, TextSelection } from '@milkdown/kit/prose/state';
import { Selection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import {
  addColumnAfter,
  addColumnBefore,
  addRowAfter,
  addRowBefore,
  deleteColumn,
  deleteRow,
  deleteTable,
} from '@milkdown/kit/prose/tables';
import type { TableMenuState } from './types';
import { createEmptyTableNode, getPipeShortcutColumnCount } from './pipeTableShortcut';
import { findLeadingTableDeleteRange } from './tableDeleteShortcut';
import { handleTableSelectAll } from './tableSelectAll';

export const tablePluginKey = new PluginKey<TableMenuState>('tableMenu');

export type TableMenuAction =
  | 'insert-row-above'
  | 'insert-row-below'
  | 'insert-col-left'
  | 'insert-col-right'
  | 'delete-row'
  | 'delete-col'
  | 'delete-table';

type TableCommand = (state: Parameters<typeof addRowBefore>[0], dispatch?: Parameters<typeof addRowBefore>[1]) => boolean;

function resolveTableActionCommand(action: TableMenuAction): TableCommand {
  switch (action) {
    case 'insert-row-above':
      return addRowBefore;
    case 'insert-row-below':
      return addRowAfter;
    case 'insert-col-left':
      return addColumnBefore;
    case 'insert-col-right':
      return addColumnAfter;
    case 'delete-row':
      return deleteRow;
    case 'delete-col':
      return deleteColumn;
    case 'delete-table':
      return deleteTable;
    default:
      return () => false;
  }
}

function isTableMenuAction(value: string): value is TableMenuAction {
  return [
    'insert-row-above',
    'insert-row-below',
    'insert-col-left',
    'insert-col-right',
    'delete-row',
    'delete-col',
    'delete-table',
  ].includes(value);
}

function runTableMenuAction(
  action: TableMenuAction,
  view: EditorView,
  cellPos: number,
): boolean {
  const docSize = view.state.doc.content.size;
  const safePos = Math.max(0, Math.min(cellPos + 1, docSize));
  const tr = view.state.tr.setSelection(Selection.near(view.state.doc.resolve(safePos), 1));
  view.dispatch(tr);
  const command = resolveTableActionCommand(action);
  return command(view.state, view.dispatch);
}

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

        if (handleTableSelectAll(view, event)) {
          return true;
        }

        if (
          event.key === 'Backspace' &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.altKey
        ) {
          const deleteRange = findLeadingTableDeleteRange(state);
          if (!deleteRange) return false;

          event.preventDefault();
          const paragraphType = state.schema.nodes.paragraph;
          let tr =
            paragraphType
              ? state.tr.replaceWith(deleteRange.from, deleteRange.to, paragraphType.create())
              : state.tr.delete(deleteRange.from, deleteRange.to);

          if (tr.doc.content.size === 0 && paragraphType) {
            tr = tr.insert(0, paragraphType.create());
          }

          const anchorPos = Math.max(
            0,
            Math.min(deleteRange.from + 1, tr.doc.content.size)
          );
          const resolvedAnchor = tr.doc.resolve(anchorPos);
          const nextSelection =
            Selection.findFrom(resolvedAnchor, 1, true) ??
            Selection.findFrom(resolvedAnchor, -1, true);

          view.dispatch((nextSelection ? tr.setSelection(nextSelection) : tr).scrollIntoView());
          view.focus();
          return true;
        }

        if (
          event.key === 'Enter' &&
          selection instanceof TextSelection &&
          selection.empty &&
          $from.parent.type.name === 'paragraph' &&
          $from.parentOffset === $from.parent.content.size
        ) {
          const columnCount = getPipeShortcutColumnCount($from.parent.textContent);
          if (columnCount) {
            const tableNode = createEmptyTableNode(state.schema, columnCount);
            if (tableNode && $from.depth >= 1) {
              const parent = $from.node($from.depth - 1);
              if (
                parent.canReplaceWith(
                  $from.index($from.depth - 1),
                  $from.indexAfter($from.depth - 1),
                  tableNode.type
                )
              ) {
                event.preventDefault();
                const from = $from.before($from.depth);
                const to = $from.after($from.depth);
                const tr = state.tr.replaceRangeWith(from, to, tableNode);
                const nextSelection = Selection.findFrom(tr.doc.resolve(from + 1), 1, true);
                view.dispatch(
                  (nextSelection ? tr.setSelection(nextSelection) : tr).scrollIntoView()
                );
                return true;
              }
            }
          }
        }
        
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
              const action = (btn as HTMLElement).dataset.action || '';
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
        }
      };
    }
  });
});
