import { describe, expect, it } from 'vitest';
import { createMarkdownTableFromTabSeparatedText } from './tabSeparatedTablePaste';

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
});
