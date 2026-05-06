import {
  findAdjacentEmptyParagraphNearBlockDeleteRange,
  isNodeContentEffectivelyEmpty,
} from '../shared/emptyParagraphNearBlockDeletion';

interface TableDeleteShortcutResolvedPos {
  posAtIndex: (index: number, depth?: number) => number;
  depth: number;
  parentOffset: number;
  parent: {
    isTextblock: boolean;
  };
  before: (depth?: number) => number;
  after: (depth?: number) => number;
  node: (depth: number) => TableDeleteShortcutNode;
  index: (depth: number) => number;
}

interface TableDeleteShortcutSelection {
  empty: boolean;
  $from: TableDeleteShortcutResolvedPos;
}

interface TableDeleteShortcutState {
  selection: TableDeleteShortcutSelection;
}

interface TableDeleteShortcutRange {
  from: number;
  to: number;
}

export interface AdjacentTableParagraphDeleteRange extends TableDeleteShortcutRange {
  searchDir: -1 | 1;
  blockFrom: number;
  blockTo: number;
  blockName: string;
}

const TABLE_BLOCK_NAMES = new Set(['table']);

interface TableDeleteShortcutNode {
  type: {
    name: string;
  };
  nodeSize: number;
  childCount: number;
  child: (index: number) => TableDeleteShortcutNode;
  isLeaf?: boolean;
  isText?: boolean;
  text?: string | null;
}

function findCellDepth($from: TableDeleteShortcutResolvedPos): number | null {
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const nodeName = $from.node(depth).type.name;
    if (nodeName === 'table_cell' || nodeName === 'table_header') {
      return depth;
    }
  }

  return null;
}

export function findLeadingTableDeleteRange(
  state: TableDeleteShortcutState
): TableDeleteShortcutRange | null {
  const { selection } = state;
  if (!selection.empty) return null;

  const { $from } = selection;
  if (!$from.parent.isTextblock) return null;
  if ($from.parentOffset !== 0) return null;

  const cellDepth = findCellDepth($from);
  if (cellDepth == null || cellDepth < 2) return null;

  const rowDepth = cellDepth - 1;
  const tableDepth = cellDepth - 2;

  if ($from.index(rowDepth) !== 0 || $from.index(tableDepth) !== 0) {
    return null;
  }

  return {
    from: $from.before(tableDepth),
    to: $from.after(tableDepth),
  };
}

export function findAdjacentTableParagraphDeleteRange(
  state: TableDeleteShortcutState,
  searchDir: -1 | 1
): AdjacentTableParagraphDeleteRange | null {
  return findAdjacentEmptyParagraphNearBlockDeleteRange(
    state,
    searchDir,
    TABLE_BLOCK_NAMES
  );
}

export function shouldDeleteTableOnLeadingBackspace(state: TableDeleteShortcutState): boolean {
  return findLeadingTableDeleteRange(state) != null;
}

export function shouldDeleteTrailingEmptyRowOnDelete(
  state: TableDeleteShortcutState
): boolean {
  const { selection } = state;
  if (!selection.empty) return false;

  const { $from } = selection;
  if (!$from.parent.isTextblock) return false;

  const cellDepth = findCellDepth($from);
  if (cellDepth == null || cellDepth < 2) return false;

  const rowDepth = cellDepth - 1;
  const tableDepth = cellDepth - 2;
  const table = $from.node(tableDepth);
  const row = $from.node(rowDepth);
  const rowIndex = $from.index(tableDepth);
  const rowCellEmptyStates = Array.from({ length: row.childCount }, (_, index) =>
    isNodeContentEffectivelyEmpty(row.child(index))
  );

  return (
    table.childCount > 1 &&
    rowIndex === table.childCount - 1 &&
    rowCellEmptyStates.every(Boolean)
  );
}
