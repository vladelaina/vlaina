import { describe, expect, it } from 'vitest';
import {
  pruneDisplayNamesForExternalDeletion,
  pruneOpenTabsForExternalDeletion,
  pruneRecentNotesForExternalDeletion,
  remapCurrentNoteForExternalRename,
  remapDisplayNamesForExternalRename,
  remapOpenTabsForExternalRename,
  remapPathForExternalRename,
  remapRecentNotesForExternalRename,
  shouldPreserveDeletedCurrentNote,
  shouldRemoveForExternalDeletion,
} from './externalPathSync';

describe('externalPathSync', () => {
  it('remaps direct and nested paths on rename', () => {
    expect(remapPathForExternalRename('docs/alpha.md', 'docs/alpha.md', 'archive/alpha.md')).toBe('archive/alpha.md');
    expect(remapPathForExternalRename('docs/child/alpha.md', 'docs', 'archive')).toBe('archive/child/alpha.md');
  });

  it('updates tab paths and only refreshes exact renamed file titles', () => {
    const tabs = [
      { path: 'docs/alpha.md', name: 'alpha', isDirty: false },
      { path: 'docs/guide.md', name: 'Guide', isDirty: false },
    ];

    expect(remapOpenTabsForExternalRename(tabs, 'docs/alpha.md', 'docs/beta.md')).toEqual([
      { path: 'docs/beta.md', name: 'beta', isDirty: false },
      { path: 'docs/guide.md', name: 'Guide', isDirty: false },
    ]);
  });

  it('remaps display names and preserves custom titles', () => {
    const displayNames = new Map([
      ['docs/alpha.md', 'alpha'],
      ['docs/guide.md', 'Custom Guide'],
    ]);

    const nextDisplayNames = remapDisplayNamesForExternalRename(displayNames, 'docs/alpha.md', 'docs/beta.md');

    expect(nextDisplayNames.get('docs/beta.md')).toBe('beta');
    expect(nextDisplayNames.get('docs/guide.md')).toBe('Custom Guide');
  });

  it('prunes deleted tabs and display names while preserving the current dirty note', () => {
    const tabs = [
      { path: 'docs/alpha.md', name: 'alpha', isDirty: true },
      { path: 'docs/beta.md', name: 'beta', isDirty: false },
    ];
    const displayNames = new Map([
      ['docs/alpha.md', 'alpha'],
      ['docs/beta.md', 'beta'],
    ]);

    expect(pruneOpenTabsForExternalDeletion(tabs, 'docs', 'docs/alpha.md')).toEqual([
      { path: 'docs/alpha.md', name: 'alpha', isDirty: true },
    ]);
    expect(pruneDisplayNamesForExternalDeletion(displayNames, 'docs', 'docs/alpha.md')).toEqual(
      new Map([['docs/alpha.md', 'alpha']])
    );
  });

  it('detects deletions for nested paths and preserves dirty current note conflicts', () => {
    expect(shouldRemoveForExternalDeletion('docs/child/alpha.md', 'docs')).toBe(true);
    expect(
      shouldPreserveDeletedCurrentNote({ path: 'docs/alpha.md', content: '# Alpha' }, true, 'docs/alpha.md')
    ).toBe(true);
  });

  it('remaps current note path on external rename', () => {
    expect(
      remapCurrentNoteForExternalRename(
        { path: 'docs/alpha.md', content: '# Alpha' },
        'docs',
        'archive'
      )
    ).toEqual({ path: 'archive/alpha.md', content: '# Alpha' });
  });

  it('remaps and deduplicates recent notes on rename', () => {
    expect(
      remapRecentNotesForExternalRename(
        ['docs/alpha.md', 'archive/alpha.md', 'docs/beta.md'],
        'docs/alpha.md',
        'archive/alpha.md'
      )
    ).toEqual(['archive/alpha.md', 'docs/beta.md']);
  });

  it('prunes deleted recent notes while preserving a dirty current note path', () => {
    expect(
      pruneRecentNotesForExternalDeletion(
        ['docs/alpha.md', 'docs/beta.md', 'inbox/gamma.md'],
        'docs',
        'docs/alpha.md'
      )
    ).toEqual(['docs/alpha.md', 'inbox/gamma.md']);
  });
});
