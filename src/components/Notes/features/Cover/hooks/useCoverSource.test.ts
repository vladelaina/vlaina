import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCoverSource } from './useCoverSource';

const hoisted = vi.hoisted(() => ({
  loadImageAsBlob: vi.fn(),
  loadImageThumbnailAsBlob: vi.fn(),
  resolveVaultAssetPath: vi.fn(),
  loadImageWithDimensions: vi.fn(),
}));

vi.mock('@/lib/assets/io/reader', () => ({
  loadImageAsBlob: hoisted.loadImageAsBlob,
  loadImageThumbnailAsBlob: hoisted.loadImageThumbnailAsBlob,
}));

vi.mock('@/lib/assets/core/paths', () => ({
  resolveVaultAssetPath: hoisted.resolveVaultAssetPath,
  resolveExistingVaultAssetPath: hoisted.resolveVaultAssetPath,
}));

vi.mock('../utils/coverDimensionCache', () => ({
  loadImageWithDimensions: hoisted.loadImageWithDimensions,
}));

describe('useCoverSource', () => {
  beforeEach(() => {
    hoisted.loadImageAsBlob.mockReset();
    hoisted.loadImageThumbnailAsBlob.mockReset();
    hoisted.resolveVaultAssetPath.mockReset();
    hoisted.loadImageWithDimensions.mockReset();

    hoisted.loadImageWithDimensions.mockResolvedValue({ width: 1000, height: 500 });
  });

  it('marks removed built-in cover aliases as errors', async () => {
    hoisted.resolveVaultAssetPath.mockRejectedValue(new Error('missing'));

    const { result } = renderHook(() =>
      useCoverSource({ url: '@monet/1', vaultPath: '/vault-a' })
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.resolvedSrc).toBeNull();
  });

  it('resolves local covers through vault-relative paths', async () => {
    hoisted.resolveVaultAssetPath.mockResolvedValue('/vault/assets/a.png');
    hoisted.loadImageThumbnailAsBlob.mockResolvedValue('blob:cover-a');

    const { result } = renderHook(() =>
      useCoverSource({ url: 'assets/a.png', vaultPath: '/vault-a' })
    );

    await waitFor(() => {
      expect(result.current.resolvedSrc).toBe('blob:cover-a');
    });

    expect(hoisted.resolveVaultAssetPath).toHaveBeenCalledWith('/vault-a', 'assets/a.png', undefined);
    expect(hoisted.loadImageThumbnailAsBlob).toHaveBeenCalledWith('/vault/assets/a.png', {
      maxEdgePx: 1280,
      allowMainThreadFallback: false,
    });
    expect(result.current.isError).toBe(false);
  });

  it('preserves animated local covers by loading the original blob', async () => {
    hoisted.resolveVaultAssetPath.mockResolvedValue('/vault/assets/animated.gif');
    hoisted.loadImageAsBlob.mockResolvedValue('blob:animated-cover');

    const { result } = renderHook(() =>
      useCoverSource({ url: 'assets/animated.gif', vaultPath: '/vault-a' })
    );

    await waitFor(() => {
      expect(result.current.resolvedSrc).toMatch(/^blob:animated-cover#vlaina-replay=/);
    });

    expect(hoisted.loadImageAsBlob).toHaveBeenCalledWith('/vault/assets/animated.gif');
    expect(hoisted.loadImageThumbnailAsBlob).not.toHaveBeenCalled();
    expect(result.current.isError).toBe(false);
  });

  it('marks error when local resolution fails', async () => {
    hoisted.resolveVaultAssetPath.mockRejectedValue(new Error('resolve failed'));

    const { result } = renderHook(() =>
      useCoverSource({ url: 'assets/missing.png', vaultPath: '/vault-a' })
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.resolvedSrc).toBeNull();
  });

  it('re-resolves when vaultPath changes for the same url', async () => {
    hoisted.resolveVaultAssetPath
      .mockResolvedValueOnce('/vault-a/a.png')
      .mockResolvedValueOnce('/vault-b/a.png');
    hoisted.loadImageThumbnailAsBlob
      .mockResolvedValueOnce('blob:a-vault-a')
      .mockResolvedValueOnce('blob:a-vault-b');

    const { result, rerender } = renderHook(
      ({ vaultPath }) => useCoverSource({ url: 'assets/a.png', vaultPath }),
      { initialProps: { vaultPath: '/vault-a' } }
    );

    await waitFor(() => {
      expect(result.current.resolvedSrc).toBe('blob:a-vault-a');
    });

    rerender({ vaultPath: '/vault-b' });

    await waitFor(() => {
      expect(result.current.resolvedSrc).toBe('blob:a-vault-b');
    });
    expect(hoisted.resolveVaultAssetPath).toHaveBeenNthCalledWith(1, '/vault-a', 'assets/a.png', undefined);
    expect(hoisted.resolveVaultAssetPath).toHaveBeenNthCalledWith(2, '/vault-b', 'assets/a.png', undefined);
  });

  it('keeps image-ready setter stable across url changes', async () => {
    hoisted.resolveVaultAssetPath.mockImplementation(async (_vaultPath: string, assetPath: string) => {
      if (assetPath === 'assets/a.png') return '/vault/assets/a.png';
      return '/vault/assets/b.png';
    });
    hoisted.loadImageThumbnailAsBlob.mockImplementation(async (fullPath: string) => {
      if (fullPath.includes('/a.png')) return 'blob:cover-a';
      return 'blob:cover-b';
    });

    const { result, rerender } = renderHook(
      ({ url }) => useCoverSource({ url, vaultPath: '/vault-a' }),
      { initialProps: { url: 'assets/a.png' as string | null } }
    );

    const initialSetter = result.current.setIsImageReady;

    await waitFor(() => {
      expect(result.current.resolvedSrc).toBe('blob:cover-a');
    });

    rerender({ url: 'assets/b.png' });

    expect(result.current.setIsImageReady).toBe(initialSetter);

    await waitFor(() => {
      expect(result.current.resolvedSrc).toBe('blob:cover-b');
    });
    expect(result.current.setIsImageReady).toBe(initialSetter);
  });

  it('keeps previous source while switching to a new cover', async () => {
    hoisted.resolveVaultAssetPath.mockResolvedValue('/vault/assets/a.png');
    hoisted.loadImageThumbnailAsBlob
      .mockResolvedValueOnce('blob:cover-a')
      .mockImplementationOnce(() => new Promise<string>(() => {}));

    const { result, rerender } = renderHook(
      ({ url }) => useCoverSource({ url, vaultPath: '/vault-a' }),
      { initialProps: { url: 'assets/a.png' as string | null } }
    );

    await waitFor(() => {
      expect(result.current.resolvedSrc).toBe('blob:cover-a');
    });

    rerender({ url: 'assets/b.png' });

    await waitFor(() => {
      expect(result.current.resolvedSrc).toBeNull();
    });
    expect(result.current.prevSrcRef.current).toBe('blob:cover-a');
  });

  it('clears committing state when preview starts', async () => {
    hoisted.resolveVaultAssetPath.mockResolvedValue('/vault/assets/a.png');
    hoisted.loadImageThumbnailAsBlob.mockResolvedValue('blob:cover-a');

    const { result } = renderHook(() =>
      useCoverSource({ url: 'assets/a.png', vaultPath: '/vault-a' })
    );

    await waitFor(() => {
      expect(result.current.resolvedSrc).toBe('blob:cover-a');
    });

    act(() => {
      result.current.beginSelectionCommit();
    });
    expect(result.current.isSelectionCommitting).toBe(true);

    act(() => {
      result.current.setPreviewSrc('/covers/preview.webp');
    });
    expect(result.current.previewSrc).toBe('/covers/preview.webp');
    expect(result.current.isSelectionCommitting).toBe(false);
  });

  it('clears committing state after new cover resolves', async () => {
    hoisted.resolveVaultAssetPath.mockImplementation(async (_vaultPath: string, assetPath: string) => {
      if (assetPath === 'assets/a.png') return '/vault/assets/a.png';
      if (assetPath === 'assets/b.png') return '/vault/assets/b.png';
      return '/vault/assets/unknown.png';
    });
    hoisted.loadImageThumbnailAsBlob.mockImplementation(async (fullPath: string) => {
      if (fullPath.includes('/a.png')) return 'blob:cover-a';
      if (fullPath.includes('/b.png')) return 'blob:cover-b';
      return 'blob:cover-unknown';
    });

    const { result, rerender } = renderHook(
      ({ url }) => useCoverSource({ url, vaultPath: '/vault-a' }),
      { initialProps: { url: 'assets/a.png' as string | null } }
    );

    await waitFor(() => {
      expect(result.current.resolvedSrc).toBe('blob:cover-a');
    });

    act(() => {
      result.current.beginSelectionCommit();
    });
    expect(result.current.isSelectionCommitting).toBe(true);

    rerender({ url: 'assets/b.png' });

    await waitFor(() => {
      expect(result.current.resolvedSrc).toBe('blob:cover-b');
    });
    expect(result.current.isSelectionCommitting).toBe(false);
  });

  it('resolves each switched url only once', async () => {
    hoisted.resolveVaultAssetPath.mockImplementation(async (_vaultPath: string, assetPath: string) => {
      if (assetPath === 'assets/a.png') return '/vault/assets/a.png';
      return '/vault/assets/b.png';
    });
    hoisted.loadImageThumbnailAsBlob.mockImplementation(async (fullPath: string) => {
      if (fullPath.includes('/a.png')) return 'blob:cover-a';
      return 'blob:cover-b';
    });

    const { result, rerender } = renderHook(
      ({ url }) => useCoverSource({ url, vaultPath: '/vault-a' }),
      { initialProps: { url: 'assets/a.png' as string | null } }
    );

    await waitFor(() => {
      expect(result.current.resolvedSrc).toBe('blob:cover-a');
    });

    rerender({ url: 'assets/b.png' });

    await waitFor(() => {
      expect(result.current.resolvedSrc).toBe('blob:cover-b');
    });

    expect(hoisted.resolveVaultAssetPath).toHaveBeenCalledTimes(2);
    expect(hoisted.loadImageThumbnailAsBlob).toHaveBeenCalledTimes(2);
    expect(hoisted.loadImageWithDimensions).toHaveBeenCalledTimes(2);
  });

  it('resolves note-relative paths against the current note', async () => {
    hoisted.resolveVaultAssetPath.mockResolvedValue('/vault/daily/assets/a.png');
    hoisted.loadImageThumbnailAsBlob.mockResolvedValue('blob:daily-cover');

    const { result } = renderHook(() =>
      useCoverSource({
        url: './assets/a.png',
        vaultPath: '/vault-a',
        currentNotePath: 'daily/2026-04-15.md',
      })
    );

    await waitFor(() => {
      expect(result.current.resolvedSrc).toBe('blob:daily-cover');
    });

    expect(hoisted.resolveVaultAssetPath).toHaveBeenCalledWith(
      '/vault-a',
      './assets/a.png',
      'daily/2026-04-15.md'
    );
  });
});
