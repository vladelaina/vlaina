import { describe, expect, it } from 'vitest';
import type { FolderNode } from '@/stores/useNotesStore';
import { buildNotesSidebarSearchIndex } from './notesSidebarSearchResults';
import { buildNotesSidebarTagScopeEntries } from './notesSidebarTags';

const dirtyRootFolder: FolderNode = {
  id: 'root',
  name: 'Notes',
  path: '',
  isFolder: true,
  expanded: true,
  children: [
    {
      id: 'dot-note',
      name: '.journal.md',
      path: '.journal.md',
      isFolder: false,
    },
    {
      id: 'dot-folder',
      name: '.notes',
      path: '.notes',
      isFolder: true,
      expanded: true,
      children: [
        {
          id: 'dot-folder-note',
          name: 'alpha.md',
          path: '.notes/alpha.md',
          isFolder: false,
        },
      ],
    },
    {
      id: 'app-folder',
      name: '.vlaina',
      path: '.vlaina',
      isFolder: true,
      expanded: true,
      children: [
        {
          id: 'app-note',
          name: 'workspace.md',
          path: '.vlaina/workspace.md',
          isFolder: false,
        },
      ],
    },
    {
      id: 'git-note',
      name: 'config.md',
      path: 'docs/.git/config.md',
      isFolder: false,
    },
    {
      id: 'app-folder-uppercase',
      name: '.VLAINA',
      path: '.VLAINA',
      isFolder: true,
      expanded: true,
      children: [
        {
          id: 'app-note-uppercase',
          name: 'workspace.md',
          path: '.VLAINA/workspace.md',
          isFolder: false,
        },
      ],
    },
    {
      id: 'git-note-uppercase',
      name: 'config.md',
      path: 'docs/.GIT/config.md',
      isFolder: false,
    },
  ],
};

describe('notes sidebar path security', () => {
  it('keeps user dot Markdown while excluding internal paths from tag scope', () => {
    expect(buildNotesSidebarTagScopeEntries({ rootFolder: dirtyRootFolder })).toEqual([
      { path: '.journal.md' },
      { path: '.notes/alpha.md' },
    ]);
  });

  it('keeps user dot Markdown while excluding internal paths from search index', () => {
    expect(buildNotesSidebarSearchIndex(dirtyRootFolder, () => '')).toEqual([
      {
        path: '.journal.md',
        name: '.journal.md',
        preview: '',
      },
      {
        path: '.notes/alpha.md',
        name: 'alpha.md',
        preview: '.notes/',
      },
    ]);
  });

  it('does not expose internal paths from stale starred search entries', () => {
    expect(buildNotesSidebarSearchIndex(null, () => '', {
      currentVaultPath: '/vault',
      starredEntries: [
        {
          id: 'dot-note',
          kind: 'note',
          vaultPath: '/vault',
          relativePath: '.notes/alpha.md',
          addedAt: 1,
        },
        {
          id: 'internal-current-note',
          kind: 'note',
          vaultPath: '/vault',
          relativePath: 'docs/.git/config.md',
          addedAt: 2,
        },
        {
          id: 'internal-external-vault',
          kind: 'note',
          vaultPath: '/external/.vlaina',
          relativePath: 'workspace.md',
          addedAt: 3,
        },
        {
          id: 'internal-current-note-uppercase',
          kind: 'note',
          vaultPath: '/vault',
          relativePath: 'docs/.GIT/config.md',
          addedAt: 4,
        },
        {
          id: 'internal-external-vault-uppercase',
          kind: 'note',
          vaultPath: '/external/.VLAINA',
          relativePath: 'workspace.md',
          addedAt: 5,
        },
      ],
    })).toEqual([
      {
        path: '.notes/alpha.md',
        openPath: '.notes/alpha.md',
        name: 'alpha',
        preview: '.notes/',
        isExternal: false,
        contentSearchable: false,
      },
    ]);
  });
});
