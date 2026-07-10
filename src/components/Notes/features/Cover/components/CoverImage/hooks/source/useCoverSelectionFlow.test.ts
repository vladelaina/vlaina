import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_PENDING_COVER_PREVIEW_REQUESTS,
  useCoverSelectionFlow,
} from './useCoverSelectionFlow';

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

vi.mock('../../../../utils/coverConstants', () => ({
  DEFAULT_POSITION_PERCENT: 50,
  DEFAULT_SCALE: 1,
}));

vi.mock('../../../../utils/coverDimensionCache', () => ({
  loadImageWithDimensions: hoisted.loadImageWithDimensions,
}));

describe('useCoverSelectionFlow', () => {
  beforeEach(() => {
    hoisted.loadImageAsBlob.mockReset();
    hoisted.loadImageThumbnailAsBlob.mockReset();
    hoisted.resolveNotesRootAssetPath.mockReset();
    hoisted.loadImageWithDimensions.mockReset();

    hoisted.resolveNotesRootAssetPath.mockImplementation(async (_notesRootPath: string, assetPath: string) => `/notesRoot/${assetPath}`);
    hoisted.loadImageAsBlob.mockImplementation(async (fullPath: string) => `blob:${fullPath.split('/').pop()}`);
    hoisted.loadImageThumbnailAsBlob.mockImplementation(async (fullPath: string) => `thumb:${fullPath.split('/').pop()}`);
    hoisted.loadImageWithDimensions.mockResolvedValue({ width: 1200, height: 800 });
  });

  it('transitions phase from idle to previewing and committing', async () => {
    const onUpdate = vi.fn();
    const setShowPicker = vi.fn();

    const { result } = renderHook(() =>
      useCoverSelectionFlow({
        url: null,
        coverHeight: 240,
        notesRootPath: '/notes-root-a',
        onUpdate,
        setShowPicker,
      })
    );

    expect(result.current.phase).toBe('idle');

    await act(async () => {
      await result.current.handlePreview('covers/monet-4.png');
    });

    await waitFor(() => {
      expect(result.current.phase).toBe('previewing');
    });
    expect(result.current.previewSrc).toBe('thumb:monet-4.png');

    act(() => {
      result.current.handleCoverSelect('covers/monet-5.png');
    });

    expect(result.current.isSelectionCommitting).toBe(true);
    expect(result.current.previewSrc).toBeNull();
    expect(result.current.phase).toBe('committing');
    expect(onUpdate).toHaveBeenCalledWith('covers/monet-5.png', 50, 50, 240, 1);
    expect(setShowPicker).toHaveBeenCalledWith(false);
  });

  it('keeps newly selected covers on automatic height', () => {
    const onUpdate = vi.fn();
    const { result } = renderHook(() =>
      useCoverSelectionFlow({
        url: null,
        notesRootPath: '/notes-root-a',
        onUpdate,
        setShowPicker: vi.fn(),
      })
    );

    act(() => {
      result.current.handleCoverSelect('covers/automatic.png');
    });

    expect(onUpdate).toHaveBeenCalledWith('covers/automatic.png', 50, 50, undefined, 1);
  });

  it('keeps the active preview visible while committing the previewed cover', async () => {
    const onUpdate = vi.fn();
    const setShowPicker = vi.fn();

    const { result } = renderHook(() =>
      useCoverSelectionFlow({
        url: 'covers/monet-2.png',
        coverHeight: 240,
        notesRootPath: '/notes-root-a',
        onUpdate,
        setShowPicker,
      })
    );

    await waitFor(() => {
      expect(result.current.resolvedSrc).toBe('thumb:monet-2.png');
    });

    await act(async () => {
      await result.current.handlePreview('covers/monet-5.png');
    });

    await waitFor(() => {
      expect(result.current.previewSrc).toBe('thumb:monet-5.png');
    });

    act(() => {
      result.current.handleCoverSelect('covers/monet-5.png');
    });

    expect(result.current.previewSrc).toBe('thumb:monet-5.png');
    expect(result.current.isSelectionCommitting).toBe(true);
    expect(result.current.phase).toBe('committing');
    expect(onUpdate).toHaveBeenCalledWith('covers/monet-5.png', 50, 50, 240, 1);
  });

  it('selecting same cover clears preview and keeps non-committing state', async () => {
    const onUpdate = vi.fn();
    const setShowPicker = vi.fn();

    const { result } = renderHook(() =>
      useCoverSelectionFlow({
        url: 'covers/monet-2.png',
        coverHeight: 320,
        notesRootPath: '/notes-root-a',
        onUpdate,
        setShowPicker,
      })
    );

    await waitFor(() => {
      expect(result.current.resolvedSrc).toBe('thumb:monet-2.png');
    });

    await act(async () => {
      await result.current.handlePreview('covers/monet-3.png');
    });

    await waitFor(() => {
      expect(result.current.previewSrc).toBe('thumb:monet-3.png');
    });
    expect(result.current.phase).toBe('previewing');

    act(() => {
      result.current.handleCoverSelect('covers/monet-2.png');
    });

    await waitFor(() => {
      expect(result.current.previewSrc).toBeNull();
    });
    expect(result.current.isSelectionCommitting).toBe(false);
    expect(result.current.phase).toBe('ready');
    expect(onUpdate).toHaveBeenCalledWith('covers/monet-2.png', 50, 50, 320, 1);
    expect(setShowPicker).toHaveBeenCalledWith(false);
  });

  it('does not enter preview mode when hovering the currently selected cover', async () => {
    const onUpdate = vi.fn();
    const setShowPicker = vi.fn();

    const { result } = renderHook(() =>
      useCoverSelectionFlow({
        url: 'covers/monet-2.png',
        coverHeight: 240,
        notesRootPath: '/notes-root-a',
        onUpdate,
        setShowPicker,
      })
    );

    await waitFor(() => {
      expect(result.current.resolvedSrc).toBe('thumb:monet-2.png');
    });

    await act(async () => {
      await result.current.handlePreview('covers/monet-2.png');
    });

    expect(result.current.previewSrc).toBeNull();
    expect(result.current.phase).toBe('ready');
  });

  it('reuses the same in-flight preview request for repeated preview of one asset', async () => {
    const onUpdate = vi.fn();
    const setShowPicker = vi.fn();

    hoisted.resolveNotesRootAssetPath.mockResolvedValue('/notesRoot/assets/a.png');
    hoisted.loadImageThumbnailAsBlob.mockResolvedValue('thumb:cover-a');

    const { result } = renderHook(() =>
      useCoverSelectionFlow({
        url: null,
        coverHeight: 240,
        notesRootPath: '/notes-root-a',
        onUpdate,
        setShowPicker,
      })
    );

    await act(async () => {
      await Promise.all([
        result.current.handlePreview('covers/a.png'),
        result.current.handlePreview('covers/a.png'),
      ]);
    });

    await waitFor(() => {
      expect(result.current.previewSrc).toBe('thumb:cover-a');
    });

    expect(hoisted.resolveNotesRootAssetPath).toHaveBeenCalledTimes(1);
    expect(hoisted.loadImageAsBlob).not.toHaveBeenCalled();
    expect(hoisted.loadImageThumbnailAsBlob).toHaveBeenCalledTimes(1);
    expect(hoisted.loadImageWithDimensions).toHaveBeenCalledTimes(1);
  });

  it('bounds in-flight preview requests for different cover assets', async () => {
    const onUpdate = vi.fn();
    const setShowPicker = vi.fn();
    const pendingDimensions: Array<(value: { width: number; height: number }) => void> = [];
    hoisted.loadImageWithDimensions.mockImplementation(() => new Promise((resolve) => {
      pendingDimensions.push(resolve);
    }));

    const { result } = renderHook(() =>
      useCoverSelectionFlow({
        url: null,
        coverHeight: 240,
        notesRootPath: '/notes-root-a',
        onUpdate,
        setShowPicker,
      })
    );

    const previews: Array<Promise<void>> = [];
    await act(async () => {
      for (let index = 0; index < MAX_PENDING_COVER_PREVIEW_REQUESTS; index += 1) {
        previews.push(result.current.handlePreview(`covers/pending-${index}.png`));
      }
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(hoisted.loadImageThumbnailAsBlob).toHaveBeenCalledTimes(MAX_PENDING_COVER_PREVIEW_REQUESTS);
    });

    await act(async () => {
      await result.current.handlePreview('covers/overflow.png');
    });
    expect(hoisted.loadImageThumbnailAsBlob).toHaveBeenCalledTimes(MAX_PENDING_COVER_PREVIEW_REQUESTS);

    await act(async () => {
      pendingDimensions.forEach((resolve) => resolve({ width: 1200, height: 800 }));
      await Promise.all(previews);
    });
  });

  it('does not let a late preview overwrite a committed cover selection', async () => {
    const onUpdate = vi.fn();
    const setShowPicker = vi.fn();
    let resolvePreview: ((value: { width: number; height: number } | null) => void) | null = null;

    hoisted.resolveNotesRootAssetPath.mockResolvedValue('/notesRoot/assets/b.png');
    hoisted.loadImageAsBlob.mockResolvedValue('blob:cover-b');
    hoisted.loadImageWithDimensions.mockImplementation(() => new Promise((resolve) => {
      resolvePreview = resolve;
    }));

    const { result } = renderHook(() =>
      useCoverSelectionFlow({
        url: 'covers/a.png',
        coverHeight: 240,
        notesRootPath: '/notes-root-a',
        onUpdate,
        setShowPicker,
      })
    );

    await act(async () => {
      void result.current.handlePreview('covers/b.png');
    });

    act(() => {
      result.current.handleCoverSelect('covers/a.png');
    });

    await act(async () => {
      resolvePreview?.({ width: 1200, height: 800 });
    });

    expect(result.current.previewSrc).toBeNull();
    expect(onUpdate).toHaveBeenCalledWith('covers/a.png', 50, 50, 240, 1);
  });

  it('does not restore preview after picker close when a late request resolves', async () => {
    const onUpdate = vi.fn();
    const setShowPicker = vi.fn();
    let resolvePreview: ((value: { width: number; height: number } | null) => void) | null = null;

    hoisted.resolveNotesRootAssetPath.mockResolvedValue('/notesRoot/assets/b.png');
    hoisted.loadImageAsBlob.mockResolvedValue('blob:cover-b');
    hoisted.loadImageWithDimensions.mockImplementation(() => new Promise((resolve) => {
      resolvePreview = resolve;
    }));

    const { result } = renderHook(() =>
      useCoverSelectionFlow({
        url: 'covers/a.png',
        coverHeight: 240,
        notesRootPath: '/notes-root-a',
        onUpdate,
        setShowPicker,
      })
    );

    await act(async () => {
      void result.current.handlePreview('covers/b.png');
    });

    act(() => {
      result.current.handlePickerClose();
    });

    await act(async () => {
      resolvePreview?.({ width: 1200, height: 800 });
    });

    expect(result.current.previewSrc).toBeNull();
    expect(setShowPicker).toHaveBeenCalledWith(false);
  });

  it('does not let a preview from the previous note overwrite the current note', async () => {
    const onUpdate = vi.fn();
    const setShowPicker = vi.fn();
    const dimensionResolvers = new Map<
      string,
      (value: { width: number; height: number } | null) => void
    >();

    hoisted.resolveNotesRootAssetPath.mockImplementation(async (
      _notesRootPath: string,
      assetPath: string,
      currentNotePath?: string,
    ) => `/notesRoot/${currentNotePath}/${assetPath}`);
    hoisted.loadImageThumbnailAsBlob.mockImplementation(async (fullPath: string) => `thumb:${fullPath}`);
    hoisted.loadImageWithDimensions.mockImplementation((imageUrl: string) => new Promise((resolve) => {
      dimensionResolvers.set(imageUrl, resolve);
    }));

    const { result, rerender } = renderHook(
      ({ currentNotePath }) => useCoverSelectionFlow({
        url: null,
        notesRootPath: '/notes-root-a',
        currentNotePath,
        onUpdate,
        setShowPicker,
      }),
      { initialProps: { currentNotePath: 'daily/a.md' } },
    );

    let previousNotePreview: Promise<void> | undefined;
    act(() => {
      previousNotePreview = result.current.handlePreview('./assets/cover.png');
    });
    await waitFor(() => expect(dimensionResolvers.size).toBe(1));

    rerender({ currentNotePath: 'daily/b.md' });
    let currentNotePreview: Promise<void> | undefined;
    act(() => {
      currentNotePreview = result.current.handlePreview('./assets/cover.png');
    });
    await waitFor(() => expect(dimensionResolvers.size).toBe(2));

    const currentPreviewUrl = 'thumb:/notesRoot/daily/b.md/./assets/cover.png';
    await act(async () => {
      dimensionResolvers.get(currentPreviewUrl)?.({ width: 1200, height: 800 });
      await currentNotePreview;
    });
    expect(result.current.previewSrc).toBe(currentPreviewUrl);

    const previousPreviewUrl = 'thumb:/notesRoot/daily/a.md/./assets/cover.png';
    await act(async () => {
      dimensionResolvers.get(previousPreviewUrl)?.({ width: 1200, height: 800 });
      await previousNotePreview;
    });
    expect(result.current.previewSrc).toBe(currentPreviewUrl);
  });

  it('passes current note path to relative preview resolution', async () => {
    const onUpdate = vi.fn();
    const setShowPicker = vi.fn();

    hoisted.resolveNotesRootAssetPath.mockResolvedValue('/notesRoot/daily/assets/b.png');
    hoisted.loadImageThumbnailAsBlob.mockResolvedValue('thumb:relative-cover');

    const { result } = renderHook(() =>
      useCoverSelectionFlow({
        url: null,
        coverHeight: 240,
        notesRootPath: '/notes-root-a',
        currentNotePath: 'daily/2026-04-15.md',
        onUpdate,
        setShowPicker,
      })
    );

    await act(async () => {
      await result.current.handlePreview('./assets/b.png');
    });

    await waitFor(() => {
      expect(result.current.previewSrc).toBe('thumb:relative-cover');
    });
    expect(hoisted.resolveNotesRootAssetPath).toHaveBeenCalledWith(
      '/notes-root-a',
      './assets/b.png',
      'daily/2026-04-15.md'
    );
  });
});
