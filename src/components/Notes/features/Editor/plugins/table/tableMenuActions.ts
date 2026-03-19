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

export type TableMenuAction =
  | 'insert-row-above'
  | 'insert-row-below'
  | 'insert-col-left'
  | 'insert-col-right'
  | 'delete-row'
  | 'delete-col'
  | 'delete-table';

type TableCommand = (
  state: Parameters<typeof addRowBefore>[0],
  dispatch?: Parameters<typeof addRowBefore>[1]
) => boolean;

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

export function isTableMenuAction(value: string): value is TableMenuAction {
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

export function isTableMenuCellPosValid(view: EditorView, cellPos: number): boolean {
  const node = view.state.doc.nodeAt(cellPos);
  const typeName = node?.type.name;
  return typeName === 'table_cell' || typeName === 'table_header';
}

export function runTableMenuAction(
  action: TableMenuAction,
  view: EditorView,
  cellPos: number,
): boolean {
  if (!isTableMenuCellPosValid(view, cellPos)) return false;

  const docSize = view.state.doc.content.size;
  const safePos = Math.max(0, Math.min(cellPos + 1, docSize));
  const tr = view.state.tr.setSelection(
    Selection.near(view.state.doc.resolve(safePos), 1)
  );
  view.dispatch(tr);
  const command = resolveTableActionCommand(action);
  return command(view.state, view.dispatch);
}
