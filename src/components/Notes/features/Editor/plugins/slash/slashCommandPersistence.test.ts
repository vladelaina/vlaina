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

describe('slash command markdown persistence', () => {
  it.each([
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
  ] satisfies Array<[SlashCommandId, string]>)(
    'persists %s as audited markdown',
    async (commandId, expected) => {
      await expect(runSlashCommandAndPersist(commandId)).resolves.toBe(expected);
    }
  );

  it('preserves existing text when converting a block to a heading', async () => {
    await expect(runSlashCommandAndPersist('heading-2', 'Existing text')).resolves.toBe('## Existing text');
  });
});
