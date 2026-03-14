interface TableDeleteShortcutResolvedPos {
  depth: number;
  parentOffset: number;
  parent: {
    isTextblock: boolean;
  };
  before: (depth?: number) => number;
  after: (depth?: number) => number;
  node: (depth: number) => {
    type: {
      name: string;
    };
  };
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

export function shouldDeleteTableOnLeadingBackspace(state: TableDeleteShortcutState): boolean {
  return findLeadingTableDeleteRange(state) != null;
}
