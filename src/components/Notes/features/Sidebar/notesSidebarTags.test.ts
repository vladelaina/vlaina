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

  it('does not index tags from raw text HTML contents', () => {
    expect(extractNotesSidebarTags([
      '#visible',
      '<svg>#hidden-svg</svg>',
      '<math><mtext>#hidden-math</mtext></math>',
      '<noscript>#hidden-noscript</noscript>',
      '<plaintext>',
      '#hidden-plaintext',
      '#also-hidden',
    ].join('\n'))).toEqual(['visible']);
  });

  it('does not index tags from GFM HTML block contents', () => {
    expect(extractNotesSidebarTags([
      '<source srcset="images/a.webp 1x">',
      '#hidden-source',
      '',
      '#visible',
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

  it('skips escaped hash tags while preserving editor find ordinals', () => {
    const entries = [{ path: 'projects/alpha.md' }];
    const contents = new Map([
      [
        'projects/alpha.md',
        String.raw`Escaped \#topic is searchable text, but only real #topic is a sidebar tag.`,
      ],
    ]);

    expect(buildNotesSidebarTags(entries, (path) => contents.get(path))).toEqual([
      {
        tag: 'topic',
        count: 1,
        paths: [
          { path: 'projects/alpha.md', query: '#topic', contentMatchOrdinal: 1 },
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

  it('ignores non-Markdown file tree nodes when building tag scope', () => {
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
          name: 'note.markdown',
          path: 'note.markdown',
          isFolder: false,
        },
      ],
    };

    expect(buildNotesSidebarTagScopeEntries({ rootFolder: mixedRoot })).toEqual([
      { path: 'note.markdown' },
    ]);
  });

  it('ignores unsafe file tree paths when building tag scope', () => {
    const unsafeRoot: FolderNode = {
      id: 'root-unsafe',
      name: 'Notes',
      path: '',
      isFolder: true,
      expanded: true,
      children: [
        {
          id: 'traversal',
          name: 'secret.md',
          path: '../secret.md',
          isFolder: false,
        },
        {
          id: 'absolute',
          name: 'passwd.md',
          path: '/etc/passwd.md',
          isFolder: false,
        },
        {
          id: 'safe',
          name: 'safe.md',
          path: './docs//safe.md',
          isFolder: false,
        },
      ],
    };

    expect(buildNotesSidebarTagScopeEntries({ rootFolder: unsafeRoot })).toEqual([
      { path: 'docs/safe.md' },
    ]);
  });

  it('caps tag scope tree traversal when no markdown notes are found', () => {
    let lateChildrenAccessed = false;
    const lateFolder = {
      id: 'late',
      name: 'late',
      path: 'late',
      isFolder: true,
      expanded: true,
      get children() {
        lateChildrenAccessed = true;
        return [{
          id: 'late/alpha.md',
          name: 'alpha.md',
          path: 'late/alpha.md',
          isFolder: false as const,
        }];
      },
    };
    const largeRoot: FolderNode = {
      id: 'root-large',
      name: 'Notes',
      path: '',
      isFolder: true,
      expanded: true,
      children: [
        ...Array.from({ length: 20_000 }, (_value, index) => ({
          id: `empty-${index}`,
          name: `empty-${index}`,
          path: `empty-${index}`,
          isFolder: true as const,
          expanded: true,
          children: [],
        })),
        lateFolder,
      ],
    };

    expect(buildNotesSidebarTagScopeEntries({ rootFolder: largeRoot })).toEqual([]);
    expect(lateChildrenAccessed).toBe(false);
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
          id: 'star-internal-note',
          kind: 'note',
          vaultPath: '/vault',
          relativePath: '.git/config.md',
          addedAt: 6,
        },
        {
          id: 'star-dot-note',
          kind: 'note',
          vaultPath: '/vault',
          relativePath: '.notes/daily.md',
          addedAt: 7,
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
        {
          id: 'star-asset',
          kind: 'note',
          vaultPath: '/vault',
          relativePath: 'image.png',
          addedAt: 5,
        },
      ],
    });

    expect(entries.map((entry) => entry.path)).toEqual(['.notes/daily.md', 'projects/alpha.md']);
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

  it('stores a bounded content signature instead of duplicating full note content in the tag index', () => {
    const index = new Map();
    const largeContent = `${'body '.repeat(10_000)}#alpha`;

    reconcileNotesSidebarTagPathIndex(
      index,
      [{ path: 'projects/alpha.md' }],
      () => largeContent,
    );

    const entry = index.get('projects/alpha.md');
    expect(entry?.contentSignature.length).toBeLessThan(1024);
    expect(entry).not.toHaveProperty('content');
    expect(Array.from(entry?.tags.keys() ?? [])).toEqual(['alpha']);
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
