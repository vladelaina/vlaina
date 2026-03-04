import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveCoverAssetUrl } from './resolveCoverAssetUrl';

const hoisted = vi.hoisted(() => ({
  loadImageAsBlob: vi.fn(),
  resolveSystemAssetPath: vi.fn(),
  isBuiltinCover: vi.fn(),
  getBuiltinCoverUrl: vi.fn(),
}));

vi.mock('@/lib/assets/io/reader', () => ({
  loadImageAsBlob: hoisted.loadImageAsBlob,
}));

vi.mock('@/lib/assets/core/paths', () => ({
  resolveSystemAssetPath: hoisted.resolveSystemAssetPath,
}));

vi.mock('@/lib/assets/builtinCovers', () => ({
  isBuiltinCover: hoisted.isBuiltinCover,
  getBuiltinCoverUrl: hoisted.getBuiltinCoverUrl,
}));

describe('resolveCoverAssetUrl', () => {
  beforeEach(() => {
    hoisted.loadImageAsBlob.mockReset();
    hoisted.resolveSystemAssetPath.mockReset();
    hoisted.isBuiltinCover.mockReset();
    hoisted.getBuiltinCoverUrl.mockReset();
    hoisted.isBuiltinCover.mockReturnValue(false);
  });

  it('returns http url when allowed', async () => {
    const url = await resolveCoverAssetUrl({
      assetPath: 'https://example.com/cover.jpg',
      vaultPath: '',
      allowHttp: true,
    });
    expect(url).toBe('https://example.com/cover.jpg');
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

  it('resolves local cover path with covers category by default', async () => {
    hoisted.resolveSystemAssetPath.mockResolvedValue('/vault/.nekotick/assets/covers/a.webp');
    hoisted.loadImageAsBlob.mockResolvedValue('blob:a');

    const url = await resolveCoverAssetUrl({
      assetPath: 'covers/a.webp',
      vaultPath: '/vault-a',
    });

    expect(url).toBe('blob:a');
    expect(hoisted.resolveSystemAssetPath).toHaveBeenCalledWith('/vault-a', 'covers/a.webp', 'covers');
  });

  it('resolves local path with auto icons category', async () => {
    hoisted.resolveSystemAssetPath.mockResolvedValue('/vault/.nekotick/assets/icons/star.webp');
    hoisted.loadImageAsBlob.mockResolvedValue('blob:icon');

    const url = await resolveCoverAssetUrl({
      assetPath: 'icons/star.webp',
      vaultPath: '/vault-a',
      localCategory: 'auto',
    });

    expect(url).toBe('blob:icon');
    expect(hoisted.resolveSystemAssetPath).toHaveBeenCalledWith('/vault-a', 'icons/star.webp', 'icons');
  });

  it('throws when local asset requires vault path', async () => {
    await expect(resolveCoverAssetUrl({
      assetPath: 'covers/a.webp',
      vaultPath: '',
    })).rejects.toThrow('vault-path-required');
  });
});
