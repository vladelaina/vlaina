import { describe, expect, it } from 'vitest';
import {
  joinSerializedBlocks,
  normalizeSerializedMarkdownBlock,
  normalizeSerializedMarkdownDocument,
  normalizeSerializedMarkdownSelection,
  stripTrailingNewlines,
} from './markdownSerializationUtils';

describe('stripTrailingNewlines', () => {
  it('removes trailing newlines only', () => {
    expect(stripTrailingNewlines('abc\n\n')).toBe('abc');
    expect(stripTrailingNewlines('abc\nxyz')).toBe('abc\nxyz');
  });
});

describe('normalizeSerializedMarkdownBlock', () => {
  it('converts standalone br tags to empty block text', () => {
    expect(normalizeSerializedMarkdownBlock('<br />')).toBe('');
    expect(normalizeSerializedMarkdownBlock('<br/>\n')).toBe('');
  });

  it('removes placeholder br tags from empty list items', () => {
    expect(normalizeSerializedMarkdownBlock('- [ ] <br />\n')).toBe('- [ ]');
    expect(normalizeSerializedMarkdownBlock('  - [x] <br />\n')).toBe('  - [x]');
  });

  it('removes placeholder br tags from empty table cells', () => {
    expect(
      normalizeSerializedMarkdownBlock('| a | b |\n| --- | --- |\n| 1 | <br /> |\n')
    ).toBe('| a | b |\n| --- | --- |\n| 1 |   |');
  });

  it('keeps normal markdown content', () => {
    expect(normalizeSerializedMarkdownBlock('# Title\n')).toBe('# Title');
  });
});

describe('normalizeSerializedMarkdownDocument', () => {
  it('converts standalone br lines into markdown blank lines', () => {
    expect(
      normalizeSerializedMarkdownDocument('1\n<br data-vlaina-empty-line="true" />\n2\n')
    ).toBe('1\n\n2\n');
    expect(normalizeSerializedMarkdownDocument('<br data-vlaina-empty-line="true" />')).toBe('');
  });

  it('keeps user-authored standalone br tags', () => {
    expect(normalizeSerializedMarkdownDocument('1\n<br />\n2\n')).toBe('1\n<br />\n2\n');
    expect(normalizeSerializedMarkdownDocument('<br />')).toBe('<br />');
    expect(normalizeSerializedMarkdownDocument('> <br />')).toBe('> <br />');
    expect(
      normalizeSerializedMarkdownDocument('<br data-vlaina-blockquote-depth="2" data-vlaina-user-br="true" />')
    ).toBe('> > <br />');
  });

  it('does not rewrite user text that resembles internal sentinels', () => {
    expect(normalizeSerializedMarkdownDocument('VLAINA_LIST_GAP_SENTINEL')).toBe(
      'VLAINA_LIST_GAP_SENTINEL'
    );
  });

  it('does not rewrite placeholder-like text inside fenced code', () => {
    const markdown = [
      '```md',
      '<br data-vlaina-empty-line="true" />',
      '- [ ] <br />',
      '- one',
      '',
      '- two',
      '```',
    ].join('\n');

    expect(normalizeSerializedMarkdownDocument(markdown)).toBe(markdown);
  });

  it('does not rewrite placeholder-like text inside raw html blocks', () => {
    const markdown = ['<pre>', '<br data-vlaina-empty-line="true" />', '</pre>'].join('\n');

    expect(normalizeSerializedMarkdownDocument(markdown)).toBe(markdown);
  });

  it('does not rewrite placeholder-like text inside blockquote fenced code', () => {
    const markdown = [
      '> ```md',
      '> <br data-vlaina-empty-line="true" />',
      '> - [ ] <br />',
      '> ```',
    ].join('\n');

    expect(normalizeSerializedMarkdownDocument(markdown)).toBe(markdown);
  });

  it('does not rewrite placeholder-like text inside blockquote raw html blocks', () => {
    const markdown = [
      '> <pre>',
      '> <br data-vlaina-empty-line="true" />',
      '> </pre>',
    ].join('\n');

    expect(normalizeSerializedMarkdownDocument(markdown)).toBe(markdown);
  });

  it('does not rewrite placeholder-like text inside nested blockquote protected blocks', () => {
    const markdown = [
      '> > ```md',
      '> > <br data-vlaina-empty-line="true" />',
      '> > - [ ] <br />',
      '> > ```',
    ].join('\n');

    expect(normalizeSerializedMarkdownDocument(markdown)).toBe(markdown);
  });

  it('removes placeholder br tags from persisted empty task items and table cells', () => {
    expect(normalizeSerializedMarkdownDocument('- [ ] <br />\n')).toBe('- [ ]\n');
    expect(
      normalizeSerializedMarkdownDocument('| a | b |\n| --- | --- |\n| <br /> | 2 |\n')
    ).toBe('| a | b |\n| --- | --- |\n|   | 2 |\n');
  });
});

describe('normalizeSerializedMarkdownSelection', () => {
  it('converts standalone br tags to single newline', () => {
    expect(normalizeSerializedMarkdownSelection('<br />')).toBe('\n');
  });

  it('converts marked standalone br placeholders to single newline', () => {
    expect(normalizeSerializedMarkdownSelection('<br data-vlaina-empty-line="true" />')).toBe('\n');
  });

  it('keeps blockquote user br placeholders when normalizing selections', () => {
    expect(
      normalizeSerializedMarkdownSelection(
        '<br data-vlaina-blockquote-depth="2" data-vlaina-user-br="true" />'
      )
    ).toBe('> > <br />');
  });

  it('removes placeholder br tags from copied empty task items', () => {
    expect(
      normalizeSerializedMarkdownSelection('- [ ] todo\n  - [ ] 1\n    - [ ] <br />\n')
    ).toBe('- [ ] todo\n  - [ ] 1\n    - [ ]');
  });

  it('removes placeholder br tags from copied empty table cells', () => {
    expect(
      normalizeSerializedMarkdownSelection('| a | b |\n| --- | --- |\n| <br /> | 2 |\n')
    ).toBe('| a | b |\n| --- | --- |\n|   | 2 |');
  });

  it('keeps normal markdown content', () => {
    expect(normalizeSerializedMarkdownSelection('- [ ] task\n')).toBe('- [ ] task');
  });
});

describe('joinSerializedBlocks', () => {
  it('returns newline for single empty copied block', () => {
    expect(joinSerializedBlocks([''])).toBe('\n');
  });

  it('preserves empty gaps between non-empty blocks', () => {
    expect(joinSerializedBlocks(['A', '', 'B'])).toBe('A\n\nB');
  });

  it('uses blank lines between non-list markdown blocks', () => {
    expect(joinSerializedBlocks(['# Title', 'Body'])).toBe('# Title\n\nBody');
  });

  it('keeps adjacent list items tightly joined', () => {
    expect(joinSerializedBlocks(['- first', '- second'])).toBe('- first\n- second');
    expect(joinSerializedBlocks(['1) first', '2) second'])).toBe('1) first\n2) second');
  });
});
