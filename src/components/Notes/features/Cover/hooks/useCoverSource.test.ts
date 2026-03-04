import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCoverSource } from './useCoverSource';

const hoisted = vi.hoisted(() => ({
  loadImageAsBlob: vi.fn(),
  resolveSystemAssetPath: vi.fn(),
  isBuiltinCover: vi.fn(),
  getBuiltinCoverUrl: vi.fn(),
  loadImageWithDimensions: vi.fn(),
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

vi.mock('../utils/coverUtils', () => ({
  loadImageWithDimensions: hoisted.loadImageWithDimensions,
}));

describe('useCoverSource', () => {
  beforeEach(() => {
    hoisted.loadImageAsBlob.mockReset();
    hoisted.resolveSystemAssetPath.mockReset();
    hoisted.isBuiltinCover.mockReset();
    hoisted.getBuiltinCoverUrl.mockReset();
    hoisted.loadImageWithDimensions.mockReset();

    hoisted.isBuiltinCover.mockReturnValue(false);
    hoisted.loadImageWithDimensions.mockResolvedValue({ width: 1000, height: 500 });
  });

  it('resolves builtin covers', async () => {
    hoisted.isBuiltinCover.mockReturnValue(true);
    hoisted.getBuiltinCoverUrl.mockReturnValue('/builtin/cover.jpg');

    const { result } = renderHook(() =>
      useCoverSource({ url: 'builtin:covers/default', vaultPath: '/vault-a' })
    );

    await waitFor(() => {
      expect(result.current.resolvedSrc).toBe('/builtin/cover.jpg');
    });
    expect(result.current.isError).toBe(false);
    expect(hoisted.resolveSystemAssetPath).not.toHaveBeenCalled();
  });

  it('resolves local covers through system path + blob loader', async () => {
    hoisted.resolveSystemAssetPath.mockResolvedValue('/vault/.nekotick/assets/covers/a.png');
    hoisted.loadImageAsBlob.mockResolvedValue('blob:cover-a');

    const { result } = renderHook(() =>
      useCoverSource({ url: 'covers/a.png', vaultPath: '/vault-a' })
    );

    await waitFor(() => {
      expect(result.current.resolvedSrc).toBe('blob:cover-a');
    });

    expect(hoisted.resolveSystemAssetPath).toHaveBeenCalledWith('/vault-a', 'covers/a.png', 'covers');
    expect(hoisted.loadImageAsBlob).toHaveBeenCalledWith('/vault/.nekotick/assets/covers/a.png');
    expect(result.current.isError).toBe(false);
  });

  it('marks error when local resolution fails', async () => {
    hoisted.resolveSystemAssetPath.mockRejectedValue(new Error('resolve failed'));

    const { result } = renderHook(() =>
      useCoverSource({ url: 'covers/missing.png', vaultPath: '/vault-a' })
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.resolvedSrc).toBeNull();
  });

  it('re-resolves when vaultPath changes for the same url', async () => {
    hoisted.resolveSystemAssetPath
      .mockResolvedValueOnce('/vault-a/a.png')
      .mockResolvedValueOnce('/vault-b/a.png');
    hoisted.loadImageAsBlob
      .mockResolvedValueOnce('blob:a-vault-a')
      .mockResolvedValueOnce('blob:a-vault-b');

    const { result, rerender } = renderHook(
      ({ vaultPath }) => useCoverSource({ url: 'covers/a.png', vaultPath }),
      { initialProps: { vaultPath: '/vault-a' } }
    );

    await waitFor(() => {
      expect(result.current.resolvedSrc).toBe('blob:a-vault-a');
    });

    rerender({ vaultPath: '/vault-b' });

    await waitFor(() => {
      expect(result.current.resolvedSrc).toBe('blob:a-vault-b');
    });
    expect(hoisted.resolveSystemAssetPath).toHaveBeenNthCalledWith(1, '/vault-a', 'covers/a.png', 'covers');
    expect(hoisted.resolveSystemAssetPath).toHaveBeenNthCalledWith(2, '/vault-b', 'covers/a.png', 'covers');
  });

  it('keeps previous source while switching to a new cover', async () => {
    hoisted.resolveSystemAssetPath.mockResolvedValue('/vault/.nekotick/assets/covers/a.png');
    hoisted.loadImageAsBlob
      .mockResolvedValueOnce('blob:cover-a')
      .mockImplementationOnce(() => new Promise<string>(() => {}));

    const { result, rerender } = renderHook(
      ({ url }) => useCoverSource({ url, vaultPath: '/vault-a' }),
      { initialProps: { url: 'covers/a.png' as string | null } }
    );

    await waitFor(() => {
      expect(result.current.resolvedSrc).toBe('blob:cover-a');
    });

    rerender({ url: 'covers/b.png' });

    await waitFor(() => {
      expect(result.current.resolvedSrc).toBeNull();
    });
    expect(result.current.prevSrcRef.current).toBe('blob:cover-a');
  });

  it('clears committing state when preview starts', async () => {
    hoisted.resolveSystemAssetPath.mockResolvedValue('/vault/.nekotick/assets/covers/a.png');
    hoisted.loadImageAsBlob.mockResolvedValue('blob:cover-a');

    const { result } = renderHook(() =>
      useCoverSource({ url: 'covers/a.png', vaultPath: '/vault-a' })
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
    hoisted.resolveSystemAssetPath.mockImplementation(async (_vaultPath: string, assetPath: string) => {
      if (assetPath === 'covers/a.png') return '/vault/.nekotick/assets/covers/a.png';
      if (assetPath === 'covers/b.png') return '/vault/.nekotick/assets/covers/b.png';
      return '/vault/.nekotick/assets/covers/unknown.png';
    });
    hoisted.loadImageAsBlob.mockImplementation(async (fullPath: string) => {
      if (fullPath.includes('/a.png')) return 'blob:cover-a';
      if (fullPath.includes('/b.png')) return 'blob:cover-b';
      return 'blob:cover-unknown';
    });

    const { result, rerender } = renderHook(
      ({ url }) => useCoverSource({ url, vaultPath: '/vault-a' }),
      { initialProps: { url: 'covers/a.png' as string | null } }
    );

    await waitFor(() => {
      expect(result.current.resolvedSrc).toBe('blob:cover-a');
    });

    act(() => {
      result.current.beginSelectionCommit();
    });
    expect(result.current.isSelectionCommitting).toBe(true);

    rerender({ url: 'covers/b.png' });

    await waitFor(() => {
      expect(result.current.resolvedSrc).toBe('blob:cover-b');
    });
    expect(result.current.isSelectionCommitting).toBe(false);
  });
});
