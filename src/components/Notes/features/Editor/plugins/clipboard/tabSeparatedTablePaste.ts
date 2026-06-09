const normalizeLineEnding = (value: string) => value.replace(/\r\n?/g, '\n');
export const MAX_TAB_SEPARATED_TABLE_CHARS = 1024 * 1024;
export const MAX_TAB_SEPARATED_TABLE_ROWS = 2000;
export const MAX_TAB_SEPARATED_TABLE_COLUMNS = 200;
export const MAX_TAB_SEPARATED_TABLE_CELL_CHARS = 16 * 1024;

const escapeMarkdownTableCell = (value: string) =>
  value
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|');

const parseBoundedTabSeparatedRows = (lines: readonly string[]): string[][] | null => {
  const rows: string[][] = [];
  let columnCount: number | null = null;
  let hasContent = false;

  for (const line of lines) {
    const row = line.split('\t');

    if (columnCount === null) {
      columnCount = row.length;
      if (columnCount < 2 || columnCount > MAX_TAB_SEPARATED_TABLE_COLUMNS) {
        return null;
      }
    } else if (row.length !== columnCount) {
      return null;
    }

    for (const cell of row) {
      if (cell.length > MAX_TAB_SEPARATED_TABLE_CELL_CHARS) {
        return null;
      }
      if (!hasContent && cell.trim().length > 0) {
        hasContent = true;
      }
    }

    rows.push(row);
  }

  return hasContent ? rows : null;
};

export function createMarkdownTableFromTabSeparatedText(value: string): string | null {
  if (value.length > MAX_TAB_SEPARATED_TABLE_CHARS) {
    return null;
  }

  const lines = normalizeLineEnding(value).split('\n');

  while (lines[0]?.trim() === '') {
    lines.shift();
  }

  while (lines[lines.length - 1]?.trim() === '') {
    lines.pop();
  }

  if (lines.length < 2) {
    return null;
  }
  if (lines.length > MAX_TAB_SEPARATED_TABLE_ROWS) {
    return null;
  }

  if (!lines.every((line) => line.includes('\t'))) {
    return null;
  }

  const rows = parseBoundedTabSeparatedRows(lines);
  if (!rows) {
    return null;
  }
  const columnCount = rows[0]?.length ?? 0;

  const formatRow = (row: string[]) => `| ${row.map(escapeMarkdownTableCell).join(' | ')} |`;
  const separator = `| ${Array.from({ length: columnCount }, () => '---').join(' | ')} |`;

  return [
    formatRow(rows[0]),
    separator,
    ...rows.slice(1).map(formatRow),
  ].join('\n');
}
