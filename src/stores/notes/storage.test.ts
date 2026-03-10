import { describe, expect, it } from 'vitest';
import {
  createStarredEntry,
  getVaultStarredPaths,
  remapStarredEntriesForVault,
  type StarredEntry,
} from './starred';

function createEntry(
  id: string,
  kind: 'note' | 'folder',
  vaultPath: string,
  relativePath: string
): StarredEntry {
  return {
    id,
    kind,
    vaultPath,
    relativePath,
    addedAt: 1,
  };
}

describe('notes starred storage helpers', () => {
  it('filters current vault starred paths', () => {
    const entries: StarredEntry[] = [
      createEntry('1', 'note', 'C:/vault-a', 'alpha.md'),
      createEntry('2', 'folder', 'C:/vault-a', 'docs'),
      createEntry('3', 'note', 'C:/vault-b', 'beta.md'),
    ];

    expect(getVaultStarredPaths(entries, 'C:\\vault-a')).toEqual({
      notes: ['alpha.md'],
      folders: ['docs'],
    });
  });

  it('remaps and deduplicates starred entries for one vault only', () => {
    const entries: StarredEntry[] = [
      createEntry('1', 'note', 'C:/vault-a', 'docs/alpha.md'),
      createEntry('2', 'folder', 'C:/vault-a', 'docs'),
      createEntry('3', 'note', 'C:/vault-a', 'archive/alpha.md'),
      createEntry('4', 'note', 'C:/vault-b', 'docs/alpha.md'),
    ];

    const result = remapStarredEntriesForVault(entries, 'C:/vault-a', (relativePath, kind) => {
      if (kind === 'folder' && relativePath === 'docs') return 'archive';
      if (relativePath.startsWith('docs/')) return relativePath.replace('docs/', 'archive/');
      return relativePath;
    });

    expect(result.changed).toBe(true);
    expect(result.entries).toEqual([
      createEntry('1', 'note', 'C:/vault-a', 'archive/alpha.md'),
      createEntry('2', 'folder', 'C:/vault-a', 'archive'),
      createEntry('4', 'note', 'C:/vault-b', 'docs/alpha.md'),
    ]);
  });

  it('creates normalized starred entries', () => {
    const entry = createStarredEntry('note', 'C:\\vault-a\\', 'docs\\alpha.md');

    expect(entry.kind).toBe('note');
    expect(entry.vaultPath).toBe('C:/vault-a');
    expect(entry.relativePath).toBe('docs/alpha.md');
    expect(entry.id.startsWith('starred_')).toBe(true);
  });
});
