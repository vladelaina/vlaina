import { describe, expect, it } from 'vitest';
import type { FolderNode } from '@/stores/useNotesStore';
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

  it('searches note contents for a single non-empty character', () => {
    expect(shouldSearchNotesSidebarContents('')).toBe(false);
    expect(shouldSearchNotesSidebarContents(' ')).toBe(false);
    expect(shouldSearchNotesSidebarContents('t')).toBe(true);
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
        ordinal: 0,
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

  it('returns content matches for a single-character query', () => {
    const index = buildNotesSidebarSearchIndex(rootFolder, () => '');
    const results = queryNotesSidebarSearch(index, 'x', (path) =>
      path === 'projects/alpha.md' ? 'single x content match' : '',
    );

    expect(results).toEqual([
      expect.objectContaining({
        path: 'projects/alpha.md',
        matchKind: 'content',
        contentSnippet: 'single x content match',
      }),
    ]);
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
});
