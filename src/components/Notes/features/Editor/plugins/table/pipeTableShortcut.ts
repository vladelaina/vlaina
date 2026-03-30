import type { Node as ProseMirrorNode, NodeType } from '@milkdown/prose/model';

interface TableShortcutSchema {
  nodes: Record<string, NodeType | undefined>;
  text?: (text: string) => ProseMirrorNode;
}

const pipeCellPattern = /[|｜]/;

function isNode(node: ProseMirrorNode | null | undefined): node is ProseMirrorNode {
  return node != null;
}

export function getPipeShortcutColumnCount(text: string): number | null {
  const cells = getPipeShortcutCells(text)?.filter((cell) => cell.length > 0);

  return cells && cells.length >= 2 ? cells.length : null;
}

export function getPipeShortcutCells(text: string): string[] | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith('|') && !trimmed.startsWith('｜')) return null;
  if (!trimmed.endsWith('|') && !trimmed.endsWith('｜')) return null;

  const cells = trimmed
    .split(pipeCellPattern)
    .slice(1, -1)
    .map((cell) => cell.trim());

  return cells.length >= 2 ? cells : null;
}

export function createEmptyTableNode(schema: TableShortcutSchema, columnCount: number): ProseMirrorNode | null {
  const table = schema.nodes.table;
  const headerRow = schema.nodes.table_header_row;
  const row = schema.nodes.table_row;
  const headerCell = schema.nodes.table_header;
  const cell = schema.nodes.table_cell;

  if (!table || !headerRow || !row || !headerCell || !cell) {
    return null;
  }

  const createHeaderCell = headerCell.createAndFill?.bind(headerCell);
  const createBodyCell = cell.createAndFill?.bind(cell);

  if (!createHeaderCell || !createBodyCell) {
    return null;
  }

  const headerCells = Array.from({ length: columnCount }, () => createHeaderCell()).filter(isNode);
  const bodyCells = Array.from({ length: columnCount }, () => createBodyCell()).filter(isNode);

  if (headerCells.length !== columnCount || bodyCells.length !== columnCount) {
    return null;
  }

  return table.create(null, [
    headerRow.create(null, headerCells),
    row.create(null, bodyCells),
  ]);
}

export function createTableNodeFromPipeCells(
  schema: TableShortcutSchema,
  cells: string[],
): ProseMirrorNode | null {
  const table = schema.nodes.table;
  const headerRow = schema.nodes.table_header_row;
  const row = schema.nodes.table_row;
  const headerCell = schema.nodes.table_header;
  const cell = schema.nodes.table_cell;
  const paragraph = schema.nodes.paragraph;

  if (!table || !headerRow || !row || !headerCell || !cell || !paragraph || !schema.text) {
    return null;
  }

  const createBodyCell = cell.createAndFill?.bind(cell);
  if (!createBodyCell) {
    return null;
  }

  const headerCells = cells.map((value) =>
    headerCell.create(
      null,
      paragraph.create(null, value.length > 0 ? schema.text!(value) : undefined),
    )
  );
  const bodyCells = Array.from({ length: cells.length }, () => createBodyCell()).filter(isNode);

  if (headerCells.length !== cells.length || bodyCells.length !== cells.length) {
    return null;
  }

  return table.create(null, [
    headerRow.create(null, headerCells),
    row.create(null, bodyCells),
  ]);
}
