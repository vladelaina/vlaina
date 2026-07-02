import { describe, expect, it } from 'vitest';
import {
  createStarredEntry,
  createStarredEntryIfValid,
  dedupeStarredEntries,
  normalizeStarredEntry,
  remapStarredEntriesForNotesRoot,
} from './registry';

describe('starred registry helpers', () => {
  it('keeps only supported markdown files for note entries', () => {
    expect(normalizeStarredEntry({
      id: 'note',
      kind: 'note',
      notesRootPath: '/notesRoot',
      relativePath: 'docs/alpha.markdown',
      addedAt: 1,
    })).toMatchObject({
      kind: 'note',
      relativePath: 'docs/alpha.markdown',
    });

    expect(normalizeStarredEntry({
      id: 'image',
      kind: 'note',
      notesRootPath: '/notesRoot',
      relativePath: 'docs/image.png',
      addedAt: 1,
    })).toBeNull();
  });

  it('does not apply markdown extension filtering to folder entries', () => {
    expect(normalizeStarredEntry({
      id: 'folder',
      kind: 'folder',
      notesRootPath: '/notesRoot',
      relativePath: 'assets.png',
      addedAt: 1,
    })).toMatchObject({
      kind: 'folder',
      relativePath: 'assets.png',
    });
  });

  it('normalizes starred opened folder paths before matching and deduping entries', () => {
    expect(normalizeStarredEntry({
      id: 'note',
      kind: 'note',
      notesRootPath: '/notesRoot/docs/..',
      relativePath: './docs/alpha.md',
      addedAt: 1,
    })).toMatchObject({
      kind: 'note',
      notesRootPath: '/notesRoot',
      relativePath: 'docs/alpha.md',
    });

    const result = remapStarredEntriesForNotesRoot([
      {
        id: 'normalized',
        kind: 'note',
        notesRootPath: '/notesRoot/docs/..',
        relativePath: 'docs/alpha.md',
        addedAt: 1,
      },
    ], '/notesRoot', (relativePath) => relativePath.replace('alpha.md', 'beta.md'));

    expect(result).toEqual({
      changed: true,
      entries: [{
        id: 'normalized',
        kind: 'note',
        notesRootPath: '/notesRoot/docs/..',
        relativePath: 'docs/beta.md',
        addedAt: 1,
      }],
    });
  });

  it('deduplicates Windows opened folder paths case-insensitively', () => {
    expect(dedupeStarredEntries([
      {
        id: 'upper',
        kind: 'note',
        notesRootPath: 'C:/Users/Me/NotesRoot',
        relativePath: 'docs/alpha.md',
        addedAt: 1,
      },
      {
        id: 'lower',
        kind: 'note',
        notesRootPath: 'c:/users/me/notesRoot',
        relativePath: 'docs/alpha.md',
        addedAt: 2,
      },
    ])).toEqual([
      {
        id: 'upper',
        kind: 'note',
        notesRootPath: 'C:/Users/Me/NotesRoot',
        relativePath: 'docs/alpha.md',
        addedAt: 1,
      },
    ]);
  });

  it('rejects starred entries inside hidden app and git directories', () => {
    expect(normalizeStarredEntry({
      id: 'app-note',
      kind: 'note',
      notesRootPath: '/notesRoot',
      relativePath: '.vlaina/workspace.md',
      addedAt: 1,
    })).toBeNull();
    expect(normalizeStarredEntry({
      id: 'git-folder',
      kind: 'folder',
      notesRootPath: '/notesRoot',
      relativePath: 'docs/.git',
      addedAt: 1,
    })).toBeNull();
    expect(createStarredEntryIfValid('note', '/notesRoot', '.git/config.md')).toBeNull();
    expect(createStarredEntryIfValid('folder', '/notesRoot', '.vlaina')).toBeNull();
    expect(normalizeStarredEntry({
      id: 'app-note-uppercase',
      kind: 'note',
      notesRootPath: '/notesRoot',
      relativePath: '.VLAINA/workspace.md',
      addedAt: 1,
    })).toBeNull();
    expect(normalizeStarredEntry({
      id: 'git-folder-uppercase',
      kind: 'folder',
      notesRootPath: '/notesRoot',
      relativePath: 'docs/.GIT',
      addedAt: 1,
    })).toBeNull();
    expect(createStarredEntryIfValid('note', '/notesRoot', '.GIT/config.md')).toBeNull();
    expect(createStarredEntryIfValid('folder', '/notesRoot', '.VLAINA')).toBeNull();
  });

  it('refuses to create non-markdown note entries', () => {
    expect(() => createStarredEntry('note', '/notesRoot', 'image.png')).toThrow(
      'Starred note path must be a supported Markdown file',
    );

    expect(createStarredEntry('folder', '/notesRoot', 'assets.png')).toMatchObject({
      kind: 'folder',
      relativePath: 'assets.png',
    });
  });

  it('returns null instead of throwing when safely creating invalid note entries', () => {
    expect(createStarredEntryIfValid('note', '/notesRoot', 'image.png')).toBeNull();
    expect(createStarredEntryIfValid('note', 'relative-notesRoot', 'docs/alpha.md')).toBeNull();
    expect(createStarredEntryIfValid('folder', '/notesRoot', 'assets.png')).toMatchObject({
      kind: 'folder',
      relativePath: 'assets.png',
    });
  });

  it('rejects starred opened folder paths with unsafe control or bidi characters', () => {
    for (const notesRootPath of [
      '/notesRoot\0hidden',
      '/notesRoot\u001Fhidden',
      '/notesRoot\u202Ecod.exe',
      '/notesRoot\u2066hidden',
      '/notesRoot\uFFFDhidden',
    ]) {
      expect(normalizeStarredEntry({
        id: `entry-${notesRootPath.length}`,
        kind: 'note',
        notesRootPath,
        relativePath: 'docs/alpha.md',
        addedAt: 1,
      })).toBeNull();
      expect(createStarredEntryIfValid('note', notesRootPath, 'docs/alpha.md')).toBeNull();
      expect(() => createStarredEntry('note', notesRootPath, 'docs/alpha.md')).toThrow(
        'Starred entry opened folder path must be an absolute path',
      );
    }
  });

  it('drops remapped note entries that stop being markdown files', () => {
    const result = remapStarredEntriesForNotesRoot([
      {
        id: 'note',
        kind: 'note',
        notesRootPath: '/notesRoot',
        relativePath: 'docs/alpha.md',
        addedAt: 1,
      },
      {
        id: 'folder',
        kind: 'folder',
        notesRootPath: '/notesRoot',
        relativePath: 'docs',
        addedAt: 1,
      },
    ], '/notesRoot', (relativePath, kind) => (
      kind === 'note' ? relativePath.replace(/\.md$/i, '.png') : relativePath
    ));

    expect(result.changed).toBe(true);
    expect(result.entries).toEqual([{
      id: 'folder',
      kind: 'folder',
      notesRootPath: '/notesRoot',
      relativePath: 'docs',
      addedAt: 1,
    }]);
  });
});
