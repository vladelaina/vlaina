import { describe, expect, it } from 'vitest';
import type { FolderNode } from '@/stores/useNotesStore';
import {
  buildNotesSidebarTags,
  buildNotesSidebarTagScopeEntries,
  buildNotesSidebarTagsFromTagIndex,
  createNotesSidebarTagIndex,
  extractNotesSidebarTags,
  reconcileNotesSidebarTagIndex,
  reconcileNotesSidebarTagPathIndex,
} from './notesSidebarTags';

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
          id: 'note-beta',
          name: 'beta.md',
          path: 'projects/beta.md',
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

describe('notesSidebarTags', () => {
  it('extracts hash tags without treating markdown headings as tags', () => {
    expect(extractNotesSidebarTags([
      '# Heading',
      'Body #Project-A and #中文标签.',
      'Repeat #project-a',
      'not#inline',
      'https://example.test/page#anchor',
      'Color #fff #ffffff #123abc #12345678',
      'Inline `#code` should not count',
      '```',
      '#fenced',
      '```',
    ].join('\n'))).toEqual(['project-a', '中文标签']);
  });

  it('does not index tags from markdown metadata or hidden structural ranges', () => {
    expect(extractNotesSidebarTags([
      '---',
      'tags: #frontmatter',
      '---',
      '',
      'Body #visible.',
      'Link [label](https://example.test/#fragment).',
      'Nested [outer [inner]](assets/#nested-target.md).',
      'Autolink <https://example.test/#autolink>.',
      '<span data-tag="#attribute">visible text</span>',
      '<!-- #comment -->',
      'Inline ``#multi-code``.',
    ].join('\n'))).toEqual(['visible']);
  });

  it('builds tag counts by note rather than duplicate mentions in one note', () => {
    const entries = buildNotesSidebarTagScopeEntries({ rootFolder });
    const contents = new Map([
      ['projects/alpha.md', 'First #alpha #work #work'],
      ['projects/beta.md', 'Second #alpha'],
      ['note-zeta.md', 'No tags here'],
    ]);

    expect(buildNotesSidebarTags(entries, (path) => contents.get(path))).toEqual([
      {
        tag: 'alpha',
        count: 2,
        paths: [
          { path: 'projects/alpha.md', query: '#alpha', contentMatchOrdinal: 0 },
          { path: 'projects/beta.md', query: '#alpha', contentMatchOrdinal: 0 },
        ],
      },
      {
        tag: 'work',
        count: 1,
        paths: [
          { path: 'projects/alpha.md', query: '#work', contentMatchOrdinal: 0 },
        ],
      },
    ]);
  });

  it('keeps the editor find ordinal for the first valid tag in each note', () => {
    const entries = [{ path: 'projects/alpha.md' }];
    const contents = new Map([
      [
        'projects/alpha.md',
        [
          'Prefix #topic-extra should still be counted by plain editor find.',
          '`#topic` in inline code is not a sidebar tag but is searchable text.',
          'Real #topic target.',
          'Later #topic duplicate.',
        ].join('\n'),
      ],
    ]);

    expect(buildNotesSidebarTags(entries, (path) => contents.get(path))).toEqual([
      {
        tag: 'topic',
        count: 1,
        paths: [
          { path: 'projects/alpha.md', query: '#topic', contentMatchOrdinal: 2 },
        ],
      },
      {
        tag: 'topic-extra',
        count: 1,
        paths: [
          { path: 'projects/alpha.md', query: '#topic-extra', contentMatchOrdinal: 0 },
        ],
      },
    ]);
  });

  it('keeps current vault starred folders in scope without duplicating notes', () => {
    const entries = buildNotesSidebarTagScopeEntries({
      rootFolder,
      currentVaultPath: '/vault',
      starredEntries: [
        {
          id: 'star-folder',
          kind: 'folder',
          vaultPath: '/vault',
          relativePath: 'projects',
          addedAt: 1,
        },
        {
          id: 'star-external-folder',
          kind: 'folder',
          vaultPath: '/other',
          relativePath: 'external',
          addedAt: 2,
        },
      ],
    });

    expect(entries.map((entry) => entry.path)).toEqual([
      'note-zeta.md',
      'projects/alpha.md',
      'projects/beta.md',
    ]);
  });

  it('uses current vault starred notes as tag scope when no folder tree is loaded', () => {
    const entries = buildNotesSidebarTagScopeEntries({
      rootFolder: null,
      currentVaultPath: '/vault',
      starredEntries: [
        {
          id: 'star-note',
          kind: 'note',
          vaultPath: '/vault',
          relativePath: 'projects/alpha.md',
          addedAt: 1,
        },
        {
          id: 'star-traversal-note',
          kind: 'note',
          vaultPath: '/vault',
          relativePath: '../secret.md',
          addedAt: 4,
        },
        {
          id: 'star-folder',
          kind: 'folder',
          vaultPath: '/vault',
          relativePath: 'projects',
          addedAt: 2,
        },
        {
          id: 'star-external-note',
          kind: 'note',
          vaultPath: '/other',
          relativePath: 'external.md',
          addedAt: 3,
        },
      ],
    });

    expect(entries.map((entry) => entry.path)).toEqual(['projects/alpha.md']);
  });

  it('uses absolute starred note paths as tag scope when no current vault is selected', () => {
    const entries = buildNotesSidebarTagScopeEntries({
      rootFolder: null,
      currentVaultPath: '',
      starredEntries: [
        {
          id: 'star-note',
          kind: 'note',
          vaultPath: '/vault',
          relativePath: 'projects/alpha.md',
          addedAt: 1,
        },
        {
          id: 'star-traversal-note',
          kind: 'note',
          vaultPath: '/vault',
          relativePath: '../secret.md',
          addedAt: 4,
        },
        {
          id: 'star-other-note',
          kind: 'note',
          vaultPath: '/other',
          relativePath: 'external.md',
          addedAt: 2,
        },
        {
          id: 'star-folder',
          kind: 'folder',
          vaultPath: '/vault',
          relativePath: 'projects',
          addedAt: 3,
        },
      ],
    });

    expect(entries.map((entry) => entry.path)).toEqual([
      '/other/external.md',
      '/vault/projects/alpha.md',
    ]);
  });

  it('updates the tag path index incrementally by changed file content', () => {
    const index = new Map();
    const entries = [
      { path: 'projects/alpha.md' },
      { path: 'projects/beta.md' },
    ];
    const contents = new Map([
      ['projects/alpha.md', 'First #alpha'],
      ['projects/beta.md', 'Second #beta'],
    ]);

    reconcileNotesSidebarTagPathIndex(index, entries, (path) => contents.get(path));
    const firstAlphaIndexEntry = index.get('projects/alpha.md');
    const firstBetaIndexEntry = index.get('projects/beta.md');

    reconcileNotesSidebarTagPathIndex(index, entries, (path) => contents.get(path));
    expect(index.get('projects/alpha.md')).toBe(firstAlphaIndexEntry);
    expect(index.get('projects/beta.md')).toBe(firstBetaIndexEntry);

    contents.set('projects/alpha.md', 'First #alpha #work');
    reconcileNotesSidebarTagPathIndex(index, entries, (path) => contents.get(path));

    expect(index.get('projects/alpha.md')).not.toBe(firstAlphaIndexEntry);
    expect(index.get('projects/beta.md')).toBe(firstBetaIndexEntry);
    expect(Array.from(index.get('projects/alpha.md')?.tags.keys() ?? [])).toEqual(['alpha', 'work']);
  });

  it('prunes tag path index entries outside the active scope', () => {
    const index = new Map();
    const contents = new Map([
      ['projects/alpha.md', 'First #alpha'],
      ['projects/beta.md', 'Second #beta'],
    ]);

    reconcileNotesSidebarTagPathIndex(
      index,
      [{ path: 'projects/alpha.md' }, { path: 'projects/beta.md' }],
      (path) => contents.get(path),
    );
    reconcileNotesSidebarTagPathIndex(
      index,
      [{ path: 'projects/beta.md' }],
      (path) => contents.get(path),
    );

    expect(Array.from(index.keys())).toEqual(['projects/beta.md']);
  });

  it('maintains the aggregate tag index when one file changes', () => {
    const index = createNotesSidebarTagIndex();
    const entries = [
      { path: 'projects/alpha.md' },
      { path: 'projects/beta.md' },
    ];
    const contents = new Map([
      ['projects/alpha.md', 'First #alpha'],
      ['projects/beta.md', 'Second #alpha #beta'],
    ]);

    reconcileNotesSidebarTagIndex(index, entries, (path) => contents.get(path));
    expect(buildNotesSidebarTagsFromTagIndex(index)).toEqual([
      {
        tag: 'alpha',
        count: 2,
        paths: [
          { path: 'projects/alpha.md', query: '#alpha', contentMatchOrdinal: 0 },
          { path: 'projects/beta.md', query: '#alpha', contentMatchOrdinal: 0 },
        ],
      },
      {
        tag: 'beta',
        count: 1,
        paths: [
          { path: 'projects/beta.md', query: '#beta', contentMatchOrdinal: 0 },
        ],
      },
    ]);

    contents.set('projects/alpha.md', 'First #work');
    reconcileNotesSidebarTagIndex(index, entries, (path) => contents.get(path));

    expect(buildNotesSidebarTagsFromTagIndex(index)).toEqual([
      {
        tag: 'alpha',
        count: 1,
        paths: [
          { path: 'projects/beta.md', query: '#alpha', contentMatchOrdinal: 0 },
        ],
      },
      {
        tag: 'beta',
        count: 1,
        paths: [
          { path: 'projects/beta.md', query: '#beta', contentMatchOrdinal: 0 },
        ],
      },
      {
        tag: 'work',
        count: 1,
        paths: [
          { path: 'projects/alpha.md', query: '#work', contentMatchOrdinal: 0 },
        ],
      },
    ]);
  });
});
