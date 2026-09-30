import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';

import type { TableMenuState } from './types';
import { shouldIgnoreTableContextMenuTarget } from './tableContextMenuTarget';
import { createTableContextMenuView } from './tableContextMenuView';

export { resolveTableContextMenuPosition } from './tableContextMenuView';

export const tablePluginKey = new PluginKey<TableMenuState>('tableMenu');
const TABLE_CELL_SELECTOR = 'td, th';
export const TABLE_CONTEXT_MENU_OPEN_EVENT = 'editor:table-context-menu-open';

function createClosedTableMenuState(): TableMenuState {
  return {
    isOpen: false,
    position: { x: 0, y: 0 },
    cellPos: -1,
  };
}

function getTableCellPosFromDom(view: EditorView, target: EventTarget | null): number | null {
  if (!(target instanceof Element)) return null;
  const cell = target.closest(TABLE_CELL_SELECTOR);
  if (!cell || !view.dom.contains(cell)) return null;
  try {
    const position = view.posAtDOM(cell, 0);
    const node = view.state.doc.nodeAt(position);
    if (node?.type.name === 'table_cell' || node?.type.name === 'table_header') return position;
    const resolved = view.state.doc.resolve(position);
    for (let depth = resolved.depth; depth > 0; depth -= 1) {
      const typeName = resolved.node(depth).type.name;
      if (typeName === 'table_cell' || typeName === 'table_header') return resolved.before(depth);
    }
  } catch {
  }
  return null;
}

export function applyTableMenuState(
  state: TableMenuState,
  meta: Partial<TableMenuState> | undefined,
  documentChanged: boolean
): TableMenuState {
  if (meta) {
    return { ...state, ...meta };
  }

  if (state.isOpen && documentChanged) {
    return createClosedTableMenuState();
  }

  return state;
}

export const tableContextMenuPlugin = $prose(() => {
  return new Plugin({
    key: tablePluginKey,
    state: {
      init: createClosedTableMenuState,
      apply(tr, state) {
        return applyTableMenuState(
          state,
          tr.getMeta(tablePluginKey),
          tr.docChanged
        );
      },
    },
    props: {
      handleDOMEvents: {
        contextmenu(view, event) {
          if (!view.editable) return false;

          if (shouldIgnoreTableContextMenuTarget(event.target)) {
            event.preventDefault();
            return true;
          }

          const { state } = view;
          const domCellPos = getTableCellPosFromDom(view, event.target);
          if (domCellPos !== null) {
            event.preventDefault();
            view.dispatch(
              state.tr.setMeta(tablePluginKey, {
                isOpen: true,
                position: { x: event.clientX, y: event.clientY },
                cellPos: domCellPos,
              })
            );
            return true;
          }

          const pos = view.posAtCoords({
            left: event.clientX,
            top: event.clientY,
          });
          if (!pos) return false;

          const $pos = state.doc.resolve(pos.pos);
          for (let depth = $pos.depth; depth > 0; depth--) {
            const node = $pos.node(depth);
            if (
              node.type.name !== 'table_cell' &&
              node.type.name !== 'table_header'
            ) {
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
      return createTableContextMenuView(
        editorView,
        tablePluginKey,
        TABLE_CONTEXT_MENU_OPEN_EVENT,
      );
    },
  });
});
