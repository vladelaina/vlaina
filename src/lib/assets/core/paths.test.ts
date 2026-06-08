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

  it('resolves asset paths with query and fragment against the local file path', async () => {
    await expect(resolveVaultAssetPathCandidates('/vault', 'assets/a.png?cache=1#preview', 'daily/note.md'))
      .resolves.toEqual([
        '/vault/daily/assets/a.png',
        '/vault/assets/a.png',
      ]);
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
      .resolves.toEqual(['/vault/daily/assets/a.png']);
  });

  it('keeps parent traversal inside the vault root', async () => {
    await expect(resolveVaultAssetPathCandidates('/vault', '../assets/a.png', 'daily/note.md'))
      .resolves.toEqual(['/vault/assets/a.png']);
  });

  it('rejects parent traversal outside the vault root', async () => {
    await expect(resolveVaultAssetPathCandidates('/vault', '../../secret.png', 'daily/note.md'))
      .resolves.toEqual([]);
  });

  it('rejects internal vault asset path segments while allowing user dot folders', async () => {
    await expect(resolveVaultAssetPathCandidates('/vault', '.vlaina/assets/a.png', 'daily/note.md'))
      .resolves.toEqual([]);

    await expect(resolveVaultAssetPathCandidates('/vault', 'docs/.git/a.png', 'daily/note.md'))
      .resolves.toEqual([]);

    await expect(resolveVaultAssetPathCandidates('/vault', 'docs/.GIT/a.png', 'daily/note.md'))
      .resolves.toEqual([]);

    await expect(resolveVaultAssetPathCandidates('/vault', './.git/a.png', 'daily/note.md'))
      .resolves.toEqual([]);

    await expect(resolveVaultAssetPathCandidates('/vault', '.notes/assets/a.png', 'daily/note.md'))
      .resolves.toEqual([
        '/vault/daily/.notes/assets/a.png',
        '/vault/.notes/assets/a.png',
      ]);
  });

  it('does not resolve assets from internal current note paths', async () => {
    await expect(resolveVaultAssetPathCandidates('/vault', 'assets/a.png', '.vlaina/workspace.md'))
      .resolves.toEqual([]);

    await expect(resolveVaultAssetPathCandidates('/vault', 'assets/a.png', 'docs/.git/config.md'))
      .resolves.toEqual([]);
  });

  it('rejects absolute asset paths from note metadata', async () => {
    await expect(resolveVaultAssetPathCandidates('/vault', '/etc/passwd', 'daily/note.md'))
      .resolves.toEqual([]);

    await expect(resolveVaultAssetPathCandidates('/vault', 'C:\\Users\\me\\secret.png', 'daily/note.md'))
      .resolves.toEqual([]);
  });

  it('rejects unsafe non-local asset paths before resolving candidates', async () => {
    await expect(resolveVaultAssetPathCandidates('/vault', 'https://example.com/a.png', 'daily/note.md'))
      .resolves.toEqual([]);

    await expect(resolveVaultAssetPathCandidates('/vault', '//example.com/a.png', 'daily/note.md'))
      .resolves.toEqual([]);

    await expect(resolveVaultAssetPathCandidates('/vault', '\\\\server\\share\\a.png', 'daily/note.md'))
      .resolves.toEqual([]);

    await expect(resolveVaultAssetPathCandidates('/vault', 'assets/\u202Ecod.exe.png', 'daily/note.md'))
      .resolves.toEqual([]);

    await expect(resolveVaultAssetPathCandidates('/vault', `${'a'.repeat(16 * 1024)}.png`, 'daily/note.md'))
      .resolves.toEqual([]);
  });

  it('rejects windows parent traversal outside the vault root', async () => {
    await expect(resolveVaultAssetPathCandidates('C:\\vault', '..\\..\\secret.png', 'daily\\note.md'))
      .resolves.toEqual([]);
  });

  it('resolves explicit relative assets beside an absolute external note even when a vault path is provided', async () => {
    await expect(resolveVaultAssetPathCandidates('/vault', './assets/a.png', '/outside/note.md'))
      .resolves.toEqual(['/outside/assets/a.png']);
  });

  it('keeps a vault fallback for bare assets from an absolute external note', async () => {
    await expect(resolveVaultAssetPathCandidates('/vault', 'assets/a.png', '/outside/note.md'))
      .resolves.toEqual([
        '/outside/assets/a.png',
        '/vault/assets/a.png',
      ]);
  });

  it('rejects explicit relative assets that escape an absolute external note directory', async () => {
    await expect(resolveVaultAssetPathCandidates('/vault', '../secret.png', '/outside/note.md'))
      .resolves.toEqual([]);
  });

  it('keeps vault containment for absolute note paths that are still inside the vault', async () => {
    await expect(resolveVaultAssetPathCandidates('/vault', '../assets/a.png', '/vault/daily/note.md'))
      .resolves.toEqual(['/vault/assets/a.png']);
  });
});
