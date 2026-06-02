import { describe, expect, it } from 'vitest';
import {
  Editor,
  defaultValueCtx,
  editorViewCtx,
  remarkStringifyOptionsCtx,
  serializerCtx,
} from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { icons } from '@/components/ui/icons/registry';
import { normalizeSerializedMarkdownDocument, stripTrailingNewlines } from '@/lib/notes/markdown/markdownSerializationUtils';
import { notesRemarkStringifyOptions } from '../../config/stringifyOptions';
import { applySlashCommand } from './slashCommands';
import {
  collectFootnoteIds,
  getNextFootnoteDefId,
  getNextFootnoteRefId,
  slashCommandDefinitions,
} from './slashCommandDefinitions';

function createDoc(nodes: Array<{ type: string; id?: string; label?: string }>) {
  return {
    descendants(callback: (node: any) => void) {
      for (const node of nodes) {
        callback({
          type: { name: node.type },
          attrs: {
            ...(node.id ? { id: node.id } : {}),
            ...(node.label ? { label: node.label } : {}),
          },
        });
      }
    },
  };
}

describe('slashCommandDefinitions', () => {
  it('uses unique menu and command ids', () => {
    const ids = slashCommandDefinitions.map((definition) => definition.id);
    const commandIds = slashCommandDefinitions.map((definition) => definition.commandId);

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(commandIds).size).toBe(commandIds.length);
  });

  it('uses registered icon names', () => {
    for (const definition of slashCommandDefinitions) {
      expect(icons[definition.icon], definition.id).toBeDefined();
    }
  });

  it('persists an empty slash-created heading as unambiguous markdown', async () => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, '');
        ctx.update(remarkStringifyOptionsCtx, (prev) => ({
          ...prev,
          ...notesRemarkStringifyOptions,
        }));
      })
      .use(commonmark);

    await editor.create();
    applySlashCommand(editor.ctx, 'heading-1');

    const view = editor.ctx.get(editorViewCtx);
    const serializer = editor.ctx.get(serializerCtx);
    const normalized = stripTrailingNewlines(
      normalizeSerializedMarkdownDocument(serializer(view.state.doc))
    );

    expect(view.state.doc.firstChild?.type.name).toBe('heading');
    expect(normalized).toBe('# #');

    await editor.destroy();
  });

  it('keeps common writing commands before advanced inserts', () => {
    const ids = slashCommandDefinitions.map((definition) => definition.id as string);

    expect(ids).toEqual([
      'heading-1',
      'heading-2',
      'heading-3',
      'heading-4',
      'heading-5',
      'heading-6',
      'task-list',
      'ordered-list',
      'bullet-list',
      'quote',
      'callout',
      'divider',
      'code-block',
      'table',
      'image',
      'frontmatter',
      'equation',
      'inline-math',
      'toc',
      'mermaid',
      'footnote',
      'footnote-definition',
      'abbreviation',
      'video',
    ]);

    expect(ids.includes('text')).toBe(false);
  });
});

describe('footnote id helpers', () => {
  it('collects footnote references and definitions separately', () => {
    const ids = collectFootnoteIds(createDoc([
      { type: 'footnote_ref', id: '1' },
      { type: 'footnote_def', id: '2' },
      { type: 'paragraph' },
    ]));

    expect(Array.from(ids.refs)).toEqual(['1']);
    expect(Array.from(ids.defs)).toEqual(['2']);
  });

  it('collects active GFM footnote labels separately', () => {
    const ids = collectFootnoteIds(createDoc([
      { type: 'footnote_reference', label: '1' },
      { type: 'footnote_definition', label: '2' },
      { type: 'paragraph' },
    ]));

    expect(Array.from(ids.refs)).toEqual(['1']);
    expect(Array.from(ids.defs)).toEqual(['2']);
  });

  it('allocates the next reference id after existing refs and defs', () => {
    expect(getNextFootnoteRefId(createDoc([
      { type: 'footnote_ref', id: '1' },
      { type: 'footnote_def', id: '2' },
    ]))).toBe('3');
  });

  it('uses the first reference without a definition for new definitions', () => {
    expect(getNextFootnoteDefId(createDoc([
      { type: 'footnote_ref', id: '1' },
      { type: 'footnote_ref', id: '2' },
      { type: 'footnote_def', id: '2' },
    ]))).toBe('1');
  });

  it('keeps nonnumeric pending references deterministic after numeric ids', () => {
    expect(getNextFootnoteDefId(createDoc([
      { type: 'footnote_ref', id: 'b-note' },
      { type: 'footnote_ref', id: '2' },
      { type: 'footnote_ref', id: 'a-note' },
      { type: 'footnote_def', id: '2' },
    ]))).toBe('a-note');
  });
});
