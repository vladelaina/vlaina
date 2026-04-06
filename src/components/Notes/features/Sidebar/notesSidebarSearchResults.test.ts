import { describe, expect, it } from 'vitest';
import type { FolderNode } from '@/stores/useNotesStore';
import {
  buildNotesSidebarSearchIndex,
  queryNotesSidebarSearch,
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
      'projects/template-notes.md',
      'note-zeta.md',
    ]);
    expect(results.map((result) => result.matchIndex)).toEqual([0, 2]);
  });
});
