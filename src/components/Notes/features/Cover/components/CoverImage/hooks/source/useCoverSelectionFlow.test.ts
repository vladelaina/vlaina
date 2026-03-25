import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCoverSelectionFlow } from './useCoverSelectionFlow';

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
    hoisted.resolveSystemAssetPath.mockReset();
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

    expect(result.current.phase).toBe('committing');
    expect(result.current.isSelectionCommitting).toBe(true);
    expect(onUpdate).toHaveBeenCalledWith('@monet/5', 50, 50, 240, 1);
    expect(setShowPicker).toHaveBeenCalledWith(false);
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

  it('reuses the same in-flight preview request for repeated preview of one asset', async () => {
    const onUpdate = vi.fn();
    const setShowPicker = vi.fn();

    hoisted.resolveSystemAssetPath.mockResolvedValue('/vault/.vlaina/assets/covers/a.png');
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

    expect(hoisted.resolveSystemAssetPath).toHaveBeenCalledTimes(1);
    expect(hoisted.loadImageAsBlob).toHaveBeenCalledTimes(1);
    expect(hoisted.loadImageWithDimensions).toHaveBeenCalledTimes(1);
  });
});
