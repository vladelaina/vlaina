interface TableDeleteShortcutResolvedPos {
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
}

interface TableDeleteShortcutNode {
  type: {
    name: string;
  };
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

function isTableCellContentEmpty(node: TableDeleteShortcutNode | null | undefined): boolean {
  if (!node) return true;

  if (node.isText) {
    return (node.text ?? '').trim().length === 0;
  }

  if (node.type.name === 'hard_break') {
    return true;
  }

  if (node.isLeaf) {
    return false;
  }

  for (let index = 0; index < node.childCount; index += 1) {
    if (!isTableCellContentEmpty(node.child(index))) {
      return false;
    }
  }

  return true;
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
  const { selection } = state;
  if (!selection.empty) return null;

  const { $from } = selection;
  if (!$from.parent.isTextblock) return null;

  const paragraphDepth = $from.depth;
  if (paragraphDepth < 1) return null;

  const paragraph = $from.node(paragraphDepth);
  if (paragraph.type.name !== 'paragraph' || !isTableCellContentEmpty(paragraph)) {
    return null;
  }

  const containerDepth = paragraphDepth - 1;
  const container = $from.node(containerDepth);
  const paragraphIndex = $from.index(containerDepth);
  const tableIndex = paragraphIndex + (searchDir < 0 ? -1 : 1);

  if (tableIndex < 0 || tableIndex >= container.childCount) {
    return null;
  }

  if (container.child(tableIndex).type.name !== 'table') {
    return null;
  }

  return {
    from: $from.before(paragraphDepth),
    to: $from.after(paragraphDepth),
    searchDir,
  };
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
    isTableCellContentEmpty(row.child(index))
  );

  return (
    table.childCount > 1 &&
    rowIndex === table.childCount - 1 &&
    rowCellEmptyStates.every(Boolean)
  );
}
