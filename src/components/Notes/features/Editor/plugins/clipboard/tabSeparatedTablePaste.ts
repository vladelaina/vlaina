const normalizeLineEnding = (value: string) => value.replace(/\r\n?/g, '\n');
export const MAX_TAB_SEPARATED_TABLE_CHARS = 1024 * 1024;
export const MAX_TAB_SEPARATED_TABLE_ROWS = 2000;
export const MAX_TAB_SEPARATED_TABLE_COLUMNS = 200;
export const MAX_TAB_SEPARATED_TABLE_CELL_CHARS = 16 * 1024;

const escapeMarkdownTableCell = (value: string) =>
  value
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|');

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

  const rows = lines.map((line) => line.split('\t'));
  const columnCount = rows[0]?.length ?? 0;

  if (columnCount < 2 || columnCount > MAX_TAB_SEPARATED_TABLE_COLUMNS) {
    return null;
  }

  if (!rows.every((row) => row.length === columnCount)) {
    return null;
  }
  if (rows.some((row) => row.some((cell) => cell.length > MAX_TAB_SEPARATED_TABLE_CELL_CHARS))) {
    return null;
  }

  if (!rows.some((row) => row.some((cell) => cell.trim().length > 0))) {
    return null;
  }

  const formatRow = (row: string[]) => `| ${row.map(escapeMarkdownTableCell).join(' | ')} |`;
  const separator = `| ${Array.from({ length: columnCount }, () => '---').join(' | ')} |`;

  return [
    formatRow(rows[0]),
    separator,
    ...rows.slice(1).map(formatRow),
  ].join('\n');
}
