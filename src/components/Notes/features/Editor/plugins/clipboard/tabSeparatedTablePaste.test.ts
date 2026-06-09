import { describe, expect, it } from 'vitest';
import {
  MAX_TAB_SEPARATED_TABLE_CELL_CHARS,
  MAX_TAB_SEPARATED_TABLE_CHARS,
  MAX_TAB_SEPARATED_TABLE_COLUMNS,
  MAX_TAB_SEPARATED_TABLE_ROWS,
  createMarkdownTableFromTabSeparatedText,
} from './tabSeparatedTablePaste';

describe('createMarkdownTableFromTabSeparatedText', () => {
  it('converts spreadsheet-style tab separated rows into a markdown table', () => {
    expect(createMarkdownTableFromTabSeparatedText('Name\tScore\nAda\t10\nLinus\t9')).toBe([
      '| Name | Score |',
      '| --- | --- |',
      '| Ada | 10 |',
      '| Linus | 9 |',
    ].join('\n'));
  });

  it('escapes markdown table cell delimiters', () => {
    expect(createMarkdownTableFromTabSeparatedText('Name\tValue\nA|B\tC\\D')).toBe([
      '| Name | Value |',
      '| --- | --- |',
      '| A\\|B | C\\\\D |',
    ].join('\n'));
  });

  it('ignores single-line tabbed text and ragged rows', () => {
    expect(createMarkdownTableFromTabSeparatedText('Name\tScore')).toBeNull();
    expect(createMarkdownTableFromTabSeparatedText('Name\tScore\nAda')).toBeNull();
  });

  it('ignores oversized spreadsheet paste candidates', () => {
    expect(createMarkdownTableFromTabSeparatedText('x'.repeat(MAX_TAB_SEPARATED_TABLE_CHARS + 1))).toBeNull();
    expect(createMarkdownTableFromTabSeparatedText(
      Array.from({ length: MAX_TAB_SEPARATED_TABLE_ROWS + 1 }, () => 'A\tB').join('\n')
    )).toBeNull();
    expect(createMarkdownTableFromTabSeparatedText(
      `${Array.from({ length: MAX_TAB_SEPARATED_TABLE_COLUMNS + 1 }, (_, index) => `H${index}`).join('\t')}\n${
        Array.from({ length: MAX_TAB_SEPARATED_TABLE_COLUMNS + 1 }, (_, index) => `V${index}`).join('\t')
      }`
    )).toBeNull();
    expect(createMarkdownTableFromTabSeparatedText(`A\tB\n${'x'.repeat(MAX_TAB_SEPARATED_TABLE_CELL_CHARS + 1)}\tC`)).toBeNull();
  });

  it('rejects oversized rows before accepting later table content', () => {
    const oversizedHeader = Array.from(
      { length: MAX_TAB_SEPARATED_TABLE_COLUMNS + 1 },
      (_, index) => `H${index}`,
    ).join('\t');

    expect(createMarkdownTableFromTabSeparatedText(`${oversizedHeader}\nA\tB`)).toBeNull();
  });
});
