import { describe, expect, it } from 'vitest';
import {
  Editor,
  defaultValueCtx,
  editorViewCtx,
  remarkStringifyOptionsCtx,
  serializerCtx,
} from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import { notesRemarkStringifyOptions } from '../../config/stringifyOptions';
import {
  normalizeSerializedMarkdownDocument,
  preserveMarkdownBlankLinesForEditor,
  stripTrailingNewlines,
} from './markdownSerializationUtils';

async function serializeMarkdownThroughEditor(
  markdown: string,
  options: { preserveBlankLines?: boolean } = {},
): Promise<string> {
  const defaultValue = options.preserveBlankLines === false
    ? markdown
    : preserveMarkdownBlankLinesForEditor(markdown);
  const editor = Editor.make()
    .config((ctx) => {
      ctx.set(defaultValueCtx, defaultValue);
      ctx.update(remarkStringifyOptionsCtx, (prev) => ({
        ...prev,
        ...notesRemarkStringifyOptions,
      }));
    })
    .use(commonmark)
    .use(gfm);

  await editor.create();
  const view = editor.ctx.get(editorViewCtx);
  const serializer = editor.ctx.get(serializerCtx);
  const serialized = serializer(view.state.doc);
  await editor.destroy();
  return serialized;
}

async function expectEditorMarkdown(markdown: string, expected = markdown): Promise<void> {
  const serialized = await serializeMarkdownThroughEditor(markdown);
  expect(stripTrailingNewlines(normalizeSerializedMarkdownDocument(serialized))).toBe(expected);
}

describe('preserveMarkdownBlankLinesForEditor', () => {
  it('turns markdown blank lines into editor placeholders', () => {
    expect(preserveMarkdownBlankLinesForEditor('1\n\n2')).toBe(
      '1\n<br data-vlaina-empty-line="true" />\n2'
    );
  });

  it('does not add placeholders inside fenced code blocks', () => {
    expect(
      preserveMarkdownBlankLinesForEditor(
        ['```ts', 'const a = 1;', '', 'const b = 2;', '```', '', 'after'].join('\n')
      )
    ).toBe(
      ['```ts', 'const a = 1;', '', 'const b = 2;', '```', '<br data-vlaina-empty-line="true" />', 'after'].join('\n')
    );
  });

  it('does not rewrite br-only lines inside fenced code blocks', () => {
    expect(
      preserveMarkdownBlankLinesForEditor(['```html', '<br />', '```'].join('\n'))
    ).toBe(['```html', '<br />', '```'].join('\n'));
  });

  it('does not rewrite list-like gaps inside fenced code blocks', () => {
    expect(
      preserveMarkdownBlankLinesForEditor(['```md', '- one', '', '- two', '```'].join('\n'))
    ).toBe(['```md', '- one', '', '- two', '```'].join('\n'));
  });

  it('does not rewrite content inside blockquote fenced code blocks', () => {
    const markdown = ['> ```md', '> - one', '>', '> - two', '> ```'].join('\n');

    expect(preserveMarkdownBlankLinesForEditor(markdown)).toBe(markdown);
  });

  it('does not rewrite content inside nested blockquote fenced code blocks', () => {
    const markdown = ['> > ```md', '> > - one', '> >', '> > - two', '> > ```'].join('\n');

    expect(preserveMarkdownBlankLinesForEditor(markdown)).toBe(markdown);
  });

  it('does not add placeholders inside normalized frontmatter fences', () => {
    expect(
      preserveMarkdownBlankLinesForEditor(
        ['```yaml-frontmatter', 'title: Demo', '', 'summary: Test', '```', '', '# Heading'].join('\n')
      )
    ).toBe(
      [
        '```yaml-frontmatter',
        'title: Demo',
        '',
        'summary: Test',
        '```',
        '<br data-vlaina-empty-line="true" />',
        '# Heading',
      ].join('\n')
    );
  });

  it('matches fenced code closers by marker and length', () => {
    expect(
      preserveMarkdownBlankLinesForEditor(['````', '```', '', 'code', '````', '', 'after'].join('\n'))
    ).toBe(['````', '```', '', 'code', '````', '<br data-vlaina-empty-line="true" />', 'after'].join('\n'));
  });

  it('does not close a fenced code block with a content line that only starts with a fence', () => {
    expect(
      preserveMarkdownBlankLinesForEditor(['```', '```still code', '', '```', '', 'after'].join('\n'))
    ).toBe(['```', '```still code', '', '```', '<br data-vlaina-empty-line="true" />', 'after'].join('\n'));
  });

  it('does not treat indented code as fenced code', () => {
    expect(
      preserveMarkdownBlankLinesForEditor(['    ```', '', 'after'].join('\n'))
    ).toBe(['    ```', '<br data-vlaina-empty-line="true" />', 'after'].join('\n'));
  });

  it('does not add placeholders inside indented code blocks', () => {
    expect(
      preserveMarkdownBlankLinesForEditor(['    line 1', '', '    line 2', '', 'after'].join('\n'))
    ).toBe(['    line 1', '', '    line 2', '<br data-vlaina-empty-line="true" />', 'after'].join('\n'));
  });

  it('does not add placeholders inside tab-indented code blocks', () => {
    expect(
      preserveMarkdownBlankLinesForEditor(['\tline 1', '', '\tline 2', '', 'after'].join('\n'))
    ).toBe(['\tline 1', '', '\tline 2', '<br data-vlaina-empty-line="true" />', 'after'].join('\n'));
  });

  it('detects indented code blocks after paragraph breaks', () => {
    expect(
      preserveMarkdownBlankLinesForEditor(['before', '', '    line 1', '', '    line 2'].join('\n'))
    ).toBe(['before', '', '    line 1', '', '    line 2'].join('\n'));
  });

  it('does not keep trailing document blank lines inside indented code blocks', () => {
    expect(
      preserveMarkdownBlankLinesForEditor(['    line', ''].join('\n'))
    ).toBe(['    line', '<br data-vlaina-empty-line="true" />'].join('\n'));
  });

  it('does not rewrite placeholder-like text inside indented code blocks', () => {
    const markdown = ['    <br data-vlaina-empty-line="true" />', '', '    <br />', '', 'after'].join('\n');

    expect(normalizeSerializedMarkdownDocument(markdown)).toBe(markdown);
  });

  it('escapes user-authored vlaina break placeholders before editor parsing', () => {
    expect(preserveMarkdownBlankLinesForEditor('<br data-vlaina-empty-line="true" />')).toBe(
      '<\u200cbr data-vlaina-empty-line="true" />'
    );
  });

  it('keeps user-authored vlaina break placeholders editable through the editor parser and serializer', async () => {
    await expectEditorMarkdown('<br data-vlaina-empty-line="true" />');
  });

  it('keeps blockquote user-authored vlaina break placeholders editable through the editor parser and serializer', async () => {
    await expectEditorMarkdown('> <br data-vlaina-user-br="true" />');
  });

  it('does not treat backtick fences with backticks in the info string as fenced code', () => {
    expect(
      preserveMarkdownBlankLinesForEditor(['``` invalid ` info', '', 'after'].join('\n'))
    ).toBe(['``` invalid ` info', '<br data-vlaina-empty-line="true" />', 'after'].join('\n'));
  });

  it('does not treat mixed backtick and tilde marker runs as fenced code', () => {
    expect(
      preserveMarkdownBlankLinesForEditor(['``~', '', 'after'].join('\n'))
    ).toBe(['``~', '<br data-vlaina-empty-line="true" />', 'after'].join('\n'));
  });

  it('does not add placeholders inside raw html blocks that allow blank lines', () => {
    expect(
      preserveMarkdownBlankLinesForEditor(['<pre>', 'line 1', '', 'line 2', '</pre>', '', 'after'].join('\n'))
    ).toBe(['<pre>', 'line 1', '', 'line 2', '</pre>', '<br data-vlaina-empty-line="true" />', 'after'].join('\n'));
  });

  it('does not start fenced code state inside raw html blocks', () => {
    expect(
      preserveMarkdownBlankLinesForEditor(['<pre>', '```', '', '```', '</pre>', '', 'after'].join('\n'))
    ).toBe(['<pre>', '```', '', '```', '</pre>', '<br data-vlaina-empty-line="true" />', 'after'].join('\n'));
  });

  it('does not add placeholders inside blockquote raw html blocks', () => {
    const markdown = ['> <pre>', '>', '> </pre>'].join('\n');

    expect(preserveMarkdownBlankLinesForEditor(markdown)).toBe(markdown);
  });

  it('does not add placeholders inside markdown html comments', () => {
    expect(
      preserveMarkdownBlankLinesForEditor(['<!--', 'note', '', 'comment', '-->', '', 'after'].join('\n'))
    ).toBe(['<!--', 'note', '', 'comment', '-->', '<br data-vlaina-empty-line="true" />', 'after'].join('\n'));
  });

  it('does not add placeholders inside lowercase html declarations', () => {
    expect(
      preserveMarkdownBlankLinesForEditor(['<!doctype', '', 'html>', '', 'after'].join('\n'))
    ).toBe(['<!doctype', '', 'html>', '<br data-vlaina-empty-line="true" />', 'after'].join('\n'));
  });

  it('round trips representative markdown through preserve and normalize', () => {
    const markdown = [
      '# Heading',
      '',
      'Paragraph with **strong** and [link](https://example.com).',
      '',
      '> Quote',
      '>',
      '> - [ ] task',
      '',
      '| a | b |',
      '| --- | --- |',
      '| 1 | 2 |',
      '',
      '```ts',
      'const value = 1;',
      '',
      'console.log(value);',
      '```',
      '',
      '<pre>',
      '',
      '</pre>',
      '',
      '    code line 1',
      '',
      '    code line 2',
    ].join('\n');

    expect(normalizeSerializedMarkdownDocument(preserveMarkdownBlankLinesForEditor(markdown))).toBe(markdown);
  });

  it('strips marked break placeholders after editor serialization', async () => {
    const serialized = await serializeMarkdownThroughEditor(
      '<br data-vlaina-empty-line="true" />',
      { preserveBlankLines: false },
    );

    expect(serialized).toBe('<br data-vlaina-empty-line="true" />\n');
    expect(normalizeSerializedMarkdownDocument(serialized)).toBe('\n');
  });

  it('round trips existing markdown blank lines through the editor parser and serializer', async () => {
    await expectEditorMarkdown(['1', '', '2', '', '', '3'].join('\n'));
  });

  it('round trips user-authored br tags through the editor parser and serializer', async () => {
    await expectEditorMarkdown(['1', '<br />', '2'].join('\n'));
  });

  it('round trips blockquote user-authored br tags through the editor parser and serializer', async () => {
    await expectEditorMarkdown(['> before', '> <br />', '> after'].join('\n'));
  });

  it('round trips nested blockquote user-authored br tags through the editor parser and serializer', async () => {
    await expectEditorMarkdown(['> > before', '> > <br />', '> > after'].join('\n'));
  });

  it('round trips blockquote paragraph blank lines through the editor parser and serializer', async () => {
    await expectEditorMarkdown(['> before', '>', '> after'].join('\n'));
  });

  it('round trips nested blockquote paragraph blank lines through the editor parser and serializer', async () => {
    await expectEditorMarkdown(['> > before', '> >', '> > after'].join('\n'));
  });

  it('round trips blank lines around lists through the editor parser and serializer', async () => {
    await expectEditorMarkdown(['Intro', '', '- one', '- two', '', 'Outro'].join('\n'));
  });

  it('round trips blank lines around tables through the editor parser and serializer', async () => {
    await expectEditorMarkdown(
      ['Intro', '', '| a | b |', '| --- | --- |', '| 1 | 2 |', '', 'Outro'].join('\n'),
      ['Intro', '', '| a | b |', '| - | - |', '| 1 | 2 |', '', 'Outro'].join('\n'),
    );
  });

  it('preserves user-authored blank lines between list items through the editor parser and serializer', async () => {
    await expectEditorMarkdown(['- one', '', '- two'].join('\n'));
  });

  it('round trips blockquote list blank lines through the editor parser and serializer', async () => {
    await expectEditorMarkdown(['> - one', '>', '> - two'].join('\n'));
  });

  it('preserves parenthesized ordered list blank lines through the editor parser and serializer', async () => {
    await expectEditorMarkdown(
      ['1) one', '', '2) two'].join('\n'),
      ['1. one', '', '2. two'].join('\n'),
    );
  });

  it('round trips mixed markdown blank lines and user-authored br tags through the editor parser and serializer', async () => {
    await expectEditorMarkdown(['A', '', '<br />', '', 'B'].join('\n'));
  });

  it('keeps indented code block blank lines through the editor parser and serializer', async () => {
    await expectEditorMarkdown(
      ['before', '', '    line 1', '', '    line 2'].join('\n'),
      ['before', '', '```', 'line 1', '', 'line 2', '```'].join('\n')
    );
  });

  it('keeps list item indented code blank lines through the editor parser and serializer', async () => {
    await expectEditorMarkdown(
      ['- item', '', '    code line 1', '', '    code line 2'].join('\n'),
      ['- item', '', '  code line 1', '', '  code line 2'].join('\n'),
    );
  });

  it('keeps nested list code block blank lines through the editor parser and serializer', async () => {
    await expectEditorMarkdown(
      ['- item', '', '      code line 1', '', '      code line 2'].join('\n'),
      ['- item', '', '  ```', '  code line 1', '', '  code line 2', '  ```'].join('\n'),
    );
  });
});
