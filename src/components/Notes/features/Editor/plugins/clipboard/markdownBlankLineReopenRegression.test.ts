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
} from '@/lib/notes/markdown/markdownSerializationUtils';
import {
  normalizeLeadingFrontmatterMarkdown,
  serializeLeadingFrontmatterMarkdown,
} from '../frontmatter/frontmatterMarkdown';

interface ReopenSnapshot {
  persisted: string;
  texts: string[];
}

async function reopenMarkdown(markdown: string): Promise<ReopenSnapshot> {
  const editor = Editor.make()
    .config((ctx) => {
      ctx.set(defaultValueCtx, preserveMarkdownBlankLinesForEditor(
        normalizeLeadingFrontmatterMarkdown(normalizeSerializedMarkdownDocument(markdown))
      ));
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
  const docJson = view.state.doc.toJSON();
  const serialized = serializer(view.state.doc);
  await editor.destroy();
  return {
    persisted: stripTrailingNewlines(serializeLeadingFrontmatterMarkdown(
      normalizeSerializedMarkdownDocument(serialized),
      markdown
    )),
    texts: docJson.content?.map((node: any) => node.content?.[0]?.text ?? '') ?? [],
  };
}

function expectCleanPersistedMarkdown(markdown: string): void {
  expect(markdown).not.toContain('\u200B');
  expect(markdown).not.toContain('\u200C');
  expect(markdown).not.toContain('VLAINA_LIST_GAP_SENTINEL');
  expect(markdown).not.toMatch(/data-vlaina-/);
}

describe('markdown blank line reopen regressions', () => {
  it.each([
    {
      name: 'ordinary paragraph breaks',
      markdown: ['1', '', '2', '', '3'].join('\n'),
      texts: ['1', '2', '3'],
    },
    {
      name: 'one empty paragraph between typed lines',
      markdown: ['1', '', '2', '', '', '3'].join('\n'),
      texts: ['1', '2', '', '3'],
    },
    {
      name: 'two empty paragraphs between typed lines',
      markdown: ['1', '', '2', '', '', '', '3'].join('\n'),
      texts: ['1', '2', '', '', '3'],
    },
    {
      name: 'frontmatter plus one empty body paragraph',
      markdown: [
        '---',
        'vlaina_icon: "note"',
        '---',
        '1',
        '',
        '2',
        '',
        '',
        '3',
      ].join('\n'),
      texts: ['1', '2', '', '3'],
    },
  ])('reopens and immediately resaves stable blank lines: $name', async ({ markdown, texts }) => {
    const firstReopen = await reopenMarkdown(markdown);
    expect(firstReopen.texts).toEqual(texts);
    expect(firstReopen.persisted).toBe(markdown);
    expectCleanPersistedMarkdown(firstReopen.persisted);

    const secondReopen = await reopenMarkdown(firstReopen.persisted);
    expect(secondReopen.texts).toEqual(texts);
    expect(secondReopen.persisted).toBe(firstReopen.persisted);
  });
});
