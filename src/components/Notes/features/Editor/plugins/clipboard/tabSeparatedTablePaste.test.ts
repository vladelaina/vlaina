import { describe, expect, it, vi } from 'vitest';
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

  it('trims blank edge lines without shifting large line arrays', () => {
    const shiftSpy = vi.spyOn(Array.prototype, 'shift');
    const popSpy = vi.spyOn(Array.prototype, 'pop');
    let result: string | null = null;
    let shiftCalls = 0;
    let popCalls = 0;

    try {
      result = createMarkdownTableFromTabSeparatedText(`${'\n'.repeat(5000)}Name\tScore\nAda\t10${'\n'.repeat(5000)}`);
      shiftCalls = shiftSpy.mock.calls.length;
      popCalls = popSpy.mock.calls.length;
    } finally {
      shiftSpy.mockRestore();
      popSpy.mockRestore();
    }

    expect(result).toBe([
      '| Name | Score |',
      '| --- | --- |',
      '| Ada | 10 |',
    ].join('\n'));
    expect(shiftCalls).toBe(0);
    expect(popCalls).toBe(0);
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

  it('rejects table markdown that grows past the paste budget after escaping', () => {
    const row = Array.from(
      { length: MAX_TAB_SEPARATED_TABLE_COLUMNS },
      () => '\\'.repeat(100),
    ).join('\t');
    const text = Array.from({ length: 30 }, () => row).join('\n');

    expect(text.length).toBeLessThanOrEqual(MAX_TAB_SEPARATED_TABLE_CHARS);
    expect(createMarkdownTableFromTabSeparatedText(text)).toBeNull();
  });
});
