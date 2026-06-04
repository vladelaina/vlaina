import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveCoverAssetUrl } from './resolveCoverAssetUrl';

const hoisted = vi.hoisted(() => ({
  loadImageAsBlob: vi.fn(),
  loadImageThumbnailAsBlob: vi.fn(),
  resolveExistingVaultAssetPath: vi.fn(),
}));

vi.mock('@/lib/assets/io/reader', () => ({
  loadImageAsBlob: hoisted.loadImageAsBlob,
  loadImageThumbnailAsBlob: hoisted.loadImageThumbnailAsBlob,
}));

vi.mock('@/lib/assets/core/paths', () => ({
  resolveExistingVaultAssetPath: hoisted.resolveExistingVaultAssetPath,
}));

describe('resolveCoverAssetUrl', () => {
  beforeEach(() => {
    hoisted.loadImageAsBlob.mockReset();
    hoisted.loadImageThumbnailAsBlob.mockReset();
    hoisted.resolveExistingVaultAssetPath.mockReset();
  });

  it('rejects remote cover urls', async () => {
    await expect(resolveCoverAssetUrl({
      assetPath: 'https://example.com/cover.jpg',
      vaultPath: '',
    })).rejects.toThrow('remote-cover-unsupported');

    await expect(resolveCoverAssetUrl({
      assetPath: 'HTTPS://example.com/cover.jpg',
      vaultPath: '',
    })).rejects.toThrow('remote-cover-unsupported');

    await expect(resolveCoverAssetUrl({
      assetPath: '//example.com/cover.jpg',
      vaultPath: '',
    })).rejects.toThrow('remote-cover-unsupported');
  });

  it('rejects unsafe persisted cover sources', async () => {
    await expect(resolveCoverAssetUrl({
      assetPath: 'blob:http://localhost/cover',
      vaultPath: '/vault-a',
    })).rejects.toThrow('cover-path-unsupported');

    await expect(resolveCoverAssetUrl({
      assetPath: 'BLOB:http://localhost/cover',
      vaultPath: '/vault-a',
    })).rejects.toThrow('cover-path-unsupported');

    await expect(resolveCoverAssetUrl({
      assetPath: 'javascript:alert(1)',
      vaultPath: '/vault-a',
    })).rejects.toThrow('cover-path-unsupported');

    await expect(resolveCoverAssetUrl({
      assetPath: '/etc/passwd',
      vaultPath: '/vault-a',
    })).rejects.toThrow('cover-path-unsupported');

    expect(hoisted.resolveExistingVaultAssetPath).not.toHaveBeenCalled();
  });

  it('does not resolve removed built-in cover aliases', async () => {
    hoisted.resolveExistingVaultAssetPath.mockResolvedValue(null);

    await expect(resolveCoverAssetUrl({
      assetPath: '@monet/2',
      vaultPath: '/vault-a',
    })).rejects.toThrow('cover-path-unsupported');
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

  it('resolves local cover thumbnails without loading the full image blob', async () => {
    hoisted.resolveExistingVaultAssetPath.mockResolvedValue('/vault/assets/a.webp');
    hoisted.loadImageThumbnailAsBlob.mockResolvedValue('blob:thumb-a');

    const url = await resolveCoverAssetUrl({
      assetPath: 'assets/a.webp',
      vaultPath: '/vault-a',
      thumbnail: true,
    });

    expect(url).toBe('blob:thumb-a');
    expect(hoisted.loadImageThumbnailAsBlob).toHaveBeenCalledWith('/vault/assets/a.webp');
    expect(hoisted.loadImageAsBlob).not.toHaveBeenCalled();
  });

  it('disables main-thread thumbnail fallback for large cover thumbnails', async () => {
    hoisted.resolveExistingVaultAssetPath.mockResolvedValue('/vault/assets/a.webp');
    hoisted.loadImageThumbnailAsBlob.mockResolvedValue('blob:thumb-a');

    const url = await resolveCoverAssetUrl({
      assetPath: 'assets/a.webp',
      vaultPath: '/vault-a',
      thumbnail: true,
      thumbnailMaxEdgePx: 1280,
    });

    expect(url).toBe('blob:thumb-a');
    expect(hoisted.loadImageThumbnailAsBlob).toHaveBeenCalledWith('/vault/assets/a.webp', {
      maxEdgePx: 1280,
      allowMainThreadFallback: false,
    });
    expect(hoisted.loadImageAsBlob).not.toHaveBeenCalled();
  });

  it('coalesces concurrent resolves for the same cover', async () => {
    let resolveBlob: (url: string) => void = () => {
      throw new Error('blob load did not start');
    };
    hoisted.resolveExistingVaultAssetPath.mockResolvedValue('/vault/assets/a.webp');
    hoisted.loadImageAsBlob.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveBlob = resolve;
        })
    );

    const first = resolveCoverAssetUrl({
      assetPath: 'assets/a.webp',
      vaultPath: '/vault-a',
      currentNotePath: 'notes/today.md',
    });
    const second = resolveCoverAssetUrl({
      assetPath: 'assets/a.webp',
      vaultPath: '/vault-a',
      currentNotePath: 'notes/today.md',
    });

    await vi.waitFor(() => {
      expect(hoisted.loadImageAsBlob).toHaveBeenCalledTimes(1);
    });
    resolveBlob('blob:a');

    await expect(Promise.all([first, second])).resolves.toEqual(['blob:a', 'blob:a']);
    expect(hoisted.resolveExistingVaultAssetPath).toHaveBeenCalledTimes(1);
    expect(hoisted.loadImageAsBlob).toHaveBeenCalledTimes(1);
  });

  it('throws when local asset requires vault path', async () => {
    await expect(resolveCoverAssetUrl({
      assetPath: 'assets/a.webp',
      vaultPath: '',
    })).rejects.toThrow('vault-path-required');
  });

  it('rejects unsupported absolute cover paths', async () => {
    hoisted.resolveExistingVaultAssetPath.mockResolvedValue('');

    await expect(resolveCoverAssetUrl({
      assetPath: '/etc/passwd',
      vaultPath: '/vault-a',
    })).rejects.toThrow('cover-path-unsupported');

    expect(hoisted.loadImageAsBlob).not.toHaveBeenCalled();
    expect(hoisted.loadImageThumbnailAsBlob).not.toHaveBeenCalled();
  });
});
