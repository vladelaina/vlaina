import { describe, expect, it } from 'vitest';
import {
  getAbsoluteRenameWatchPaths,
  getRelevantRelativeWatchPaths,
  getRelativeRenameWatchPaths,
  isInsideNotesRoot,
  isCreateWatchEvent,
  isIgnoredWatchPath,
  isMarkdownPath,
  isRemoveWatchEvent,
  normalizeFsPath,
  toNotesRootRelativePath,
} from './notesExternalSyncUtils';

describe('notesExternalSyncUtils', () => {
  it('parses absolute rename paths from a paired rename event', () => {
    const renamePaths = getAbsoluteRenameWatchPaths({
      type: { modify: { kind: 'rename', mode: 'both' } },
      paths: ['C:\\notesRoot\\docs', 'C:\\notesRoot\\archive'],
    });

    expect(renamePaths).toEqual({
      oldPath: 'C:/notesRoot/docs',
      newPath: 'C:/notesRoot/archive',
    });
  });

  it('normalizes dot segments in absolute rename paths', () => {
    expect(normalizeFsPath('/notesRoot/docs/../alpha.md')).toBe('/notesRoot/alpha.md');
    expect(normalizeFsPath('docs/../alpha.md')).toBe('docs/../alpha.md');

    const renamePaths = getAbsoluteRenameWatchPaths({
      type: { modify: { kind: 'rename', mode: 'both' } },
      paths: ['/notesRoot/docs/../alpha.md', '/notesRoot/archive/./alpha.md'],
    });

    expect(renamePaths).toEqual({
      oldPath: '/notesRoot/alpha.md',
      newPath: '/notesRoot/archive/alpha.md',
    });
  });

  it('converts rename paths to notes-root-relative paths', () => {
    const renamePaths = getRelativeRenameWatchPaths('C:\\notesRoot', {
      type: { modify: { kind: 'rename', mode: 'both' } },
      paths: ['C:\\notesRoot\\docs', 'C:\\notesRoot\\archive'],
    });

    expect(renamePaths).toEqual({
      oldPath: 'docs',
      newPath: 'archive',
    });
  });

  it('converts root-notesRoot absolute paths to relative paths', () => {
    expect(isInsideNotesRoot('/', '/docs/alpha.md')).toBe(true);
    expect(toNotesRootRelativePath('/', '/docs/alpha.md')).toBe('docs/alpha.md');
    expect(toNotesRootRelativePath('/', '/')).toBe('');
  });

  it('rejects dot-segment absolute paths that normalize outside the notesRoot', () => {
    expect(isInsideNotesRoot('/notesRoot', '/notesRoot/docs/../alpha.md')).toBe(true);
    expect(toNotesRootRelativePath('/notesRoot', '/notesRoot/docs/../alpha.md')).toBe('alpha.md');
    expect(isInsideNotesRoot('/notesRoot', '/notesRoot/../secret.md')).toBe(false);
    expect(toNotesRootRelativePath('/notesRoot', '/notesRoot/../secret.md')).toBeNull();
  });

  it('matches Windows notesRoot watch paths case-insensitively', () => {
    expect(isInsideNotesRoot('C:\\Users\\Me\\NotesRoot', 'c:\\users\\me\\notesRoot\\Docs\\Alpha.md')).toBe(true);
    expect(toNotesRootRelativePath('C:\\Users\\Me\\NotesRoot', 'c:\\users\\me\\notesRoot\\Docs\\Alpha.md')).toBe('Docs/Alpha.md');
    expect(isInsideNotesRoot('C:\\Users\\Me\\NotesRoot', 'c:\\users\\me\\notesRoot\\..\\secret.md')).toBe(false);
    expect(toNotesRootRelativePath('C:\\Users\\Me\\NotesRoot', 'c:\\users\\me\\notesRoot\\..\\secret.md')).toBeNull();
    expect(toNotesRootRelativePath('C:\\Users\\Me\\NotesRoot', 'c:\\users\\me\\notesRooted\\Alpha.md')).toBeNull();
  });

  it('preserves UNC roots while matching notesRoot watch paths', () => {
    expect(isInsideNotesRoot('\\\\SERVER\\Share', '\\\\server\\share\\Docs\\Alpha.md')).toBe(true);
    expect(toNotesRootRelativePath('\\\\SERVER\\Share', '\\\\server\\share\\Docs\\Alpha.md')).toBe('Docs/Alpha.md');
    expect(isInsideNotesRoot('\\\\server\\share', '/server/share/Docs/Alpha.md')).toBe(false);
    expect(toNotesRootRelativePath('\\\\server\\share', '/server/share/Docs/Alpha.md')).toBeNull();
  });

  it('detects create and remove watch events', () => {
    expect(isCreateWatchEvent({ type: { create: { kind: 'folder' } } })).toBe(true);
    expect(isRemoveWatchEvent({ type: { remove: { kind: 'folder' } } })).toBe(true);
    expect(isCreateWatchEvent({ type: { remove: { kind: 'folder' } } })).toBe(false);
    expect(isRemoveWatchEvent({ type: { create: { kind: 'folder' } } })).toBe(false);
  });

  it('recognizes every supported markdown extension', () => {
    expect(isMarkdownPath('alpha.md')).toBe(true);
    expect(isMarkdownPath('beta.markdown')).toBe(true);
    expect(isMarkdownPath('gamma.mdown')).toBe(true);
    expect(isMarkdownPath('delta.mkd')).toBe(true);
    expect(isMarkdownPath('image.png')).toBe(false);
  });

  it('ignores hidden app, git, and temporary watch paths', () => {
    expect(isIgnoredWatchPath('.vlaina/internal.json')).toBe(true);
    expect(isIgnoredWatchPath('docs/.git/config')).toBe(true);
    expect(isIgnoredWatchPath('.VLAINA/workspace.json')).toBe(true);
    expect(isIgnoredWatchPath('docs/.GIT/config')).toBe(true);
    expect(isIgnoredWatchPath('docs/cache.tmp')).toBe(true);
    expect(isIgnoredWatchPath('.notes/alpha.md')).toBe(false);
    expect(getRelevantRelativeWatchPaths('/notesRoot', [
      '/notesRoot/.vlaina/internal.json',
      '/notesRoot/docs/.git/config',
      '/notesRoot/.VLAINA/workspace.json',
      '/notesRoot/docs/.GIT/config',
      '/notesRoot/.notes/alpha.md',
    ])).toEqual(['.notes/alpha.md']);
  });

  it('rejects unsafe characters when converting watch paths', () => {
    expect(toNotesRootRelativePath('/notesRoot', '/notesRoot/docs/secret\0.md')).toBeNull();
    expect(toNotesRootRelativePath('/notesRoot', '/notesRoot/docs/secret\u202Egnp.md')).toBeNull();
    expect(toNotesRootRelativePath('/notesRoot', '/notesRoot/docs/secret\uFFFD.md')).toBeNull();
    expect(toNotesRootRelativePath('/notesRoot', '/notesRoot/.notes/alpha.md')).toBe('.notes/alpha.md');

    expect(getRelevantRelativeWatchPaths('/notesRoot', [
      '/notesRoot/.notes/alpha.md',
      '/notesRoot/docs/secret\0.md',
      '/notesRoot/docs/secret\u202Egnp.md',
      '/notesRoot/docs/secret\uFFFD.md',
    ])).toEqual(['.notes/alpha.md']);
  });

  it('drops unsafe rename watch endpoints', () => {
    expect(getRelativeRenameWatchPaths('/notesRoot', {
      type: { modify: { kind: 'rename', mode: 'both' } },
      paths: ['/notesRoot/docs/secret\u202Egnp.md', '/notesRoot/docs/alpha.md'],
    })).toEqual({
      oldPath: null,
      newPath: 'docs/alpha.md',
    });

    expect(getRelativeRenameWatchPaths('/notesRoot', {
      type: { modify: { kind: 'rename', mode: 'both' } },
      paths: ['/notesRoot/docs/secret\u202Egnp.md', '/notesRoot/docs/secret\uFFFD.md'],
    })).toBeNull();
  });
});
