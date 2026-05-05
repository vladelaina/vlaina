import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveCoverAssetUrl } from './resolveCoverAssetUrl';

const hoisted = vi.hoisted(() => ({
  loadImageAsBlob: vi.fn(),
  resolveExistingVaultAssetPath: vi.fn(),
  isBuiltinCover: vi.fn(),
  getBuiltinCoverUrl: vi.fn(),
}));

vi.mock('@/lib/assets/io/reader', () => ({
  loadImageAsBlob: hoisted.loadImageAsBlob,
}));

vi.mock('@/lib/assets/core/paths', () => ({
  resolveExistingVaultAssetPath: hoisted.resolveExistingVaultAssetPath,
}));

vi.mock('@/lib/assets/builtinCovers', () => ({
  isBuiltinCover: hoisted.isBuiltinCover,
  getBuiltinCoverUrl: hoisted.getBuiltinCoverUrl,
}));

describe('resolveCoverAssetUrl', () => {
  beforeEach(() => {
    hoisted.loadImageAsBlob.mockReset();
    hoisted.resolveExistingVaultAssetPath.mockReset();
    hoisted.isBuiltinCover.mockReset();
    hoisted.getBuiltinCoverUrl.mockReset();
    hoisted.isBuiltinCover.mockReturnValue(false);
  });

  it('rejects remote cover urls', async () => {
    await expect(resolveCoverAssetUrl({
      assetPath: 'https://example.com/cover.jpg',
      vaultPath: '',
    })).rejects.toThrow('remote-cover-unsupported');
  });

  it('returns builtin url', async () => {
    hoisted.isBuiltinCover.mockReturnValue(true);
    hoisted.getBuiltinCoverUrl.mockReturnValue('/builtin/cover.webp');

    const url = await resolveCoverAssetUrl({
      assetPath: '@monet/2',
      vaultPath: '/vault-a',
    });
    expect(url).toBe('/builtin/cover.webp');
  });

  it('resolves local cover path against the vault', async () => {
    hoisted.resolveExistingVaultAssetPath.mockResolvedValue('/vault/assets/a.webp');
    hoisted.loadImageAsBlob.mockResolvedValue('blob:a');

    const url = await resolveCoverAssetUrl({
      assetPath: 'assets/a.webp',
      vaultPath: '/vault-a',
    });

    expect(url).toBe('blob:a');
    expect(hoisted.resolveExistingVaultAssetPath).toHaveBeenCalledWith('/vault-a', 'assets/a.webp', undefined);
  });

  it('resolves note-relative cover paths against the current note', async () => {
    hoisted.resolveExistingVaultAssetPath.mockResolvedValue('/vault/notes/assets/cover.webp');
    hoisted.loadImageAsBlob.mockResolvedValue('blob:relative');

    const url = await resolveCoverAssetUrl({
      assetPath: './assets/cover.webp',
      vaultPath: '/vault-a',
      currentNotePath: 'notes/today.md',
    });

    expect(url).toBe('blob:relative');
    expect(hoisted.resolveExistingVaultAssetPath).toHaveBeenCalledWith('/vault-a', './assets/cover.webp', 'notes/today.md');
  });

  it('throws when local asset requires vault path', async () => {
    await expect(resolveCoverAssetUrl({
      assetPath: 'assets/a.webp',
      vaultPath: '',
    })).rejects.toThrow('vault-path-required');
  });
});
