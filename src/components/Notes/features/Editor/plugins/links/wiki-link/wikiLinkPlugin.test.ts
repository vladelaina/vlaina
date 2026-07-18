import { describe, expect, it } from 'vitest';
import {
  Editor,
  defaultValueCtx,
  editorViewCtx,
  remarkStringifyOptionsCtx,
  serializerCtx,
} from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { wikiLinkPlugin } from './wikiLinkPlugin';
import { resolveWikiLinkNotePath } from './wikiLinkResolver';
import type { FileTreeNode } from '@/stores/notes/types';

async function createEditor(markdown: string) {
  const editor = Editor.make()
    .config((ctx) => {
      ctx.set(defaultValueCtx, markdown);
      ctx.update(remarkStringifyOptionsCtx, (options) => ({
        ...options,
        bullet: '-',
      }));
    })
    .use(commonmark)
    .use(wikiLinkPlugin);
  await editor.create();
  return editor;
}

describe('wikiLinkPlugin', () => {
  it('parses editable wiki links and preserves their markdown syntax', async () => {
    const editor = await createEditor('See [[Project Alpha]] and [[Project Beta|the beta note]].');
    const view = editor.ctx.get(editorViewCtx);
    const links = Array.from(view.dom.querySelectorAll<HTMLElement>('[data-wiki-link-target]'));

    expect(links.map((link) => [link.dataset.wikiLinkTarget, link.textContent])).toEqual([
      ['Project Alpha', 'Project Alpha'],
      ['Project Beta', 'the beta note'],
    ]);
    expect(links.every((link) => link.getAttribute('contenteditable') !== 'false')).toBe(true);
    expect(editor.ctx.get(serializerCtx)(view.state.doc).trimEnd()).toBe(
      'See [[Project Alpha]] and [[Project Beta|the beta note]].',
    );

    await editor.destroy();
  });

  it('leaves escaped wiki-link syntax as plain text', async () => {
    const editor = await createEditor(String.raw`Keep \[[Project Alpha]] literal.`);
    const view = editor.ctx.get(editorViewCtx);

    expect(view.dom.querySelector('[data-wiki-link-target]')).toBeNull();
    expect(view.dom.textContent).toContain('Keep [[Project Alpha]] literal.');

    await editor.destroy();
  });
});

describe('resolveWikiLinkNotePath', () => {
  const nodes: FileTreeNode[] = [
    {
      id: 'root-project',
      name: 'Project.md',
      path: 'Project.md',
      isFolder: false,
    },
    {
      id: 'docs',
      name: 'docs',
      path: 'docs',
      isFolder: true,
      expanded: true,
      children: [{
        id: 'docs-project',
        name: 'Project.md',
        path: 'docs/Project.md',
        isFolder: false,
      }],
    },
  ];

  it('matches titles case-insensitively and prefers the current directory', () => {
    expect(resolveWikiLinkNotePath('project', nodes, 'docs/current.md')).toBe('docs/Project.md');
    expect(resolveWikiLinkNotePath('PROJECT', nodes, 'other/current.md')).toBe('Project.md');
  });

  it('returns null for missing titles', () => {
    expect(resolveWikiLinkNotePath('Missing', nodes, 'docs/current.md')).toBeNull();
  });
});
