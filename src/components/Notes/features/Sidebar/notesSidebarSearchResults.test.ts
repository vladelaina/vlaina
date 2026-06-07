import { describe, expect, it, vi } from 'vitest';
import type { FileTreeNode, FolderNode } from '@/stores/useNotesStore';
import {
  buildNotesSidebarSearchIndex,
  countNotesSidebarSearchEntries,
  queryNotesSidebarSearch,
  shouldSearchNotesSidebarContents,
} from './notesSidebarSearchResults';

const rootFolder: FolderNode = {
  id: 'root',
  name: 'Notes',
  path: '',
  isFolder: true,
  expanded: true,
  children: [
    {
      id: 'folder-projects',
      name: 'projects',
      path: 'projects',
      isFolder: true,
      expanded: true,
      children: [
        {
          id: 'note-alpha',
          name: 'alpha.md',
          path: 'projects/alpha.md',
          isFolder: false,
        },
        {
          id: 'note-notes',
          name: 'template-notes.md',
          path: 'projects/template-notes.md',
          isFolder: false,
        },
      ],
    },
    {
      id: 'note-zeta',
      name: 'note-zeta.md',
      path: 'note-zeta.md',
      isFolder: false,
    },
  ],
};

describe('notesSidebarSearchResults', () => {
  it('counts searchable notes in the tree', () => {
    expect(countNotesSidebarSearchEntries(rootFolder)).toBe(3);
  });

  it('searches note contents only after a two-character query', () => {
    expect(shouldSearchNotesSidebarContents('')).toBe(false);
    expect(shouldSearchNotesSidebarContents(' ')).toBe(false);
    expect(shouldSearchNotesSidebarContents('t')).toBe(false);
    expect(shouldSearchNotesSidebarContents('te')).toBe(true);
  });

  it('builds a flat search index with parent previews', () => {
    const index = buildNotesSidebarSearchIndex(rootFolder, (path) =>
      path === 'projects/template-notes.md' ? 'Weekly Notes' : '',
    );

    expect(index).toEqual([
      {
        path: 'projects/alpha.md',
        name: 'alpha.md',
        preview: 'projects/',
      },
      {
        path: 'projects/template-notes.md',
        name: 'Weekly Notes',
        preview: 'projects/',
      },
      {
        path: 'note-zeta.md',
        name: 'note-zeta.md',
        preview: '',
      },
    ]);
  });

  it('ignores non-Markdown file tree nodes when building the search index', () => {
    const mixedRoot: FolderNode = {
      id: 'root-mixed',
      name: 'Notes',
      path: '',
      isFolder: true,
      expanded: true,
      children: [
        {
          id: 'asset',
          name: 'asset.png',
          path: 'asset.png',
          isFolder: false,
        },
        {
          id: 'note',
          name: 'note.mdown',
          path: 'note.mdown',
          isFolder: false,
        },
      ],
    };

    expect(countNotesSidebarSearchEntries(mixedRoot)).toBe(1);
    expect(buildNotesSidebarSearchIndex(mixedRoot, () => '')).toEqual([
      {
        path: 'note.mdown',
        name: 'note.mdown',
        preview: '',
      },
    ]);
  });

  it('builds the search index for deeply nested notes without recursive traversal', () => {
    let current: FileTreeNode = {
      id: 'deep-note',
      name: 'deep.md',
      path: 'deep.md',
      isFolder: false,
    };

    for (let depth = 0; depth < 1500; depth += 1) {
      current = {
        id: `folder-${depth}`,
        name: `folder-${depth}`,
        path: `folder-${depth}`,
        isFolder: true,
        expanded: true,
        children: [current],
      };
    }

    expect(buildNotesSidebarSearchIndex(current as FolderNode, () => '')).toEqual([
      {
        path: 'deep.md',
        name: 'deep.md',
        preview: 'folder-0/',
      },
    ]);
  });

  it('caps oversized tree search indexes', () => {
    const largeRoot: FolderNode = {
      id: 'root-large',
      name: 'Notes',
      path: '',
      isFolder: true,
      expanded: true,
      children: Array.from({ length: 10_001 }, (_, index) => ({
        id: `note-${index}`,
        name: `note-${index}.md`,
        path: `note-${index}.md`,
        isFolder: false,
      })),
    };

    expect(countNotesSidebarSearchEntries(largeRoot)).toBe(10_000);
    expect(buildNotesSidebarSearchIndex(largeRoot, () => '')).toHaveLength(10_000);
  });

  it('adds external starred notes to the search index without duplicating current vault notes', () => {
    const index = buildNotesSidebarSearchIndex(rootFolder, () => '', {
      currentVaultPath: '/vault',
      starredEntries: [
        {
          id: 'star-current',
          kind: 'note',
          vaultPath: '/vault',
          relativePath: 'projects/alpha.md',
          addedAt: 1,
        },
        {
          id: 'star-external',
          kind: 'note',
          vaultPath: '/external',
          relativePath: 'clips/reference.md',
          addedAt: 2,
        },
        {
          id: 'star-folder',
          kind: 'folder',
          vaultPath: '/external',
          relativePath: 'clips',
          addedAt: 3,
        },
        {
          id: 'star-asset',
          kind: 'note',
          vaultPath: '/external',
          relativePath: 'clips/image.png',
          addedAt: 4,
        },
      ],
    });

    expect(index).toEqual([
      {
        path: 'projects/alpha.md',
        name: 'alpha.md',
        preview: 'projects/',
      },
      {
        path: 'projects/template-notes.md',
        name: 'template-notes.md',
        preview: 'projects/',
      },
      {
        path: 'note-zeta.md',
        name: 'note-zeta.md',
        preview: '',
      },
      {
        path: '/external/clips/reference.md',
        openPath: '/external/clips/reference.md',
        name: 'reference',
        preview: 'external/clips/',
        isExternal: true,
        contentSearchable: false,
      },
    ]);
  });

  it('keeps external starred notes that share a relative path with the current vault', () => {
    const index = buildNotesSidebarSearchIndex(rootFolder, () => '', {
      currentVaultPath: '/vault',
      starredEntries: [
        {
          id: 'star-external-same-relative-path',
          kind: 'note',
          vaultPath: '/other-vault',
          relativePath: 'projects/alpha.md',
          addedAt: 1,
        },
      ],
    });

    expect(index).toContainEqual({
      path: '/other-vault/projects/alpha.md',
      openPath: '/other-vault/projects/alpha.md',
      name: 'alpha',
      preview: 'other-vault/projects/',
      isExternal: true,
      contentSearchable: false,
    });
  });

  it('deduplicates external starred notes by absolute path', () => {
    const index = buildNotesSidebarSearchIndex(rootFolder, () => '', {
      currentVaultPath: '/vault',
      starredEntries: [
        {
          id: 'star-external-1',
          kind: 'note',
          vaultPath: '/other-vault',
          relativePath: 'projects/alpha.md',
          addedAt: 1,
        },
        {
          id: 'star-external-2',
          kind: 'note',
          vaultPath: '/other-vault',
          relativePath: 'projects/alpha.md',
          addedAt: 2,
        },
      ],
    });

    expect(index.filter((entry) => entry.path === '/other-vault/projects/alpha.md')).toHaveLength(1);
  });

  it('keeps current vault starred notes searchable when the file tree does not contain them yet', () => {
    const index = buildNotesSidebarSearchIndex(null, () => '', {
      currentVaultPath: '/vault',
      starredEntries: [
        {
          id: 'star-current-missing-tree',
          kind: 'note',
          vaultPath: '/vault',
          relativePath: 'inbox/later.md',
          addedAt: 1,
        },
      ],
    });

    expect(index).toEqual([
      {
        path: 'inbox/later.md',
        openPath: 'inbox/later.md',
        name: 'later',
        preview: 'inbox/',
        isExternal: false,
        contentSearchable: false,
      },
    ]);
  });

  it('filters and ranks matches by earliest position', () => {
    const index = buildNotesSidebarSearchIndex(rootFolder, () => '');
    const results = queryNotesSidebarSearch(index, 'te');

    expect(results.map((result) => result.path)).toEqual([
      'note-zeta.md',
      'projects/template-notes.md',
    ]);
    expect(results.map((result) => result.matchIndex)).toEqual([2, 0]);
    expect(results.map((result) => result.matchKind)).toEqual(['name', 'name']);
    expect(results.map((result) => result.id)).toEqual([
      'note-zeta.md::name',
      'projects/template-notes.md::name',
    ]);
  });

  it('matches parent folder paths after file name matches', () => {
    const index = buildNotesSidebarSearchIndex(rootFolder, () => '');
    const results = queryNotesSidebarSearch(index, 'projects');

    expect(results.map((result) => ({
      path: result.path,
      matchKind: result.matchKind,
    }))).toEqual([
      {
        path: 'projects/alpha.md',
        matchKind: 'path',
      },
      {
        path: 'projects/template-notes.md',
        matchKind: 'path',
      },
    ]);
  });

  it('returns multiple content matches with clean snippets after title matches', () => {
    const index = buildNotesSidebarSearchIndex(rootFolder, (path) =>
      path === 'projects/template-notes.md' ? 'Meeting Log' : '',
    );
    const results = queryNotesSidebarSearch(index, 'alpha', (path) => {
      if (path === 'projects/template-notes.md') {
        return [
          '## Weekly status update',
          '- [ ] alpha milestones and release prep.',
          '<iframe src=\"https://example.com/embed?height=265&theme-id=0&default-tab=css,result&embed-version=2\" frameborder=\"0\"></iframe>',
          'alpha release checklist is still open.',
        ].join('\n');
      }

      if (path === 'projects/alpha.md') {
        return 'alpha appears in the title and inside the note body too.';
      }

      return '';
    });

    expect(results.map((result) => ({
      path: result.path,
      matchKind: result.matchKind,
      ordinal: result.contentMatchOrdinal,
    }))).toEqual([
      {
        path: 'projects/alpha.md',
        matchKind: 'name',
        ordinal: null,
      },
      {
        path: 'projects/alpha.md',
        matchKind: 'content',
        ordinal: 0,
      },
      {
        path: 'projects/template-notes.md',
        matchKind: 'content',
        ordinal: 0,
      },
      {
        path: 'projects/template-notes.md',
        matchKind: 'content',
        ordinal: 1,
      },
    ]);
    expect(results[0].contentSnippet).toBeNull();
    expect(results[1].contentSnippet).toContain('alpha appears in the title');
    expect(results[2].contentSnippet).toContain('alpha milestones and release prep.');
    expect(results[2].contentSnippet).not.toContain('##');
    expect(results[2].contentSnippet).not.toContain('- [ ]');
    expect(results[2].contentSnippet).not.toContain('frameborder');
    expect(results[3].contentSnippet).toContain('alpha release checklist is still open.');
  });

  it('searches markdown content using visible inline text instead of link targets', () => {
    const index = [{
      path: 'links.md',
      name: 'links.md',
      preview: '',
    }];
    const results = queryNotesSidebarSearch(index, 'target', () => [
      '![target image](assets/diagram.png)',
      '[visible [target label]](assets/file(target).md#hidden-target)',
      '`target code`',
      'Plain target text.',
      '<span data-value="target">hidden attribute target</span>',
    ].join('\n'));

    expect(results.map((result) => result.contentSnippet)).toEqual([
      'target code',
      'Plain target text.',
      'visible [target label]',
    ]);
    expect(results.map((result) => result.contentMatchOrdinal)).toEqual([1, 2, 0]);
    expect(results.map((result) => result.contentSnippet).join(' ')).not.toContain('hidden-target');
    expect(results.map((result) => result.contentSnippet).join(' ')).not.toContain('data-value');
    expect(results.map((result) => result.contentSnippet)).not.toContain('target image');
  });

  it('does not search content inside sanitizer-dropped raw HTML blocks', () => {
    const index = [{
      path: 'raw-html.md',
      name: 'raw-html.md',
      preview: '',
    }];
    const results = queryNotesSidebarSearch(index, 'needle', () => [
      '<svg>',
      'hidden needle',
      '<svg><text>nested needle</text></svg>',
      '</svg>',
      'visible needle',
    ].join('\n'));

    expect(results.map((result) => result.contentSnippet)).toEqual(['visible needle']);
  });

  it('does not search content inside invisible GFM HTML blocks', () => {
    const index = [{
      path: 'invisible-html.md',
      name: 'invisible-html.md',
      preview: '',
    }];
    const results = queryNotesSidebarSearch(index, 'needle', () => [
      '<!--',
      'hidden comment needle',
      '-->',
      '<![CDATA[',
      'hidden cdata needle',
      ']]>',
      '<div>',
      'visible html needle',
      '</div>',
      'visible plain needle',
    ].join('\n'));

    expect(results.map((result) => result.contentSnippet)).toEqual([
      'visible html needle',
      'visible plain needle',
    ]);
  });

  it('does not run content search for a single-character query', () => {
    const index = buildNotesSidebarSearchIndex(rootFolder, () => '');
    const results = queryNotesSidebarSearch(index, 'x', (path) =>
      path === 'projects/alpha.md' ? 'single x content match' : '',
    );

    expect(results).toEqual([]);
  });

  it('caps content matches per note before ranking results', () => {
    const index = [{
      path: 'dense.md',
      name: 'dense.md',
      preview: '',
    }];
    const results = queryNotesSidebarSearch(index, 'needle', () =>
      Array.from({ length: 12 }, (_, index) => `line ${index} needle`).join('\n'),
    );

    expect(results).toHaveLength(5);
    expect(results.every((result) => result.matchKind === 'content')).toBe(true);
    expect(results.map((result) => result.contentMatchOrdinal)).toEqual([0, 1, 2, 3, 4]);
  });

  it('skips oversized content search lines before markdown inline parsing', () => {
    const index = [{
      path: 'large-line.md',
      name: 'large-line.md',
      preview: '',
    }];
    const results = queryNotesSidebarSearch(index, 'needle', () =>
      `${'x'.repeat(70 * 1024)} needle\nshort needle`
    );

    expect(results.map((result) => result.contentSnippet)).toEqual(['short needle']);
  });

  it('caps scanned content per note during sidebar content search', () => {
    const index = [{
      path: 'large-note.md',
      name: 'large-note.md',
      preview: '',
    }];
    const results = queryNotesSidebarSearch(index, 'needle', () =>
      `${Array.from({ length: 1024 }, () => 'x'.repeat(1024)).join('\n')}\nneedle`
    );

    expect(results).toEqual([]);
  });

  it('does not scan note contents when structural search results fill the result cap', () => {
    const index = Array.from({ length: 220 }, (_, index) => ({
      path: `notes/${String(index).padStart(3, '0')}.md`,
      name: `alpha ${index}.md`,
      preview: '',
    }));
    const getNoteContent = vi.fn(() => 'alpha body');

    const results = queryNotesSidebarSearch(index, 'alpha', getNoteContent);

    expect(results).toHaveLength(200);
    expect(results.every((result) => result.matchKind === 'name')).toBe(true);
    expect(getNoteContent).not.toHaveBeenCalled();
  });
});
