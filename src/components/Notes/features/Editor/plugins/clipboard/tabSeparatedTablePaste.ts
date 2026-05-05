const normalizeLineEnding = (value: string) => value.replace(/\r\n?/g, '\n');

const escapeMarkdownTableCell = (value: string) =>
  value
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|');

export function createMarkdownTableFromTabSeparatedText(value: string): string | null {
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

  if (!lines.every((line) => line.includes('\t'))) {
    return null;
  }

  const rows = lines.map((line) => line.split('\t'));
  const columnCount = rows[0]?.length ?? 0;

  if (columnCount < 2) {
    return null;
  }

  if (!rows.every((row) => row.length === columnCount)) {
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
