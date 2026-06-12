import { describe, expect, it } from 'vitest';
import {
  getAbsoluteRenameWatchPaths,
  getRelevantRelativeWatchPaths,
  getRelativeRenameWatchPaths,
  isInsideVault,
  isCreateWatchEvent,
  isIgnoredWatchPath,
  isMarkdownPath,
  isRemoveWatchEvent,
  normalizeFsPath,
  toVaultRelativePath,
} from './notesExternalSyncUtils';

describe('notesExternalSyncUtils', () => {
  it('parses absolute rename paths from a paired rename event', () => {
    const renamePaths = getAbsoluteRenameWatchPaths({
      type: { modify: { kind: 'rename', mode: 'both' } },
      paths: ['C:\\vault\\docs', 'C:\\vault\\archive'],
    });

    expect(renamePaths).toEqual({
      oldPath: 'C:/vault/docs',
      newPath: 'C:/vault/archive',
    });
  });

  it('normalizes dot segments in absolute rename paths', () => {
    expect(normalizeFsPath('/vault/docs/../alpha.md')).toBe('/vault/alpha.md');
    expect(normalizeFsPath('docs/../alpha.md')).toBe('docs/../alpha.md');

    const renamePaths = getAbsoluteRenameWatchPaths({
      type: { modify: { kind: 'rename', mode: 'both' } },
      paths: ['/vault/docs/../alpha.md', '/vault/archive/./alpha.md'],
    });

    expect(renamePaths).toEqual({
      oldPath: '/vault/alpha.md',
      newPath: '/vault/archive/alpha.md',
    });
  });

  it('converts rename paths to vault-relative paths', () => {
    const renamePaths = getRelativeRenameWatchPaths('C:\\vault', {
      type: { modify: { kind: 'rename', mode: 'both' } },
      paths: ['C:\\vault\\docs', 'C:\\vault\\archive'],
    });

    expect(renamePaths).toEqual({
      oldPath: 'docs',
      newPath: 'archive',
    });
  });

  it('converts root-vault absolute paths to relative paths', () => {
    expect(isInsideVault('/', '/docs/alpha.md')).toBe(true);
    expect(toVaultRelativePath('/', '/docs/alpha.md')).toBe('docs/alpha.md');
    expect(toVaultRelativePath('/', '/')).toBe('');
  });

  it('rejects dot-segment absolute paths that normalize outside the vault', () => {
    expect(isInsideVault('/vault', '/vault/docs/../alpha.md')).toBe(true);
    expect(toVaultRelativePath('/vault', '/vault/docs/../alpha.md')).toBe('alpha.md');
    expect(isInsideVault('/vault', '/vault/../secret.md')).toBe(false);
    expect(toVaultRelativePath('/vault', '/vault/../secret.md')).toBeNull();
  });

  it('matches Windows vault watch paths case-insensitively', () => {
    expect(isInsideVault('C:\\Users\\Me\\Vault', 'c:\\users\\me\\vault\\Docs\\Alpha.md')).toBe(true);
    expect(toVaultRelativePath('C:\\Users\\Me\\Vault', 'c:\\users\\me\\vault\\Docs\\Alpha.md')).toBe('Docs/Alpha.md');
    expect(isInsideVault('C:\\Users\\Me\\Vault', 'c:\\users\\me\\vault\\..\\secret.md')).toBe(false);
    expect(toVaultRelativePath('C:\\Users\\Me\\Vault', 'c:\\users\\me\\vault\\..\\secret.md')).toBeNull();
    expect(toVaultRelativePath('C:\\Users\\Me\\Vault', 'c:\\users\\me\\vaulted\\Alpha.md')).toBeNull();
  });

  it('preserves UNC roots while matching vault watch paths', () => {
    expect(isInsideVault('\\\\SERVER\\Share', '\\\\server\\share\\Docs\\Alpha.md')).toBe(true);
    expect(toVaultRelativePath('\\\\SERVER\\Share', '\\\\server\\share\\Docs\\Alpha.md')).toBe('Docs/Alpha.md');
    expect(isInsideVault('\\\\server\\share', '/server/share/Docs/Alpha.md')).toBe(false);
    expect(toVaultRelativePath('\\\\server\\share', '/server/share/Docs/Alpha.md')).toBeNull();
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
    expect(isIgnoredWatchPath('.vlaina/workspace.json')).toBe(true);
    expect(isIgnoredWatchPath('docs/.git/config')).toBe(true);
    expect(isIgnoredWatchPath('.VLAINA/workspace.json')).toBe(true);
    expect(isIgnoredWatchPath('docs/.GIT/config')).toBe(true);
    expect(isIgnoredWatchPath('docs/cache.tmp')).toBe(true);
    expect(isIgnoredWatchPath('.notes/alpha.md')).toBe(false);
    expect(getRelevantRelativeWatchPaths('/vault', [
      '/vault/.vlaina/workspace.json',
      '/vault/docs/.git/config',
      '/vault/.VLAINA/workspace.json',
      '/vault/docs/.GIT/config',
      '/vault/.notes/alpha.md',
    ])).toEqual(['.notes/alpha.md']);
  });

  it('rejects unsafe characters when converting watch paths', () => {
    expect(toVaultRelativePath('/vault', '/vault/docs/secret\0.md')).toBeNull();
    expect(toVaultRelativePath('/vault', '/vault/docs/secret\u202Egnp.md')).toBeNull();
    expect(toVaultRelativePath('/vault', '/vault/docs/secret\uFFFD.md')).toBeNull();
    expect(toVaultRelativePath('/vault', '/vault/.notes/alpha.md')).toBe('.notes/alpha.md');

    expect(getRelevantRelativeWatchPaths('/vault', [
      '/vault/.notes/alpha.md',
      '/vault/docs/secret\0.md',
      '/vault/docs/secret\u202Egnp.md',
      '/vault/docs/secret\uFFFD.md',
    ])).toEqual(['.notes/alpha.md']);
  });

  it('drops unsafe rename watch endpoints', () => {
    expect(getRelativeRenameWatchPaths('/vault', {
      type: { modify: { kind: 'rename', mode: 'both' } },
      paths: ['/vault/docs/secret\u202Egnp.md', '/vault/docs/alpha.md'],
    })).toEqual({
      oldPath: null,
      newPath: 'docs/alpha.md',
    });

    expect(getRelativeRenameWatchPaths('/vault', {
      type: { modify: { kind: 'rename', mode: 'both' } },
      paths: ['/vault/docs/secret\u202Egnp.md', '/vault/docs/secret\uFFFD.md'],
    })).toBeNull();
  });
});
