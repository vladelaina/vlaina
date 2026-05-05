import { describe, expect, it } from 'vitest';
import {
  joinSerializedBlocks,
  normalizeSerializedMarkdownBlock,
  normalizeSerializedMarkdownDocument,
  normalizeSerializedMarkdownSelection,
  stripTrailingNewlines,
} from '@/lib/notes/markdown/markdownSerializationUtils';

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

  it('converts invisible editor blank-line placeholders to empty block text', () => {
    expect(normalizeSerializedMarkdownBlock('\u200B\n')).toBe('');
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

  it('converts internal user br placeholders in copied blocks', () => {
    expect(
      normalizeSerializedMarkdownBlock(['Line one', '<br data-vlaina-user-br="true" />', 'Line two'].join('\n'))
    ).toBe(['Line one\\', 'Line two'].join('\n'));
  });
});

describe('normalizeSerializedMarkdownDocument', () => {
  it('converts invisible editor blank-line placeholders into markdown blank lines', () => {
    expect(normalizeSerializedMarkdownDocument('1\n\u200B\n2\n')).toBe('1\n\n2\n');
    expect(normalizeSerializedMarkdownDocument('- one\n\u200B\u200C\n- two\n')).toBe('- one\n\n- two\n');
  });

  it('converts invisible blank placeholders next to internal user br placeholders', () => {
    expect(
      normalizeSerializedMarkdownDocument('A\n\u200B <br data-vlaina-user-br="true" />\n\u200B\nB')
    ).toBe('A\n\n<br />\n\nB');
  });

  it('converts standalone br lines into markdown blank lines', () => {
    expect(
      normalizeSerializedMarkdownDocument('1\n<br data-vlaina-empty-line="true" />\n2\n')
    ).toBe('1\n\n2\n');
    expect(normalizeSerializedMarkdownDocument('<br data-vlaina-empty-line="true" />')).toBe('');
  });

  it('converts internal empty line placeholders with serialized html variants', () => {
    expect(
      normalizeSerializedMarkdownDocument('1\n<br data-vlaina-empty-line="true"/>\n2\n')
    ).toBe('1\n\n2\n');
    expect(
      normalizeSerializedMarkdownDocument(
        '1\n<br class="x" data-vlaina-empty-line=true></br>\n2\n'
      )
    ).toBe('1\n\n2\n');
    expect(
      normalizeSerializedMarkdownDocument('1\n<br date-vlaina-empty-line="true"/>\n2\n')
    ).toBe('1\n\n2\n');
    expect(
      normalizeSerializedMarkdownDocument('1\n<br date-vlaianempt-line="true"/>\n2\n')
    ).toBe('1\n\n2\n');
  });

  it('keeps user-authored standalone br tags', () => {
    expect(normalizeSerializedMarkdownDocument('1\n<br />\n2\n')).toBe('1\n<br />\n2\n');
    expect(normalizeSerializedMarkdownDocument('<br />')).toBe('<br />');
    expect(normalizeSerializedMarkdownDocument('> <br />')).toBe('> <br />');
    expect(
      normalizeSerializedMarkdownDocument('<br data-vlaina-blockquote-depth="2" data-vlaina-user-br="true" />')
    ).toBe('> > <br />');
  });

  it('converts editor-created empty paragraph br lines into markdown blank lines', () => {
    expect(
      normalizeSerializedMarkdownDocument(['1', '', '2', '', '<br />', '', '3'].join('\n'))
    ).toBe(['1', '', '2', '', '', '3'].join('\n'));
    expect(
      normalizeSerializedMarkdownDocument(['1', '', '2', '<br />', '', '3'].join('\n'))
    ).toBe(['1', '', '2', '', '3'].join('\n'));
    expect(
      normalizeSerializedMarkdownDocument(['1', '', '2', '', '<br />', '3'].join('\n'))
    ).toBe(['1', '', '2', '', '3'].join('\n'));
  });

  it('converts internal user br placeholders with serialized html variants', () => {
    expect(
      normalizeSerializedMarkdownDocument('1\n<br data-vlaina-user-br="true"/>\n2\n')
    ).toBe('1\\\n2\n');
    expect(
      normalizeSerializedMarkdownDocument('1\n<br class="x" data-vlaina-user-br=true></br>\n2\n')
    ).toBe('1\\\n2\n');
    expect(
      normalizeSerializedMarkdownDocument('1\n<br date-vlaina-user-br="true"/>\n2\n')
    ).toBe('1\\\n2\n');
  });

  it('preserves user-authored paragraph line breaks as markdown hard breaks', () => {
    expect(
      normalizeSerializedMarkdownDocument(['1', '2', '', '3', '4'].join('\n'))
    ).toBe(['1\\', '2', '', '3\\', '4'].join('\n'));
  });

  it('does not convert structural markdown boundaries into hard breaks', () => {
    expect(
      normalizeSerializedMarkdownDocument(['# Title', 'Body', '', '- one', '- two'].join('\n'))
    ).toBe(['# Title', 'Body', '', '- one', '- two'].join('\n'));
    expect(
      normalizeSerializedMarkdownDocument(['| A | B |', '| --- | --- |', '| 1 | 2 |'].join('\n'))
    ).toBe(['| A | B |', '| --- | --- |', '| 1 | 2 |'].join('\n'));
  });

  it('does not convert leading frontmatter line breaks into hard breaks', () => {
    expect(
      normalizeSerializedMarkdownDocument(['---', 'title: Alpha', 'tags: test', '---', '', 'Line one', 'Line two'].join('\n'))
    ).toBe(['---', 'title: Alpha', 'tags: test', '---', '', 'Line one\\', 'Line two'].join('\n'));
  });

  it('does not convert display math block line breaks into hard breaks', () => {
    expect(
      normalizeSerializedMarkdownDocument(['Before', '', '$$', 'a = b', 'c = d', '$$', '', 'After'].join('\n'))
    ).toBe(['Before', '', '$$', 'a = b', 'c = d', '$$', '', 'After'].join('\n'));
  });

  it('converts internal blockquote br placeholders with serialized html variants', () => {
    expect(
      normalizeSerializedMarkdownDocument(
        '<br class="x" data-vlaina-user-br=true data-vlaina-blockquote-depth=2></br>'
      )
    ).toBe('> > <br />');
    expect(
      normalizeSerializedMarkdownDocument(
        '<br date-vlaina-blockquote-depth="2" date-vlaina-user-br="true"/>'
      )
    ).toBe('> > <br />');
  });

  it('does not rewrite user text that resembles internal sentinels', () => {
    expect(normalizeSerializedMarkdownDocument('VLAINA_LIST_GAP_SENTINEL')).toBe(
      'VLAINA_LIST_GAP_SENTINEL'
    );
  });

  it('converts internal list gap placeholders back to markdown blank lines', () => {
    expect(
      normalizeSerializedMarkdownDocument('- one\n<br data-vlaina-list-gap="true"/>\n- two\n')
    ).toBe('- one\n\n- two\n');
    expect(
      normalizeSerializedMarkdownDocument(
        '- one\n<br class="x" data-vlaina-list-gap=true></br>\n- two\n'
      )
    ).toBe('- one\n\n- two\n');
    expect(
      normalizeSerializedMarkdownDocument('- one\n<br date-vlaina-list-gap="true"/>\n- two\n')
    ).toBe('- one\n\n- two\n');
    expect(
      normalizeSerializedMarkdownDocument('- one\n<br date-vlaianlist-gap="true"/>\n- two\n')
    ).toBe('- one\n\n- two\n');
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

  it('does not unescape markdown punctuation inside fenced code', () => {
    const markdown = ['```md', '\\*literal\\*', '```'].join('\n');

    expect(normalizeSerializedMarkdownDocument(markdown)).toBe(markdown);
  });

  it('escapes supported inline html text before persistence', () => {
    expect(
      normalizeSerializedMarkdownDocument(
        '<sup>a < b & c</sup> <mark>h = i</mark> <u>x + y</u> <mark style="background-color: #fff">x > y</mark>'
      )
    ).toBe(
      '<sup>a &lt; b &amp; c</sup> <mark>h = i</mark> <u>x + y</u> <mark style="background-color: #fff">x &gt; y</mark>'
    );
  });

  it('escapes generic inline html text before persistence', () => {
    expect(
      normalizeSerializedMarkdownDocument('<span data-note="keep">plain < text & value</span> <kbd>Ctrl & A</kbd>')
    ).toBe('<span data-note="keep">plain &lt; text &amp; value</span> <kbd>Ctrl &amp; A</kbd>');
  });

  it('keeps nested generic inline html tags intact', () => {
    expect(
      normalizeSerializedMarkdownDocument('<span data-note="keep"><em>plain</em></span>')
    ).toBe('<span data-note="keep"><em>plain</em></span>');
  });

  it('canonicalizes strong text before inline code when the editor cannot keep the mark boundary stable', () => {
    expect(normalizeSerializedMarkdownDocument('Use **bold with `code`** here.')).toBe(
      'Use **bold with** `code` here.'
    );
  });

  it('canonicalizes adjacent callout list items to the editor spread structure', () => {
    expect(
      normalizeSerializedMarkdownDocument(['> 💡 Callout title', '>', '> - First item', '> - Second item'].join('\n'))
    ).toBe(['> 💡 Callout title', '>', '> - First item', '>', '> - Second item'].join('\n'));
  });

  it('canonicalizes thematic break variants to unambiguous separators', () => {
    expect(normalizeSerializedMarkdownDocument(['before', '', '***', '', 'after'].join('\n'))).toBe(
      ['before', '', '---', '', 'after'].join('\n')
    );
    expect(normalizeSerializedMarkdownDocument(['before', '', '___', '', 'after'].join('\n'))).toBe(
      ['before', '', '---', '', 'after'].join('\n')
    );
  });

  it('does not rewrite custom inline html text inside fenced code', () => {
    const markdown = ['```html', '<sup>a < b & c</sup>', '```'].join('\n');

    expect(normalizeSerializedMarkdownDocument(markdown)).toBe(markdown);
  });

  it('does not rewrite placeholder-like text inside raw html blocks', () => {
    const markdown = ['<pre>', '<br data-vlaina-empty-line="true" />', '</pre>'].join('\n');

    expect(normalizeSerializedMarkdownDocument(markdown)).toBe(markdown);
  });

  it('does not rewrite placeholder-like text inside generic html blocks', () => {
    const markdown = ['<div>', '<br data-vlaina-empty-line="true" />', '</div>'].join('\n');

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

  it('converts standalone invisible blank-line placeholders to single newline', () => {
    expect(normalizeSerializedMarkdownSelection('\u200B\n')).toBe('\n');
  });

  it('converts marked standalone br placeholders to single newline', () => {
    expect(normalizeSerializedMarkdownSelection('<br data-vlaina-empty-line="true" />')).toBe('\n');
    expect(normalizeSerializedMarkdownSelection('<br data-vlaina-empty-line="true"/>')).toBe('\n');
  });

  it('converts internal user br placeholders in copied selections', () => {
    expect(
      normalizeSerializedMarkdownSelection(['Line one', '<br data-vlaina-user-br="true" />', 'Line two'].join('\n'))
    ).toBe(['Line one\\', 'Line two'].join('\n'));
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
