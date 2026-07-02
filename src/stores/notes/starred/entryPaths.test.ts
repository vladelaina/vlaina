import { describe, expect, it } from 'vitest';
import type { StarredEntry } from '../types';
import {
  createStarredEntryFromAbsoluteNotePath,
  findStarredEntryByPath,
  getStarredEntryAbsolutePath,
  getStarredNoteDisplayPath,
  resolveStarredNoteContext,
} from './entryPaths';

function createEntry(
  id: string,
  kind: StarredEntry['kind'],
  notesRootPath: string,
  relativePath: string,
): StarredEntry {
  return {
    id,
    kind,
    notesRootPath,
    relativePath,
    addedAt: 1,
  };
}

describe('starred entry path helpers', () => {
  it('resolves entry absolute paths for normal and root notes-roots', () => {
    expect(getStarredEntryAbsolutePath(createEntry('a', 'note', '/notesRoot', 'docs/alpha.md')))
      .toBe('/notesRoot/docs/alpha.md');
    expect(getStarredEntryAbsolutePath(createEntry('b', 'note', '/', 'docs/alpha.md')))
      .toBe('/docs/alpha.md');
    expect(getStarredEntryAbsolutePath(createEntry('c', 'note', 'C:/', 'docs/alpha.md')))
      .toBe('C:/docs/alpha.md');
  });

  it('preserves UNC roots when resolving entry absolute paths', () => {
    expect(getStarredEntryAbsolutePath(createEntry('unc', 'note', '//server/share', 'docs/alpha.md')))
      .toBe('//server/share/docs/alpha.md');
  });

  it('creates external note entries from absolute paths', () => {
    const entry = createStarredEntryFromAbsoluteNotePath('/other/docs/alpha.md');

    expect(entry).toMatchObject({
      kind: 'note',
      notesRootPath: '/other/docs',
      relativePath: 'alpha.md',
    });
  });

  it('does not create external note entries from non-markdown paths', () => {
    expect(createStarredEntryFromAbsoluteNotePath('/other/docs/image.png')).toBeNull();
  });

  it('does not create or resolve entries inside internal paths', () => {
    expect(createStarredEntryFromAbsoluteNotePath('/other/docs/.git/config.md')).toBeNull();
    expect(createStarredEntryFromAbsoluteNotePath('/other/.vlaina/workspace.md')).toBeNull();
    expect(createStarredEntryFromAbsoluteNotePath('/other/docs/.GIT/config.md')).toBeNull();
    expect(createStarredEntryFromAbsoluteNotePath('/other/.VLAINA/workspace.md')).toBeNull();
    expect(getStarredEntryAbsolutePath(createEntry('git', 'note', '/notesRoot/.git', 'config.md')))
      .toBeNull();
    expect(getStarredEntryAbsolutePath(createEntry('git-uppercase', 'note', '/notesRoot/.GIT', 'config.md')))
      .toBeNull();
    expect(getStarredEntryAbsolutePath(createEntry('app', 'note', '/notesRoot', '.vlaina/workspace.md')))
      .toBeNull();
    expect(getStarredEntryAbsolutePath(createEntry('app-uppercase', 'note', '/notesRoot', '.VLAINA/workspace.md')))
      .toBeNull();
  });

  it('matches absolute paths against current-notesRoot and external starred notes', () => {
    const entries = [
      createEntry('current', 'note', '/notesRoot', 'docs/current.md'),
      createEntry('external', 'note', '/other/docs', 'alpha.md'),
    ];

    expect(findStarredEntryByPath(entries, 'note', '/notesRoot/docs/current.md', '/notesRoot')?.id)
      .toBe('current');
    expect(findStarredEntryByPath(entries, 'note', '/other/docs/alpha.md', '/notesRoot')?.id)
      .toBe('external');
    expect(findStarredEntryByPath(entries, 'folder', '/other/docs/alpha.md', '/notesRoot'))
      .toBeUndefined();
  });

  it('resolves note context from starred entries for breadcrumb navigation', () => {
    const entries = [
      createEntry('external', 'note', '/other/docs', 'alpha.md'),
      createEntry('folder', 'folder', '/other', 'docs'),
    ];

    expect(resolveStarredNoteContext('/other/docs/alpha.md', entries)).toEqual({
      notesRootPath: '/other/docs',
      relativePath: 'alpha.md',
    });
    expect(resolveStarredNoteContext('/other/docs', entries)).toBeNull();
  });

  it('uses relative display paths for current-notesRoot notes and absolute paths for external notes', () => {
    const entry = createEntry('external', 'note', '/other/docs', 'alpha.md');

    expect(getStarredNoteDisplayPath(entry, true)).toBe('alpha.md');
    expect(getStarredNoteDisplayPath(entry, false)).toBe('/other/docs/alpha.md');
    expect(getStarredNoteDisplayPath(createEntry('folder', 'folder', '/other', 'docs'), false))
      .toBeUndefined();
  });
});
