import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCoverDimensionProbeSrc, getCoverResolveOptions, useCoverSource } from './useCoverSource';
import { clearCoverAssetUrlResolveCacheForTests, resolveCoverAssetUrl } from '../utils/resolveCoverAssetUrl';

const hoisted = vi.hoisted(() => ({
  loadImageAsBlob: vi.fn(),
  loadImageThumbnailAsBlob: vi.fn(),
  resolveNotesRootAssetPath: vi.fn(),
  loadImageWithDimensions: vi.fn(),
}));

vi.mock('@/lib/assets/io/reader', () => ({
  loadImageAsBlob: hoisted.loadImageAsBlob,
  loadImageThumbnailAsBlob: hoisted.loadImageThumbnailAsBlob,
}));

vi.mock('@/lib/assets/core/paths', () => ({
  resolveNotesRootAssetPath: hoisted.resolveNotesRootAssetPath,
  resolveExistingNotesRootAssetPath: hoisted.resolveNotesRootAssetPath,
}));

vi.mock('../utils/coverDimensionCache', () => ({
  loadImageWithDimensions: hoisted.loadImageWithDimensions,
}));

describe('useCoverSource', () => {
  beforeEach(() => {
    clearCoverAssetUrlResolveCacheForTests();
    hoisted.loadImageAsBlob.mockReset();
    hoisted.loadImageThumbnailAsBlob.mockReset();
    hoisted.resolveNotesRootAssetPath.mockReset();
    hoisted.loadImageWithDimensions.mockReset();

    hoisted.loadImageWithDimensions.mockResolvedValue({ width: 1000, height: 500 });
  });

  it('marks removed built-in cover aliases as errors', async () => {
    hoisted.resolveNotesRootAssetPath.mockRejectedValue(new Error('missing'));

    const { result } = renderHook(() =>
      useCoverSource({ url: '@monet/1', notesRootPath: '/notes-root-a' })
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.resolvedSrc).toBeNull();
  });

  it('resolves local covers through notes-root-relative paths', async () => {
    hoisted.resolveNotesRootAssetPath.mockResolvedValue('/notesRoot/assets/a.png');
    hoisted.loadImageThumbnailAsBlob.mockResolvedValue('blob:cover-a');

    const { result } = renderHook(() =>
      useCoverSource({ url: 'assets/a.png', notesRootPath: '/notes-root-a' })
    );

    await waitFor(() => {
      expect(result.current.resolvedSrc).toBe('blob:cover-a');
    });

    expect(hoisted.resolveNotesRootAssetPath).toHaveBeenCalledWith('/notes-root-a', 'assets/a.png', undefined);
    expect(hoisted.loadImageThumbnailAsBlob).toHaveBeenCalledWith('/notesRoot/assets/a.png', {
      maxEdgePx: 1280,
      allowMainThreadFallback: false,
    });
    expect(result.current.isError).toBe(false);
  });

  it('reuses the preview thumbnail when the same cover is committed', async () => {
    const options = getCoverResolveOptions({
      url: 'assets/a.png',
      notesRootPath: '/notes-root-a',
      currentNotePath: 'notes/today.md',
    });
    expect(options.animatedPlaybackKey).toBe('notes/today.md');
    hoisted.resolveNotesRootAssetPath.mockResolvedValue('/notesRoot/assets/a.png');
    hoisted.loadImageThumbnailAsBlob.mockResolvedValue('blob:cover-a');

    await expect(resolveCoverAssetUrl(options)).resolves.toBe('blob:cover-a');
    const { result } = renderHook(() =>
      useCoverSource({
        url: 'assets/a.png',
        notesRootPath: '/notes-root-a',
        currentNotePath: 'notes/today.md',
      })
    );

    expect(result.current.resolvedSrc).toBe('blob:cover-a');
    await waitFor(() => expect(result.current.resolvedSrc).toBe('blob:cover-a'));
    expect(hoisted.loadImageThumbnailAsBlob).toHaveBeenCalledTimes(1);
  });

  it('preserves animated local covers by loading the original blob', async () => {
    hoisted.resolveNotesRootAssetPath.mockResolvedValue('/notesRoot/assets/animated.gif');
    hoisted.loadImageAsBlob.mockResolvedValue('blob:animated-cover');

    const { result } = renderHook(() =>
      useCoverSource({ url: 'assets/animated.gif', notesRootPath: '/notes-root-a' })
    );

    await waitFor(() => {
      expect(result.current.resolvedSrc).toMatch(/^blob:animated-cover#vlaina-replay=/);
    });

    expect(hoisted.loadImageAsBlob).toHaveBeenCalledWith('/notesRoot/assets/animated.gif');
    expect(hoisted.loadImageThumbnailAsBlob).not.toHaveBeenCalled();
    expect(hoisted.loadImageWithDimensions).toHaveBeenCalledWith(
      expect.stringMatching(/^blob:animated-cover#vlaina-replay=.*&vlaina-dimension-probe=1$/),
    );
    expect(result.current.isError).toBe(false);
  });

  it('keeps static cover dimension probes on the displayed source', () => {
    expect(getCoverDimensionProbeSrc('assets/cover.png', 'blob:cover')).toBe('blob:cover');
  });

  it('marks error when local resolution fails', async () => {
    hoisted.resolveNotesRootAssetPath.mockRejectedValue(new Error('resolve failed'));

    const { result } = renderHook(() =>
      useCoverSource({ url: 'assets/missing.png', notesRootPath: '/notes-root-a' })
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.resolvedSrc).toBeNull();
  });

  it('re-resolves when notesRootPath changes for the same url', async () => {
    hoisted.resolveNotesRootAssetPath
      .mockResolvedValueOnce('/notes-root-a/a.png')
      .mockResolvedValueOnce('/notes-root-b/a.png');
    hoisted.loadImageThumbnailAsBlob
      .mockResolvedValueOnce('blob:a-notes-root-a')
      .mockResolvedValueOnce('blob:a-notes-root-b');

    const { result, rerender } = renderHook(
      ({ notesRootPath }) => useCoverSource({ url: 'assets/a.png', notesRootPath }),
      { initialProps: { notesRootPath: '/notes-root-a' } }
    );

    await waitFor(() => {
      expect(result.current.resolvedSrc).toBe('blob:a-notes-root-a');
    });

    rerender({ notesRootPath: '/notes-root-b' });

    await waitFor(() => {
      expect(result.current.resolvedSrc).toBe('blob:a-notes-root-b');
    });
    expect(hoisted.resolveNotesRootAssetPath).toHaveBeenNthCalledWith(1, '/notes-root-a', 'assets/a.png', undefined);
    expect(hoisted.resolveNotesRootAssetPath).toHaveBeenNthCalledWith(2, '/notes-root-b', 'assets/a.png', undefined);
  });

  it('keeps image-ready setter stable across url changes', async () => {
    hoisted.resolveNotesRootAssetPath.mockImplementation(async (_notesRootPath: string, assetPath: string) => {
      if (assetPath === 'assets/a.png') return '/notesRoot/assets/a.png';
      return '/notesRoot/assets/b.png';
    });
    hoisted.loadImageThumbnailAsBlob.mockImplementation(async (fullPath: string) => {
      if (fullPath.includes('/a.png')) return 'blob:cover-a';
      return 'blob:cover-b';
    });

    const { result, rerender } = renderHook(
      ({ url }) => useCoverSource({ url, notesRootPath: '/notes-root-a' }),
      { initialProps: { url: 'assets/a.png' as string | null } }
    );

    const initialSetter = result.current.setIsImageReady;

    await waitFor(() => {
      expect(result.current.resolvedSrc).toBe('blob:cover-a');
    });

    act(() => {
      rerender({ url: 'assets/b.png' });
    });

    expect(result.current.setIsImageReady).toBe(initialSetter);

    await waitFor(() => {
      expect(result.current.resolvedSrc).toBe('blob:cover-b');
    });
    expect(result.current.setIsImageReady).toBe(initialSetter);
  });

  it('keeps previous source while switching to a new cover', async () => {
    hoisted.resolveNotesRootAssetPath.mockResolvedValue('/notesRoot/assets/a.png');
    hoisted.loadImageThumbnailAsBlob
      .mockResolvedValueOnce('blob:cover-a')
      .mockImplementationOnce(() => new Promise<string>(() => {}));

    const { result, rerender } = renderHook(
      ({ url }) => useCoverSource({ url, notesRootPath: '/notes-root-a' }),
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

  it('uses a cached source immediately when switching back to a previously resolved cover', async () => {
    hoisted.resolveNotesRootAssetPath.mockImplementation(async (_notesRootPath: string, assetPath: string) => {
      if (assetPath === 'assets/a.png') return '/notesRoot/assets/a.png';
      return '/notesRoot/assets/b.png';
    });
    hoisted.loadImageThumbnailAsBlob.mockImplementation(async (fullPath: string) => {
      if (fullPath.includes('/a.png')) return 'blob:cover-a';
      return 'blob:cover-b';
    });

    const { result, rerender } = renderHook(
      ({ url }) => useCoverSource({ url, notesRootPath: '/notes-root-a' }),
      { initialProps: { url: 'assets/a.png' as string | null } }
    );

    await waitFor(() => {
      expect(result.current.resolvedSrc).toBe('blob:cover-a');
    });

    rerender({ url: 'assets/b.png' });

    await waitFor(() => {
      expect(result.current.resolvedSrc).toBe('blob:cover-b');
    });

    act(() => {
      rerender({ url: 'assets/a.png' });
    });

    expect(result.current.resolvedSrc).toBe('blob:cover-a');
    await waitFor(() => {
      expect(result.current.resolvedSrc).toBe('blob:cover-a');
    });
  });

  it('does not reuse a previous note cover while resolving the same relative url for another note', async () => {
    hoisted.resolveNotesRootAssetPath.mockImplementation(
      async (_notesRootPath: string, _assetPath: string, currentNotePath?: string) => {
        if (currentNotePath === 'a.md') return '/notesRoot/a/assets/cover.png';
        return '/notesRoot/b/assets/cover.png';
      }
    );
    hoisted.loadImageThumbnailAsBlob
      .mockResolvedValueOnce('blob:cover-a')
      .mockImplementationOnce(() => new Promise<string>(() => {}));

    const { result, rerender } = renderHook(
      ({ currentNotePath }) =>
        useCoverSource({
          url: './assets/cover.png',
          notesRootPath: '/notes-root-a',
          currentNotePath,
        }),
      { initialProps: { currentNotePath: 'a.md' } }
    );

    await waitFor(() => {
      expect(result.current.resolvedSrc).toBe('blob:cover-a');
    });

    rerender({ currentNotePath: 'b.md' });

    expect(result.current.resolvedSrc).toBeNull();
    expect(result.current.canUsePreviousSource).toBe(false);

    await waitFor(() => {
      expect(result.current.prevSrcRef.current).toBeNull();
    });
  });

  it('clears committing state when preview starts', async () => {
    hoisted.resolveNotesRootAssetPath.mockResolvedValue('/notesRoot/assets/a.png');
    hoisted.loadImageThumbnailAsBlob.mockResolvedValue('blob:cover-a');

    const { result } = renderHook(() =>
      useCoverSource({ url: 'assets/a.png', notesRootPath: '/notes-root-a' })
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
    hoisted.resolveNotesRootAssetPath.mockImplementation(async (_notesRootPath: string, assetPath: string) => {
      if (assetPath === 'assets/a.png') return '/notesRoot/assets/a.png';
      if (assetPath === 'assets/b.png') return '/notesRoot/assets/b.png';
      return '/notesRoot/assets/unknown.png';
    });
    hoisted.loadImageThumbnailAsBlob.mockImplementation(async (fullPath: string) => {
      if (fullPath.includes('/a.png')) return 'blob:cover-a';
      if (fullPath.includes('/b.png')) return 'blob:cover-b';
      return 'blob:cover-unknown';
    });

    const { result, rerender } = renderHook(
      ({ url }) => useCoverSource({ url, notesRootPath: '/notes-root-a' }),
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
    hoisted.resolveNotesRootAssetPath.mockImplementation(async (_notesRootPath: string, assetPath: string) => {
      if (assetPath === 'assets/a.png') return '/notesRoot/assets/a.png';
      return '/notesRoot/assets/b.png';
    });
    hoisted.loadImageThumbnailAsBlob.mockImplementation(async (fullPath: string) => {
      if (fullPath.includes('/a.png')) return 'blob:cover-a';
      return 'blob:cover-b';
    });

    const { result, rerender } = renderHook(
      ({ url }) => useCoverSource({ url, notesRootPath: '/notes-root-a' }),
      { initialProps: { url: 'assets/a.png' as string | null } }
    );

    await waitFor(() => {
      expect(result.current.resolvedSrc).toBe('blob:cover-a');
    });

    rerender({ url: 'assets/b.png' });

    await waitFor(() => {
      expect(result.current.resolvedSrc).toBe('blob:cover-b');
    });

    expect(hoisted.resolveNotesRootAssetPath).toHaveBeenCalledTimes(2);
    expect(hoisted.loadImageThumbnailAsBlob).toHaveBeenCalledTimes(2);
    expect(hoisted.loadImageWithDimensions).toHaveBeenCalledTimes(2);
  });

  it('resolves note-relative paths against the current note', async () => {
    hoisted.resolveNotesRootAssetPath.mockResolvedValue('/notesRoot/daily/assets/a.png');
    hoisted.loadImageThumbnailAsBlob.mockResolvedValue('blob:daily-cover');

    const { result } = renderHook(() =>
      useCoverSource({
        url: './assets/a.png',
        notesRootPath: '/notes-root-a',
        currentNotePath: 'daily/2026-04-15.md',
      })
    );

    await waitFor(() => {
      expect(result.current.resolvedSrc).toBe('blob:daily-cover');
    });

    expect(hoisted.resolveNotesRootAssetPath).toHaveBeenCalledWith(
      '/notes-root-a',
      './assets/a.png',
      'daily/2026-04-15.md'
    );
  });
});
