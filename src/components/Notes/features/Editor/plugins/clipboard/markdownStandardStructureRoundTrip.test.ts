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
import { configureTheme } from '../../theme';
import {
  normalizeSerializedMarkdownDocument,
  preserveMarkdownBlankLinesForEditor,
  stripTrailingNewlines,
} from '@/lib/notes/markdown/markdownSerializationUtils';

interface EditorRoundTripSnapshot {
  docJson: unknown;
  persisted: string;
}

async function openMarkdownThroughEditor(markdown: string): Promise<EditorRoundTripSnapshot> {
  const editor = Editor.make()
    .config((ctx) => {
      ctx.set(defaultValueCtx, preserveMarkdownBlankLinesForEditor(
        normalizeSerializedMarkdownDocument(markdown)
      ));
      ctx.update(remarkStringifyOptionsCtx, (prev) => ({
        ...prev,
        ...notesRemarkStringifyOptions,
      }));
    })
    .use(commonmark)
    .use(gfm)
    .use(configureTheme);

  await editor.create();
  const view = editor.ctx.get(editorViewCtx);
  const serializer = editor.ctx.get(serializerCtx);
  const serialized = serializer(view.state.doc);
  const docJson = view.state.doc.toJSON();
  await editor.destroy();

  return {
    docJson,
    persisted: normalizeSerializedMarkdownDocument(serialized),
  };
}

function expectPersistedMarkdownToBeClean(markdown: string): void {
  expect(markdown).not.toMatch(/data-vlaina-/);
  expect(markdown).not.toMatch(/date-vlaina-/);
  expect(markdown).not.toContain('\u200B');
  expect(markdown).not.toContain('\u200C');
  expect(markdown).not.toContain('VLAINA_LIST_GAP_SENTINEL');
}

async function expectStableMarkdownStructure(markdown: string): Promise<void> {
  const firstOpen = await openMarkdownThroughEditor(markdown);
  const firstPersisted = stripTrailingNewlines(firstOpen.persisted);
  expectPersistedMarkdownToBeClean(firstPersisted);

  const secondOpen = await openMarkdownThroughEditor(firstPersisted);
  const secondPersisted = stripTrailingNewlines(secondOpen.persisted);
  expectPersistedMarkdownToBeClean(secondPersisted);
  expect(secondOpen.docJson).toEqual(firstOpen.docJson);
  expect(secondPersisted).toBe(firstPersisted);
}

describe('standard markdown structure persistence', () => {
  it.each([
    {
      name: 'headings and paragraphs',
      markdown: ['# Level 1', '## Level 2', '', 'Paragraph text.'].join('\n'),
    },
    {
      name: 'closed atx headings',
      markdown: ['# Level 1 #', '### Level 3 ###'].join('\n'),
    },
    {
      name: 'setext headings',
      markdown: ['Level 1', '=======', '', 'Level 2', '-------'].join('\n'),
    },
    {
      name: 'inline marks links and images',
      markdown: [
        'Text with **bold**, *italic*, ~~strike~~, `code`, [link](https://example.com), and ![alt](img.png).',
      ].join('\n'),
    },
    {
      name: 'reference links and definitions',
      markdown: [
        'Read [the docs][docs] and visit <https://example.com>.',
        '',
        '[docs]: https://example.com/docs "Docs"',
      ].join('\n'),
    },
    {
      name: 'reference definitions with escaped labels and titles',
      markdown: [
        'Read [Docs \\[draft\\]][docs-draft].',
        '',
        '[docs-draft]: <docs/file name.md> "Docs & Notes"',
      ].join('\n'),
    },
    {
      name: 'links with parentheses and titles',
      markdown: [
        'Read [the guide](https://example.com/docs/a_(b) "Guide title").',
      ].join('\n'),
    },
    {
      name: 'links with angle destination and escaped title quotes',
      markdown: [
        'Open [the file](<docs/file name.md> "File \\"Guide\\"").',
      ].join('\n'),
    },
    {
      name: 'links with spaces parentheses and query parameters',
      markdown: [
        'Open [local doc](<docs/file (draft).md?x=1&y=2>) and [remote](https://example.com/a_(b)?q=one&v=two).',
      ].join('\n'),
    },
    {
      name: 'autolinks for urls and email addresses',
      markdown: [
        'Visit <https://example.com/search?q=one&sort=two> or email <user@example.com>.',
      ].join('\n'),
    },
    {
      name: 'collapsed and shortcut reference links',
      markdown: [
        'Read [Guide][] and [API].',
        '',
        '[guide]: https://example.com/guide "Guide"',
        '[api]: https://example.com/api',
      ].join('\n'),
    },
    {
      name: 'inline html and escaped markdown punctuation',
      markdown: 'Inline <kbd>Ctrl</kbd> and escaped \\*literal\\* text.',
    },
    {
      name: 'entities and literal ampersands',
      markdown: 'Use AT&T, &copy;, and 3 &lt; 5 in text.',
    },
    {
      name: 'nested emphasis and code punctuation',
      markdown: 'Use ***bold italic***, **bold with `code`**, and `*literal* [text]`.',
    },
    {
      name: 'inline code with embedded backticks and spaces',
      markdown: 'Run `` npm run `build` `` and keep ` leading and trailing ` spaces.',
    },
    {
      name: 'inline code with markdown punctuation and entities',
      markdown: 'Code spans keep `*literal* [text] &lt;tag&gt;` as text.',
    },
    {
      name: 'literal escaped markdown punctuation',
      markdown: '\\# Not a heading, \\[not a link\\], and \\`not code\\`.',
    },
    {
      name: 'nested lists and task items',
      markdown: [
        '- one',
        '  - nested',
        '  - [x] task',
        '- two',
        '',
        '1. first',
        '2. second',
      ].join('\n'),
    },
    {
      name: 'ordered list start and loose items',
      markdown: [
        '3. third',
        '',
        '   continued third',
        '',
        '4. fourth',
      ].join('\n'),
    },
    {
      name: 'parenthesized ordered list markers',
      markdown: [
        '1) first',
        '2) second',
      ].join('\n'),
    },
    {
      name: 'loose task list items',
      markdown: [
        '- [ ] first task',
        '',
        '  first task detail',
        '',
        '- [x] second task',
      ].join('\n'),
    },
    {
      name: 'task list marker case variants',
      markdown: [
        '- [X] uppercase checked',
        '- [x] lowercase checked',
        '- [ ] unchecked',
      ].join('\n'),
    },
    {
      name: 'list item with nested paragraph and fenced code',
      markdown: [
        '- first item',
        '',
        '  first item detail',
        '',
        '  ```',
        '  const value = 1;',
        '  ```',
        '',
        '- second item',
      ].join('\n'),
    },
    {
      name: 'mixed nested ordered and unordered lists',
      markdown: [
        '1. first',
        '   - nested bullet',
        '   - another bullet',
        '2. second',
      ].join('\n'),
    },
    {
      name: 'blockquotes',
      markdown: ['> quote', '>', '> after'].join('\n'),
    },
    {
      name: 'blockquote ordered list start',
      markdown: ['> 5. fifth', '>', '> 6. sixth'].join('\n'),
    },
    {
      name: 'blockquote lists',
      markdown: ['> - one', '>', '> - two'].join('\n'),
    },
    {
      name: 'blockquote with nested list and code',
      markdown: [
        '> Intro',
        '>',
        '> - item',
        '>',
        '> ```ts',
        '> const value = 1;',
        '> ```',
      ].join('\n'),
    },
    {
      name: 'tables',
      markdown: ['| A | B |', '| --- | --- |', '| 1 | 2 |'].join('\n'),
    },
    {
      name: 'aligned tables and escaped pipes',
      markdown: [
        '| Left | Right |',
        '| :--- | ---: |',
        '| a \\| b | 2 |',
      ].join('\n'),
    },
    {
      name: 'tables with inline marks links and entities',
      markdown: [
        '| Name | Detail |',
        '| --- | --- |',
        '| **Bold** | [Link](https://example.com?a=1&b=2) and 3 &lt; 5 |',
      ].join('\n'),
    },
    {
      name: 'tables with code pipes and markdown punctuation',
      markdown: [
        '| Code | Text |',
        '| --- | --- |',
        '| `a \\| b` | \\*literal\\* and \\[text\\] |',
      ].join('\n'),
    },
    {
      name: 'tables with links images and escaped backslashes',
      markdown: [
        '| Link | Path |',
        '| --- | --- |',
        '| [Docs](https://example.com?a=1&b=2) | `C:\\\\Users\\\\demo` |',
        '| ![Alt \\| text](image.png "Title") | backslash \\\\ value |',
      ].join('\n'),
    },
    {
      name: 'fenced code',
      markdown: [
        '```ts',
        'const value = 1;',
        '',
        'console.log(value);',
        '```',
      ].join('\n'),
    },
    {
      name: 'tilde fenced code',
      markdown: [
        '~~~js',
        'const value = 1;',
        '~~~',
      ].join('\n'),
    },
    {
      name: 'fenced code containing shorter fence',
      markdown: [
        '````md',
        '```ts',
        'const value = 1;',
        '```',
        '````',
      ].join('\n'),
    },
    {
      name: 'raw html block',
      markdown: [
        '<pre>',
        'raw',
        '</pre>',
      ].join('\n'),
    },
    {
      name: 'generic html block with blank line',
      markdown: [
        '<div>',
        'line 1',
        '',
        'line 2',
        '</div>',
      ].join('\n'),
    },
    {
      name: 'html processing and declaration blocks',
      markdown: [
        '<?note value?>',
        '',
        '<!doctype html>',
        '',
        'after',
      ].join('\n'),
    },
    {
      name: 'html cdata block',
      markdown: [
        '<![CDATA[',
        'a < b',
        '',
        'c > d',
        ']]>',
      ].join('\n'),
    },
    {
      name: 'html comment block',
      markdown: ['<!-- note -->', '', 'after'].join('\n'),
    },
    {
      name: 'hard break tag',
      markdown: [
        'before',
        '<br />',
        'after',
      ].join('\n'),
    },
    {
      name: 'backslash hard break',
      markdown: ['before\\', 'after'].join('\n'),
    },
    {
      name: 'two-space hard break',
      markdown: ['before  ', 'after'].join('\n'),
    },
    {
      name: 'soft line break',
      markdown: ['before', 'after'].join('\n'),
    },
    {
      name: 'horizontal rule',
      markdown: [
        'before',
        '',
        '---',
      ].join('\n'),
    },
    {
      name: 'horizontal rule variants',
      markdown: [
        'before',
        '',
        '***',
        '',
        'middle',
        '',
        '___',
        '',
        'after',
      ].join('\n'),
    },
  ])('keeps parsed structure stable after reopen: $name', async ({ markdown }) => {
    await expectStableMarkdownStructure(markdown);
  });
});
