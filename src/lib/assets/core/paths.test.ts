import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  resolveExistingVaultAssetPath,
  resolveVaultAssetPath,
  resolveVaultAssetPathCandidates,
} from './paths';

const hoisted = vi.hoisted(() => ({
  exists: vi.fn(),
}));

vi.mock('@/lib/storage/adapter', () => ({
  getParentPath: (path: string) => {
    const normalized = path.replace(/\\/g, '/');
    const index = normalized.lastIndexOf('/');
    return index <= 0 ? '' : normalized.slice(0, index);
  },
  getStorageAdapter: () => ({
    exists: hoisted.exists,
  }),
  isAbsolutePath: (path: string) => path.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(path),
  joinPath: (...segments: string[]) => Promise.resolve(
    segments
      .filter(Boolean)
      .map((segment, index) => {
        if (index > 0) return segment.replace(/^[/\\]+/, '');
        return segment.replace(/[/\\]+$/, '');
      })
      .join('/')
  ),
}));

describe('asset path resolution', () => {
  beforeEach(() => {
    hoisted.exists.mockReset();
  });

  it('keeps legacy resolution as note-relative first', async () => {
    await expect(resolveVaultAssetPath('/vault', 'assets/a.png', 'daily/note.md'))
      .resolves.toBe('/vault/daily/assets/a.png');
  });

  it('offers a vault-root fallback for bare asset paths in nested notes', async () => {
    await expect(resolveVaultAssetPathCandidates('/vault', 'assets/a.png', 'daily/note.md'))
      .resolves.toEqual([
        '/vault/daily/assets/a.png',
        '/vault/assets/a.png',
      ]);
  });

  it('uses the first existing candidate when resolving for display', async () => {
    hoisted.exists
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    await expect(resolveExistingVaultAssetPath('/vault', 'assets/a.png', 'daily/note.md'))
      .resolves.toBe('/vault/assets/a.png');
  });

  it('does not add a fallback for explicit note-relative paths', async () => {
    await expect(resolveVaultAssetPathCandidates('/vault', './assets/a.png', 'daily/note.md'))
      .resolves.toEqual(['/vault/daily/./assets/a.png']);
  });
});
