import { describe, expect, it } from 'vitest';
import {
  createStarredEntry,
  getVaultStarredPaths,
  remapStarredEntriesForVault,
  resolveStarredRelativePathForVault,
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

  it('matches Windows current vault starred paths case-insensitively', () => {
    const entries: StarredEntry[] = [
      createEntry('1', 'note', 'C:/Users/Me/Vault', 'alpha.md'),
      createEntry('2', 'folder', 'C:/Users/Me/Vault', 'docs'),
    ];

    expect(getVaultStarredPaths(entries, 'c:\\users\\me\\vault')).toEqual({
      notes: ['alpha.md'],
      folders: ['docs'],
    });

    const result = remapStarredEntriesForVault(entries, 'c:\\users\\me\\vault', (relativePath) =>
      relativePath === 'alpha.md' ? 'beta.md' : relativePath
    );

    expect(result.changed).toBe(true);
    expect(result.entries[0]?.relativePath).toBe('beta.md');
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
    expect(entry.id.startsWith('starred-')).toBe(true);
  });

  it('keeps Windows drive roots valid for starred entries', () => {
    const entry = createStarredEntry('note', 'C:\\', 'docs\\alpha.md');

    expect(entry.vaultPath).toBe('C:/');
    expect(entry.relativePath).toBe('docs/alpha.md');
    expect(resolveStarredRelativePathForVault('C:\\docs\\alpha.md', 'C:\\')).toBe('docs/alpha.md');
  });

  it('resolves only current-vault absolute starred paths to relative paths', () => {
    expect(resolveStarredRelativePathForVault('/vault/docs/alpha.md', '/vault')).toBe('docs/alpha.md');
    expect(resolveStarredRelativePathForVault('docs/alpha.md', '/vault')).toBe('docs/alpha.md');
    expect(resolveStarredRelativePathForVault('/other/docs/alpha.md', '/vault')).toBeNull();
    expect(resolveStarredRelativePathForVault('C:\\vault\\docs\\alpha.md', 'C:/vault')).toBe('docs/alpha.md');
    expect(resolveStarredRelativePathForVault('/docs/alpha.md', '/')).toBe('docs/alpha.md');
  });

  it('normalizes current-vault absolute starred paths before containment checks', () => {
    expect(resolveStarredRelativePathForVault('/vault/docs/../alpha.md', '/vault')).toBe('alpha.md');
    expect(resolveStarredRelativePathForVault('/vault/../secret.md', '/vault')).toBeNull();
    expect(resolveStarredRelativePathForVault('/vaulted/alpha.md', '/vault')).toBeNull();
    expect(resolveStarredRelativePathForVault('c:\\users\\me\\vault\\Docs\\Alpha.md', 'C:\\Users\\Me\\Vault')).toBe('Docs/Alpha.md');
    expect(resolveStarredRelativePathForVault('c:\\users\\me\\vault\\..\\secret.md', 'C:\\Users\\Me\\Vault')).toBeNull();
  });

  it('does not resolve hidden app or git paths for current-vault starred entries', () => {
    expect(resolveStarredRelativePathForVault('/vault/.vlaina/workspace.md', '/vault')).toBeNull();
    expect(resolveStarredRelativePathForVault('/vault/docs/.git/config.md', '/vault')).toBeNull();
    expect(resolveStarredRelativePathForVault('.vlaina/workspace.md', '/vault')).toBeNull();
    expect(resolveStarredRelativePathForVault('docs/.git/config.md', '/vault')).toBeNull();
    expect(resolveStarredRelativePathForVault('/vault/.VLAINA/workspace.md', '/vault')).toBeNull();
    expect(resolveStarredRelativePathForVault('/vault/docs/.GIT/config.md', '/vault')).toBeNull();
    expect(resolveStarredRelativePathForVault('.VLAINA/workspace.md', '/vault')).toBeNull();
    expect(resolveStarredRelativePathForVault('docs/.GIT/config.md', '/vault')).toBeNull();
  });
});
