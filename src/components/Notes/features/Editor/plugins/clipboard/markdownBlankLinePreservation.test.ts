import { describe, expect, it } from 'vitest';
import {
  Editor,
  defaultValueCtx,
  editorViewCtx,
  remarkStringifyOptionsCtx,
  serializerCtx,
} from '@milkdown/kit/core';
import type { EditorView } from '@milkdown/kit/prose/view';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import { notesRemarkStringifyOptions } from '../../config/stringifyOptions';
import {
  normalizeSerializedMarkdownDocument,
  preserveMarkdownBlankLinesForEditor,
  stripTrailingNewlines,
} from '@/lib/notes/markdown/markdownSerializationUtils';

const EMPTY_LINE_PLACEHOLDER = '\u200B';

function pressEnter(view: EditorView): void {
  const event = new KeyboardEvent('keydown', {
    key: 'Enter',
    bubbles: true,
    cancelable: true,
  });

  let handled = false;
  view.someProp('handleKeyDown', (handleKeyDown: any) => {
    handled = handleKeyDown(view, event) || handled;
  });

  expect(handled).toBe(true);
}

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
  const normalized = normalizeSerializedMarkdownDocument(serialized);
  expectPersistedMarkdownToBeClean(normalized);
  expect(stripTrailingNewlines(normalized)).toBe(expected);
}

function expectPersistedMarkdownToBeClean(markdown: string): void {
  expect(markdown).not.toMatch(/data-vlaina-/);
  expect(markdown).not.toMatch(/date-vlaina-/);
  expect(markdown).not.toContain('\u200B');
  expect(markdown).not.toContain('\u200C');
  expect(markdown).not.toContain('VLAINA_LIST_GAP_SENTINEL');
}

describe('preserveMarkdownBlankLinesForEditor', () => {
  it('strips marked break placeholders after editor serialization', async () => {
    const serialized = await serializeMarkdownThroughEditor(
      EMPTY_LINE_PLACEHOLDER,
      { preserveBlankLines: false },
    );

    expect(serialized).toBe(`${EMPTY_LINE_PLACEHOLDER}\n`);
    expect(normalizeSerializedMarkdownDocument(serialized)).toBe('\n');
  });

  it('round trips existing markdown blank lines through the editor parser and serializer', async () => {
    await expectEditorMarkdown(['1', '', '2', '', '', '3'].join('\n'));
  });

  it('persists editor-created paragraph line breaks so they survive reopen', async () => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, '');
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

    view.dispatch(view.state.tr.insertText('1'));
    pressEnter(view);
    view.dispatch(view.state.tr.insertText('2'));
    pressEnter(view);
    view.dispatch(view.state.tr.insertText('3'));

    const serialized = serializer(view.state.doc);
    const normalized = normalizeSerializedMarkdownDocument(serialized);
    expect(stripTrailingNewlines(normalized)).toBe(['1', '', '2', '', '3'].join('\n'));

    const reopened = await serializeMarkdownThroughEditor(normalized);
    expect(stripTrailingNewlines(normalizeSerializedMarkdownDocument(reopened))).toBe(
      ['1', '', '2', '', '3'].join('\n')
    );

    await editor.destroy();
  });

  it('persists an editor-created empty line between typed paragraph lines', async () => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, '');
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

    view.dispatch(view.state.tr.insertText('1'));
    pressEnter(view);
    view.dispatch(view.state.tr.insertText('2'));
    pressEnter(view);
    pressEnter(view);
    view.dispatch(view.state.tr.insertText('3'));

    const serialized = serializer(view.state.doc);
    const normalized = normalizeSerializedMarkdownDocument(serialized);
    expect(stripTrailingNewlines(normalized)).toBe(['1', '', '2', '', '', '3'].join('\n'));

    const reopened = await serializeMarkdownThroughEditor(normalized);
    expect(stripTrailingNewlines(normalizeSerializedMarkdownDocument(reopened))).toBe(
      ['1', '', '2', '', '', '3'].join('\n')
    );

    await editor.destroy();
  });

  it.each([
    {
      name: 'paragraphs and inline marks',
      markdown: [
        'Plain paragraph with **bold**, *italic*, ~~strike~~, `code`, and [link](https://example.com).',
        '',
        'Second paragraph with escaped punctuation: \\*literal\\*.',
      ].join('\n'),
      expected: [
        'Plain paragraph with **bold**, *italic*, ~~strike~~, `code`, and [link](https://example.com).',
        '',
        'Second paragraph with escaped punctuation: \\*literal\\*.',
      ].join('\n'),
    },
    {
      name: 'nested unordered and ordered lists',
      markdown: [
        '- one',
        '  - nested',
        '  - nested two',
        '- two',
        '',
        '1. first',
        '2. second',
      ].join('\n'),
    },
    {
      name: 'task lists',
      markdown: [
        '- [ ] unchecked',
        '- [x] checked',
        '  - [ ] nested',
      ].join('\n'),
    },
    {
      name: 'blockquotes and nested blockquotes',
      markdown: [
        '> quote',
        '>',
        '> - item',
        '> > nested quote',
      ].join('\n'),
      expected: [
        '> quote',
        '>',
        '> - item',
        '>',
        '> > nested quote',
      ].join('\n'),
    },
    {
      name: 'links and images',
      markdown: [
        '[Docs](https://example.com "Title")',
        '',
        '![Alt text](image.png "Image title")',
      ].join('\n'),
    },
    {
      name: 'fenced code with blank lines',
      markdown: [
        '```ts',
        'const value = 1;',
        '',
        'console.log(value);',
        '```',
      ].join('\n'),
    },
    {
      name: 'raw html blocks',
      markdown: [
        '<pre>',
        'line 1',
        '',
        'line 2',
        '</pre>',
      ].join('\n'),
    },
    {
      name: 'hard break tags',
      markdown: [
        'before',
        '<br />',
        'after',
      ].join('\n'),
      expected: [
        'before\\',
        'after',
      ].join('\n'),
    },
    {
      name: 'tables',
      markdown: [
        '| Left | Right |',
        '| --- | --- |',
        '| A | B |',
      ].join('\n'),
      expected: [
        '| Left | Right |',
        '| ---- | ----- |',
        '| A    | B     |',
      ].join('\n'),
    },
    {
      name: 'horizontal rules',
      markdown: [
        'before',
        '',
        '---',
        '',
        'after',
      ].join('\n'),
    },
  ])('round trips standard markdown without internal persistence markers: $name', async ({ markdown, expected }) => {
    await expectEditorMarkdown(markdown, expected ?? markdown);
  });

  it('does not add synthetic blank lines between adjacent headings', async () => {
    await expectEditorMarkdown([
      '# Level 1',
      '## Level 2',
      '### Level 3',
      '#### Level 4',
      '##### Level 5',
      '###### Level 6',
    ].join('\n'));
  });

  it('preserves user-authored blank lines between adjacent headings', async () => {
    await expectEditorMarkdown(['# Level 1', '', '## Level 2'].join('\n'));
  });

  it('round trips user-authored br tags through the editor parser and serializer', async () => {
    await expectEditorMarkdown(['1', '<br />', '2'].join('\n'), ['1\\', '2'].join('\n'));
  });

  it('round trips blockquote user-authored br tags through the editor parser and serializer', async () => {
    await expectEditorMarkdown(
      ['> before', '> <br />', '> after'].join('\n'),
      ['> before\\', '> after'].join('\n'),
    );
  });

  it('round trips nested blockquote user-authored br tags through the editor parser and serializer', async () => {
    await expectEditorMarkdown(
      ['> > before', '> > <br />', '> > after'].join('\n'),
      ['> > before\\', '> > after'].join('\n'),
    );
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
    await expectEditorMarkdown(['A', '', '<br />', '', 'B'].join('\n'), ['A', '', '', 'B'].join('\n'));
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
