import { describe, expect, it } from 'vitest';
import {
  getAbsoluteRenameWatchPaths,
  getRelativeRenameWatchPaths,
  isInsideVault,
  isCreateWatchEvent,
  isMarkdownPath,
  isRemoveWatchEvent,
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

  it('matches Windows vault watch paths case-insensitively', () => {
    expect(isInsideVault('C:\\Users\\Me\\Vault', 'c:\\users\\me\\vault\\Docs\\Alpha.md')).toBe(true);
    expect(toVaultRelativePath('C:\\Users\\Me\\Vault', 'c:\\users\\me\\vault\\Docs\\Alpha.md')).toBe('Docs/Alpha.md');
    expect(toVaultRelativePath('C:\\Users\\Me\\Vault', 'c:\\users\\me\\vaulted\\Alpha.md')).toBeNull();
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
});
