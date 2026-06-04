import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/desktop/backend', () => ({
  hasElectronDesktopBridge: () => false,
}));

import {
  getParentPath,
  isAbsolutePath,
  joinPath,
  normalizeAbsolutePath,
  relativePath,
} from './pathUtils';

describe('storage path utils', () => {
  it('joins path segments without allowing later absolute markers to reset the base', () => {
    expect(joinPath('/vault/', '/docs', 'alpha.md')).toBe('/vault/docs/alpha.md');
  });

  it('returns stable parent paths for posix and windows roots', () => {
    expect(getParentPath('/vault/docs/alpha.md')).toBe('/vault/docs');
    expect(getParentPath('/')).toBeNull();
    expect(getParentPath('C:\\vault\\alpha.md')).toBe('C:\\vault');
    expect(getParentPath('C:\\')).toBeNull();
    expect(getParentPath('\\\\server\\share\\docs\\alpha.md')).toBe('\\\\server\\share\\docs');
    expect(getParentPath('\\\\server\\share')).toBeNull();
  });

  it('detects absolute paths across posix and windows formats', () => {
    expect(isAbsolutePath('/vault/alpha.md')).toBe(true);
    expect(isAbsolutePath('C:\\vault\\alpha.md')).toBe(true);
    expect(isAbsolutePath('\\\\server\\share\\alpha.md')).toBe(true);
    expect(isAbsolutePath('docs/alpha.md')).toBe(false);
  });

  it('normalizes dot segments in absolute filesystem paths', () => {
    expect(normalizeAbsolutePath('/vault/docs/../alpha.md')).toBe('/vault/alpha.md');
    expect(normalizeAbsolutePath('C:\\vault\\docs\\..\\alpha.md')).toBe('C:\\vault\\alpha.md');
    expect(normalizeAbsolutePath('docs/../alpha.md')).toBe('docs/../alpha.md');
    expect(normalizeAbsolutePath('\\\\server\\share\\docs\\..\\alpha.md')).toBe('\\\\server\\share\\alpha.md');
  });

  it('computes root and same-path relative paths without leaking leading separators', () => {
    expect(relativePath('/', '/alpha.md')).toBe('alpha.md');
    expect(relativePath('/vault', '/vault')).toBe('');
    expect(relativePath('/vault', '/vault/docs/alpha.md')).toBe('docs/alpha.md');
    expect(relativePath('/vault', '/vault2/alpha.md')).toBe('/vault2/alpha.md');
  });
});
