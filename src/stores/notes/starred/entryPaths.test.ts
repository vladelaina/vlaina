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
  vaultPath: string,
  relativePath: string,
): StarredEntry {
  return {
    id,
    kind,
    vaultPath,
    relativePath,
    addedAt: 1,
  };
}

describe('starred entry path helpers', () => {
  it('resolves entry absolute paths for normal and root vaults', () => {
    expect(getStarredEntryAbsolutePath(createEntry('a', 'note', '/vault', 'docs/alpha.md')))
      .toBe('/vault/docs/alpha.md');
    expect(getStarredEntryAbsolutePath(createEntry('b', 'note', '/', 'docs/alpha.md')))
      .toBe('/docs/alpha.md');
  });

  it('creates external note entries from absolute paths', () => {
    const entry = createStarredEntryFromAbsoluteNotePath('/other/docs/alpha.md');

    expect(entry).toMatchObject({
      kind: 'note',
      vaultPath: '/other/docs',
      relativePath: 'alpha.md',
    });
  });

  it('does not create external note entries from non-markdown paths', () => {
    expect(createStarredEntryFromAbsoluteNotePath('/other/docs/image.png')).toBeNull();
  });

  it('matches absolute paths against current-vault and external starred notes', () => {
    const entries = [
      createEntry('current', 'note', '/vault', 'docs/current.md'),
      createEntry('external', 'note', '/other/docs', 'alpha.md'),
    ];

    expect(findStarredEntryByPath(entries, 'note', '/vault/docs/current.md', '/vault')?.id)
      .toBe('current');
    expect(findStarredEntryByPath(entries, 'note', '/other/docs/alpha.md', '/vault')?.id)
      .toBe('external');
    expect(findStarredEntryByPath(entries, 'folder', '/other/docs/alpha.md', '/vault'))
      .toBeUndefined();
  });

  it('resolves note context from starred entries for breadcrumb navigation', () => {
    const entries = [
      createEntry('external', 'note', '/other/docs', 'alpha.md'),
      createEntry('folder', 'folder', '/other', 'docs'),
    ];

    expect(resolveStarredNoteContext('/other/docs/alpha.md', entries)).toEqual({
      vaultPath: '/other/docs',
      relativePath: 'alpha.md',
    });
    expect(resolveStarredNoteContext('/other/docs', entries)).toBeNull();
  });

  it('uses relative display paths for current-vault notes and absolute paths for external notes', () => {
    const entry = createEntry('external', 'note', '/other/docs', 'alpha.md');

    expect(getStarredNoteDisplayPath(entry, true)).toBe('alpha.md');
    expect(getStarredNoteDisplayPath(entry, false)).toBe('/other/docs/alpha.md');
    expect(getStarredNoteDisplayPath(createEntry('folder', 'folder', '/other', 'docs'), false))
      .toBeUndefined();
  });
});
