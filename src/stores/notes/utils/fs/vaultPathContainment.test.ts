import { describe, expect, it, vi } from 'vitest';
import {
  isSafeVaultPathSegment,
  normalizeVaultRelativePath,
  resolveVaultRelativeFullPath,
} from './vaultPathContainment';

vi.mock('@/lib/storage/adapter', () => ({
  isAbsolutePath: (path: string) => path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path),
  joinPath: (...segments: string[]) => Promise.resolve(segments.join('/').replace(/\/+/g, '/')),
}));

describe('vaultPathContainment', () => {
  it('accepts only single safe relative path segments', () => {
    expect(isSafeVaultPathSegment('alpha.md')).toBe(true);
    expect(isSafeVaultPathSegment('nested')).toBe(true);
    expect(isSafeVaultPathSegment('')).toBe(false);
    expect(isSafeVaultPathSegment('.')).toBe(false);
    expect(isSafeVaultPathSegment('..')).toBe(false);
    expect(isSafeVaultPathSegment('../secret.md')).toBe(false);
    expect(isSafeVaultPathSegment('docs/secret.md')).toBe(false);
    expect(isSafeVaultPathSegment('docs\\secret.md')).toBe(false);
    expect(isSafeVaultPathSegment('secret\0.md')).toBe(false);
  });

  it('normalizes safe vault-relative paths', () => {
    expect(normalizeVaultRelativePath('docs\\alpha.md')).toBe('docs/alpha.md');
    expect(normalizeVaultRelativePath('./docs//alpha.md')).toBe('docs/alpha.md');
    expect(normalizeVaultRelativePath('', { allowEmpty: true })).toBe('');
  });

  it('rejects absolute and parent traversal paths', () => {
    expect(normalizeVaultRelativePath('/etc/passwd')).toBeNull();
    expect(normalizeVaultRelativePath('C:\\Users\\alpha.md')).toBeNull();
    expect(normalizeVaultRelativePath('../secret.md')).toBeNull();
    expect(normalizeVaultRelativePath('docs/../../secret.md')).toBeNull();
  });

  it('resolves safe relative paths below the vault root', async () => {
    await expect(resolveVaultRelativeFullPath('/vault', 'docs/alpha.md')).resolves.toEqual({
      relativePath: 'docs/alpha.md',
      fullPath: '/vault/docs/alpha.md',
    });
  });
});
