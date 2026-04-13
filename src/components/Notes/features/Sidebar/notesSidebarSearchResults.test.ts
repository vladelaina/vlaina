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

  it('requires at least two characters before searching note contents', () => {
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
});
