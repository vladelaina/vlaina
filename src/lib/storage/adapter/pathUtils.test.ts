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
    expect(joinPath('/notesRoot/', '/docs', 'alpha.md')).toBe('/notesRoot/docs/alpha.md');
  });

  it('returns stable parent paths for posix and windows roots', () => {
    expect(getParentPath('/notesRoot/docs/alpha.md')).toBe('/notesRoot/docs');
    expect(getParentPath('/')).toBeNull();
    expect(getParentPath('C:\\notesRoot\\alpha.md')).toBe('C:\\notesRoot');
    expect(getParentPath('C:\\')).toBeNull();
    expect(getParentPath('\\\\server\\share\\docs\\alpha.md')).toBe('\\\\server\\share\\docs');
    expect(getParentPath('\\\\server\\share')).toBeNull();
  });

  it('detects absolute paths across posix and windows formats', () => {
    expect(isAbsolutePath('/notesRoot/alpha.md')).toBe(true);
    expect(isAbsolutePath('C:\\notesRoot\\alpha.md')).toBe(true);
    expect(isAbsolutePath('\\\\server\\share\\alpha.md')).toBe(true);
    expect(isAbsolutePath('docs/alpha.md')).toBe(false);
  });

  it('normalizes dot segments in absolute filesystem paths', () => {
    expect(normalizeAbsolutePath('/notesRoot/docs/../alpha.md')).toBe('/notesRoot/alpha.md');
    expect(normalizeAbsolutePath('C:\\notesRoot\\docs\\..\\alpha.md')).toBe('C:\\notesRoot\\alpha.md');
    expect(normalizeAbsolutePath('docs/../alpha.md')).toBe('docs/../alpha.md');
    expect(normalizeAbsolutePath('\\\\server\\share\\docs\\..\\alpha.md')).toBe('\\\\server\\share\\alpha.md');
  });

  it('computes root and same-path relative paths without leaking leading separators', () => {
    expect(relativePath('/', '/alpha.md')).toBe('alpha.md');
    expect(relativePath('/notesRoot', '/notesRoot')).toBe('');
    expect(relativePath('/notesRoot', '/notesRoot/docs/alpha.md')).toBe('docs/alpha.md');
    expect(relativePath('/notesRoot', '/notesRoot2/alpha.md')).toBe('/notesRoot2/alpha.md');
  });
});
