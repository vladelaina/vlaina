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
import { configureTheme } from '../../theme';
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
import { mathPlugin } from '../math';
import { calloutPlugin } from '../callout';
import { footnotePlugin } from '../footnote';
import { frontmatterPlugin } from '../frontmatter';
import { highlightPlugin } from '../highlight';
import { mermaidPlugin } from '../mermaid';
import { videoPlugin } from '../video';
import { tocPlugin } from '../toc';
import { blockAlignmentPlugin } from '../floating-toolbar';
import { colorMarksPlugin } from '../floating-toolbar/colorMarks';
import { codePlugin } from '../code';
import { applySlashCommand, type SlashCommandId } from './slashCommands';

const slashPersistencePlugins = [
  ...mathPlugin,
  ...calloutPlugin,
  ...footnotePlugin,
  ...frontmatterPlugin,
  ...highlightPlugin,
  ...mermaidPlugin,
  ...videoPlugin,
  ...tocPlugin,
  ...blockAlignmentPlugin,
  ...colorMarksPlugin,
  ...codePlugin,
];

const slashCommandPersistenceCases = [
  ['heading-1', '# #'],
  ['heading-2', '## ##'],
  ['heading-3', '### ###'],
  ['heading-4', '#### ####'],
  ['heading-5', '##### #####'],
  ['heading-6', '###### ######'],
  ['task-list', '- [ ]'],
  ['ordered-list', '1.'],
  ['bullet-list', '-'],
  ['quote', '> <br />'],
  ['divider', '---'],
  ['code-block', ['```', '```'].join('\n')],
  ['table', ['|   |   |   |', '| :----- | :----- | :----- |', '|   |   |   |', '|   |   |   |'].join('\n')],
  ['frontmatter', ['---', '---'].join('\n')],
  ['equation', ['$$', '$$'].join('\n')],
  ['inline-math', '$$'],
  ['toc', '[TOC]'],
  ['mermaid', ['```mermaid', '```'].join('\n')],
  ['footnote', '[^1]'],
  ['footnote-definition', '[^1]:'],
  ['abbreviation', '*[ABBR]: Full phrase'],
] satisfies Array<[SlashCommandId, string]>;

const structurallyStableSlashCommandIds = new Set<SlashCommandId>(
  slashCommandPersistenceCases
    .map(([commandId]) => commandId)
    .filter((commandId) => commandId !== 'inline-math' && commandId !== 'footnote')
);

async function runSlashCommandAndPersist(commandId: SlashCommandId, markdown = '') {
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
    .use(gfm)
    .use(configureTheme);

  for (const plugin of slashPersistencePlugins) {
    editor.use(plugin);
  }

  await editor.create();
  applySlashCommand(editor.ctx, commandId);

  const view = editor.ctx.get(editorViewCtx);
  const serializer = editor.ctx.get(serializerCtx);
  const serialized = serializer(view.state.doc);
  const persisted = stripTrailingNewlines(
    serializeLeadingFrontmatterMarkdown(normalizeSerializedMarkdownDocument(serialized), markdown)
  );

  await editor.destroy();
  return persisted;
}

async function reopenMarkdownAndPersist(markdown: string) {
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
    .use(gfm)
    .use(configureTheme);

  for (const plugin of slashPersistencePlugins) {
    editor.use(plugin);
  }

  await editor.create();
  const view = editor.ctx.get(editorViewCtx);
  const serializer = editor.ctx.get(serializerCtx);
  const docJson = view.state.doc.toJSON();
  const serialized = serializer(view.state.doc);
  const persisted = stripTrailingNewlines(
    serializeLeadingFrontmatterMarkdown(normalizeSerializedMarkdownDocument(serialized), markdown)
  );

  await editor.destroy();
  return { docJson, persisted };
}

function collectNodes(value: unknown): Array<{ type?: unknown; attrs?: unknown; text?: unknown }> {
  if (!value || typeof value !== 'object') return [];

  const node = value as { type?: unknown; attrs?: unknown; text?: unknown; content?: unknown };
  const children = Array.isArray(node.content) ? node.content.flatMap(collectNodes) : [];
  return [node, ...children];
}

describe('slash command markdown persistence', () => {
  it.each(slashCommandPersistenceCases)(
    'persists %s as audited markdown',
    async (commandId, expected) => {
      await expect(runSlashCommandAndPersist(commandId)).resolves.toBe(expected);
    }
  );

  it.each(slashCommandPersistenceCases.filter(([commandId]) => structurallyStableSlashCommandIds.has(commandId)))(
    'reopens persisted %s markdown without changing it',
    async (commandId, expected) => {
      const firstPersisted = await runSlashCommandAndPersist(commandId);
      expect(firstPersisted).toBe(expected);

      const reopened = await reopenMarkdownAndPersist(firstPersisted);
      expect(reopened.persisted).toBe(expected);
    }
  );

  it('preserves existing text when converting a block to a heading', async () => {
    await expect(runSlashCommandAndPersist('heading-2', 'Existing text')).resolves.toBe('## Existing text');
  });

  it.each([
    {
      commandId: 'task-list',
      expected: '- [ ]',
      expectedNodes: [
        { type: 'bullet_list' },
        { type: 'list_item', attrs: expect.objectContaining({ checked: false }) },
      ],
    },
    {
      commandId: 'ordered-list',
      expected: '1.',
      expectedNodes: [
        { type: 'ordered_list' },
        { type: 'list_item' },
      ],
    },
    {
      commandId: 'bullet-list',
      expected: '-',
      expectedNodes: [
        { type: 'bullet_list' },
        { type: 'list_item' },
      ],
    },
    {
      commandId: 'quote',
      expected: '> <br />',
      expectedNodes: [
        { type: 'blockquote' },
      ],
    },
  ] satisfies Array<{
    commandId: SlashCommandId;
    expected: string;
    expectedNodes: Array<{ type: string; attrs?: unknown }>;
  }>)('reopens persisted empty $commandId as structure, not literal text', async ({
    commandId,
    expected,
    expectedNodes,
  }) => {
    const firstPersisted = await runSlashCommandAndPersist(commandId);
    expect(firstPersisted).toBe(expected);

    const reopened = await reopenMarkdownAndPersist(firstPersisted);
    const reopenedNodes = collectNodes(reopened.docJson);

    for (const expectedNode of expectedNodes) {
      expect(reopenedNodes).toContainEqual(expect.objectContaining(expectedNode));
    }
    expect(reopened.persisted).toBe(expected);
  });
});
