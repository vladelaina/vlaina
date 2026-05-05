import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCoverSelectionFlow } from './useCoverSelectionFlow';

const hoisted = vi.hoisted(() => ({
  loadImageAsBlob: vi.fn(),
  resolveVaultAssetPath: vi.fn(),
  isBuiltinCover: vi.fn(),
  getBuiltinCoverUrl: vi.fn(),
  loadImageWithDimensions: vi.fn(),
}));

vi.mock('@/lib/assets/io/reader', () => ({
  loadImageAsBlob: hoisted.loadImageAsBlob,
}));

vi.mock('@/lib/assets/core/paths', () => ({
  resolveVaultAssetPath: hoisted.resolveVaultAssetPath,
  resolveExistingVaultAssetPath: hoisted.resolveVaultAssetPath,
}));

vi.mock('@/lib/assets/builtinCovers', () => ({
  isBuiltinCover: hoisted.isBuiltinCover,
  getBuiltinCoverUrl: hoisted.getBuiltinCoverUrl,
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
    hoisted.resolveVaultAssetPath.mockReset();
    hoisted.isBuiltinCover.mockReset();
    hoisted.getBuiltinCoverUrl.mockReset();
    hoisted.loadImageWithDimensions.mockReset();

    hoisted.isBuiltinCover.mockImplementation((assetPath: string) => assetPath.startsWith('@'));
    hoisted.getBuiltinCoverUrl.mockImplementation((assetPath: string) => `/builtin/${assetPath}.webp`);
    hoisted.loadImageWithDimensions.mockResolvedValue({ width: 1200, height: 800 });
  });

  it('transitions phase from idle to previewing and committing', async () => {
    const onUpdate = vi.fn();
    const setShowPicker = vi.fn();

    const { result } = renderHook(() =>
      useCoverSelectionFlow({
        url: null,
        coverHeight: 240,
        vaultPath: '/vault-a',
        onUpdate,
        setShowPicker,
      })
    );

    expect(result.current.phase).toBe('idle');

    await act(async () => {
      await result.current.handlePreview('@monet/4');
    });

    await waitFor(() => {
      expect(result.current.phase).toBe('previewing');
    });
    expect(result.current.previewSrc).toBe('/builtin/@monet/4.webp');

    act(() => {
      result.current.handleCoverSelect('@monet/5');
    });

    expect(result.current.isSelectionCommitting).toBe(true);
    expect(result.current.previewSrc).toBeNull();
    expect(result.current.phase).toBe('idle');
    expect(onUpdate).toHaveBeenCalledWith('@monet/5', 50, 50, 240, 1);
    expect(setShowPicker).toHaveBeenCalledWith(false);
  });

  it('keeps the active preview visible while committing the previewed cover', async () => {
    const onUpdate = vi.fn();
    const setShowPicker = vi.fn();

    const { result } = renderHook(() =>
      useCoverSelectionFlow({
        url: '@monet/2',
        coverHeight: 240,
        vaultPath: '/vault-a',
        onUpdate,
        setShowPicker,
      })
    );

    await waitFor(() => {
      expect(result.current.resolvedSrc).toBe('/builtin/@monet/2.webp');
    });

    await act(async () => {
      await result.current.handlePreview('@monet/5');
    });

    await waitFor(() => {
      expect(result.current.previewSrc).toBe('/builtin/@monet/5.webp');
    });

    act(() => {
      result.current.handleCoverSelect('@monet/5');
    });

    expect(result.current.previewSrc).toBe('/builtin/@monet/5.webp');
    expect(result.current.isSelectionCommitting).toBe(true);
    expect(result.current.phase).toBe('committing');
    expect(onUpdate).toHaveBeenCalledWith('@monet/5', 50, 50, 240, 1);
  });

  it('selecting same cover clears preview and keeps non-committing state', async () => {
    const onUpdate = vi.fn();
    const setShowPicker = vi.fn();

    const { result } = renderHook(() =>
      useCoverSelectionFlow({
        url: '@monet/2',
        coverHeight: 320,
        vaultPath: '/vault-a',
        onUpdate,
        setShowPicker,
      })
    );

    await waitFor(() => {
      expect(result.current.resolvedSrc).toBe('/builtin/@monet/2.webp');
    });

    await act(async () => {
      await result.current.handlePreview('@monet/3');
    });

    await waitFor(() => {
      expect(result.current.previewSrc).toBe('/builtin/@monet/3.webp');
    });
    expect(result.current.phase).toBe('previewing');

    act(() => {
      result.current.handleCoverSelect('@monet/2');
    });

    await waitFor(() => {
      expect(result.current.previewSrc).toBeNull();
    });
    expect(result.current.isSelectionCommitting).toBe(false);
    expect(result.current.phase).toBe('ready');
    expect(onUpdate).toHaveBeenCalledWith('@monet/2', 50, 50, 320, 1);
    expect(setShowPicker).toHaveBeenCalledWith(false);
  });

  it('does not enter preview mode when hovering the currently selected cover', async () => {
    const onUpdate = vi.fn();
    const setShowPicker = vi.fn();

    const { result } = renderHook(() =>
      useCoverSelectionFlow({
        url: '@monet/2',
        coverHeight: 240,
        vaultPath: '/vault-a',
        onUpdate,
        setShowPicker,
      })
    );

    await waitFor(() => {
      expect(result.current.resolvedSrc).toBe('/builtin/@monet/2.webp');
    });

    await act(async () => {
      await result.current.handlePreview('@monet/2');
    });

    expect(result.current.previewSrc).toBeNull();
    expect(result.current.phase).toBe('ready');
  });

  it('reuses the same in-flight preview request for repeated preview of one asset', async () => {
    const onUpdate = vi.fn();
    const setShowPicker = vi.fn();

    hoisted.resolveVaultAssetPath.mockResolvedValue('/vault/assets/a.png');
    hoisted.loadImageAsBlob.mockResolvedValue('blob:cover-a');

    const { result } = renderHook(() =>
      useCoverSelectionFlow({
        url: null,
        coverHeight: 240,
        vaultPath: '/vault-a',
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
      expect(result.current.previewSrc).toBe('blob:cover-a');
    });

    expect(hoisted.resolveVaultAssetPath).toHaveBeenCalledTimes(1);
    expect(hoisted.loadImageAsBlob).toHaveBeenCalledTimes(1);
    expect(hoisted.loadImageWithDimensions).toHaveBeenCalledTimes(1);
  });

  it('does not let a late preview overwrite a committed cover selection', async () => {
    const onUpdate = vi.fn();
    const setShowPicker = vi.fn();
    let resolvePreview: ((value: { width: number; height: number } | null) => void) | null = null;

    hoisted.resolveVaultAssetPath.mockResolvedValue('/vault/assets/b.png');
    hoisted.loadImageAsBlob.mockResolvedValue('blob:cover-b');
    hoisted.loadImageWithDimensions.mockImplementation(() => new Promise((resolve) => {
      resolvePreview = resolve;
    }));

    const { result } = renderHook(() =>
      useCoverSelectionFlow({
        url: 'covers/a.png',
        coverHeight: 240,
        vaultPath: '/vault-a',
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

    hoisted.resolveVaultAssetPath.mockResolvedValue('/vault/assets/b.png');
    hoisted.loadImageAsBlob.mockResolvedValue('blob:cover-b');
    hoisted.loadImageWithDimensions.mockImplementation(() => new Promise((resolve) => {
      resolvePreview = resolve;
    }));

    const { result } = renderHook(() =>
      useCoverSelectionFlow({
        url: 'covers/a.png',
        coverHeight: 240,
        vaultPath: '/vault-a',
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

  it('passes current note path to relative preview resolution', async () => {
    const onUpdate = vi.fn();
    const setShowPicker = vi.fn();

    hoisted.resolveVaultAssetPath.mockResolvedValue('/vault/daily/assets/b.png');
    hoisted.loadImageAsBlob.mockResolvedValue('blob:relative-cover');

    const { result } = renderHook(() =>
      useCoverSelectionFlow({
        url: null,
        coverHeight: 240,
        vaultPath: '/vault-a',
        currentNotePath: 'daily/2026-04-15.md',
        onUpdate,
        setShowPicker,
      })
    );

    await act(async () => {
      await result.current.handlePreview('./assets/b.png');
    });

    await waitFor(() => {
      expect(result.current.previewSrc).toBe('blob:relative-cover');
    });
    expect(hoisted.resolveVaultAssetPath).toHaveBeenCalledWith(
      '/vault-a',
      './assets/b.png',
      'daily/2026-04-15.md'
    );
  });
});
