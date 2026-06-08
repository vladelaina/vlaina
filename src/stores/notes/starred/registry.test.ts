import { describe, expect, it } from 'vitest';
import {
  createStarredEntry,
  createStarredEntryIfValid,
  normalizeStarredEntry,
  remapStarredEntriesForVault,
} from './registry';

describe('starred registry helpers', () => {
  it('keeps only supported markdown files for note entries', () => {
    expect(normalizeStarredEntry({
      id: 'note',
      kind: 'note',
      vaultPath: '/vault',
      relativePath: 'docs/alpha.markdown',
      addedAt: 1,
    })).toMatchObject({
      kind: 'note',
      relativePath: 'docs/alpha.markdown',
    });

    expect(normalizeStarredEntry({
      id: 'image',
      kind: 'note',
      vaultPath: '/vault',
      relativePath: 'docs/image.png',
      addedAt: 1,
    })).toBeNull();
  });

  it('does not apply markdown extension filtering to folder entries', () => {
    expect(normalizeStarredEntry({
      id: 'folder',
      kind: 'folder',
      vaultPath: '/vault',
      relativePath: 'assets.png',
      addedAt: 1,
    })).toMatchObject({
      kind: 'folder',
      relativePath: 'assets.png',
    });
  });

  it('rejects starred entries inside hidden app and git directories', () => {
    expect(normalizeStarredEntry({
      id: 'app-note',
      kind: 'note',
      vaultPath: '/vault',
      relativePath: '.vlaina/workspace.md',
      addedAt: 1,
    })).toBeNull();
    expect(normalizeStarredEntry({
      id: 'git-folder',
      kind: 'folder',
      vaultPath: '/vault',
      relativePath: 'docs/.git',
      addedAt: 1,
    })).toBeNull();
    expect(createStarredEntryIfValid('note', '/vault', '.git/config.md')).toBeNull();
    expect(createStarredEntryIfValid('folder', '/vault', '.vlaina')).toBeNull();
  });

  it('refuses to create non-markdown note entries', () => {
    expect(() => createStarredEntry('note', '/vault', 'image.png')).toThrow(
      'Starred note path must be a supported Markdown file',
    );

    expect(createStarredEntry('folder', '/vault', 'assets.png')).toMatchObject({
      kind: 'folder',
      relativePath: 'assets.png',
    });
  });

  it('returns null instead of throwing when safely creating invalid note entries', () => {
    expect(createStarredEntryIfValid('note', '/vault', 'image.png')).toBeNull();
    expect(createStarredEntryIfValid('note', 'relative-vault', 'docs/alpha.md')).toBeNull();
    expect(createStarredEntryIfValid('folder', '/vault', 'assets.png')).toMatchObject({
      kind: 'folder',
      relativePath: 'assets.png',
    });
  });

  it('drops remapped note entries that stop being markdown files', () => {
    const result = remapStarredEntriesForVault([
      {
        id: 'note',
        kind: 'note',
        vaultPath: '/vault',
        relativePath: 'docs/alpha.md',
        addedAt: 1,
      },
      {
        id: 'folder',
        kind: 'folder',
        vaultPath: '/vault',
        relativePath: 'docs',
        addedAt: 1,
      },
    ], '/vault', (relativePath, kind) => (
      kind === 'note' ? relativePath.replace(/\.md$/i, '.png') : relativePath
    ));

    expect(result.changed).toBe(true);
    expect(result.entries).toEqual([{
      id: 'folder',
      kind: 'folder',
      vaultPath: '/vault',
      relativePath: 'docs',
      addedAt: 1,
    }]);
  });
});
