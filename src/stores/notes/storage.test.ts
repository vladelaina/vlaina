import { describe, expect, it } from 'vitest';
import {
  createStarredEntry,
  getNotesRootStarredPaths,
  remapStarredEntriesForNotesRoot,
  resolveStarredRelativePathForNotesRoot,
  type StarredEntry,
} from './starred';

function createEntry(
  id: string,
  kind: 'note' | 'folder',
  notesRootPath: string,
  relativePath: string
): StarredEntry {
  return {
    id,
    kind,
    notesRootPath,
    relativePath,
    addedAt: 1,
  };
}

describe('notes starred storage helpers', () => {
  it('filters opened folder starred paths', () => {
    const entries: StarredEntry[] = [
      createEntry('1', 'note', 'C:/notes-root-a', 'alpha.md'),
      createEntry('2', 'folder', 'C:/notes-root-a', 'docs'),
      createEntry('3', 'note', 'C:/notes-root-b', 'beta.md'),
    ];

    expect(getNotesRootStarredPaths(entries, 'C:\\notes-root-a')).toEqual({
      notes: ['alpha.md'],
      folders: ['docs'],
    });
  });

  it('matches Windows opened folder starred paths case-insensitively', () => {
    const entries: StarredEntry[] = [
      createEntry('1', 'note', 'C:/Users/Me/NotesRoot', 'alpha.md'),
      createEntry('2', 'folder', 'C:/Users/Me/NotesRoot', 'docs'),
    ];

    expect(getNotesRootStarredPaths(entries, 'c:\\users\\me\\notesRoot')).toEqual({
      notes: ['alpha.md'],
      folders: ['docs'],
    });

    const result = remapStarredEntriesForNotesRoot(entries, 'c:\\users\\me\\notesRoot', (relativePath) =>
      relativePath === 'alpha.md' ? 'beta.md' : relativePath
    );

    expect(result.changed).toBe(true);
    expect(result.entries[0]?.relativePath).toBe('beta.md');
  });

  it('remaps and deduplicates starred entries for one notesRoot only', () => {
    const entries: StarredEntry[] = [
      createEntry('1', 'note', 'C:/notes-root-a', 'docs/alpha.md'),
      createEntry('2', 'folder', 'C:/notes-root-a', 'docs'),
      createEntry('3', 'note', 'C:/notes-root-a', 'archive/alpha.md'),
      createEntry('4', 'note', 'C:/notes-root-b', 'docs/alpha.md'),
    ];

    const result = remapStarredEntriesForNotesRoot(entries, 'C:/notes-root-a', (relativePath, kind) => {
      if (kind === 'folder' && relativePath === 'docs') return 'archive';
      if (relativePath.startsWith('docs/')) return relativePath.replace('docs/', 'archive/');
      return relativePath;
    });

    expect(result.changed).toBe(true);
    expect(result.entries).toEqual([
      createEntry('1', 'note', 'C:/notes-root-a', 'archive/alpha.md'),
      createEntry('2', 'folder', 'C:/notes-root-a', 'archive'),
      createEntry('4', 'note', 'C:/notes-root-b', 'docs/alpha.md'),
    ]);
  });

  it('creates normalized starred entries', () => {
    const entry = createStarredEntry('note', 'C:\\notes-root-a\\', 'docs\\alpha.md');

    expect(entry.kind).toBe('note');
    expect(entry.notesRootPath).toBe('C:/notes-root-a');
    expect(entry.relativePath).toBe('docs/alpha.md');
    expect(entry.id.startsWith('starred-')).toBe(true);
  });

  it('keeps Windows drive roots valid for starred entries', () => {
    const entry = createStarredEntry('note', 'C:\\', 'docs\\alpha.md');

    expect(entry.notesRootPath).toBe('C:/');
    expect(entry.relativePath).toBe('docs/alpha.md');
    expect(resolveStarredRelativePathForNotesRoot('C:\\docs\\alpha.md', 'C:\\')).toBe('docs/alpha.md');
  });

  it('resolves only current-notesRoot absolute starred paths to relative paths', () => {
    expect(resolveStarredRelativePathForNotesRoot('/notesRoot/docs/alpha.md', '/notesRoot')).toBe('docs/alpha.md');
    expect(resolveStarredRelativePathForNotesRoot('docs/alpha.md', '/notesRoot')).toBe('docs/alpha.md');
    expect(resolveStarredRelativePathForNotesRoot('/other/docs/alpha.md', '/notesRoot')).toBeNull();
    expect(resolveStarredRelativePathForNotesRoot('C:\\notesRoot\\docs\\alpha.md', 'C:/notesRoot')).toBe('docs/alpha.md');
    expect(resolveStarredRelativePathForNotesRoot('/docs/alpha.md', '/')).toBe('docs/alpha.md');
  });

  it('normalizes current-notesRoot absolute starred paths before containment checks', () => {
    expect(resolveStarredRelativePathForNotesRoot('/notesRoot/docs/../alpha.md', '/notesRoot')).toBe('alpha.md');
    expect(resolveStarredRelativePathForNotesRoot('/notesRoot/../secret.md', '/notesRoot')).toBeNull();
    expect(resolveStarredRelativePathForNotesRoot('/notesRooted/alpha.md', '/notesRoot')).toBeNull();
    expect(resolveStarredRelativePathForNotesRoot('c:\\users\\me\\notesRoot\\Docs\\Alpha.md', 'C:\\Users\\Me\\NotesRoot')).toBe('Docs/Alpha.md');
    expect(resolveStarredRelativePathForNotesRoot('c:\\users\\me\\notesRoot\\..\\secret.md', 'C:\\Users\\Me\\NotesRoot')).toBeNull();
  });

  it('does not resolve hidden app or git paths for current-notesRoot starred entries', () => {
    expect(resolveStarredRelativePathForNotesRoot('/notesRoot/.vlaina/workspace.md', '/notesRoot')).toBeNull();
    expect(resolveStarredRelativePathForNotesRoot('/notesRoot/docs/.git/config.md', '/notesRoot')).toBeNull();
    expect(resolveStarredRelativePathForNotesRoot('.vlaina/workspace.md', '/notesRoot')).toBeNull();
    expect(resolveStarredRelativePathForNotesRoot('docs/.git/config.md', '/notesRoot')).toBeNull();
    expect(resolveStarredRelativePathForNotesRoot('/notesRoot/.VLAINA/workspace.md', '/notesRoot')).toBeNull();
    expect(resolveStarredRelativePathForNotesRoot('/notesRoot/docs/.GIT/config.md', '/notesRoot')).toBeNull();
    expect(resolveStarredRelativePathForNotesRoot('.VLAINA/workspace.md', '/notesRoot')).toBeNull();
    expect(resolveStarredRelativePathForNotesRoot('docs/.GIT/config.md', '/notesRoot')).toBeNull();
  });
});
