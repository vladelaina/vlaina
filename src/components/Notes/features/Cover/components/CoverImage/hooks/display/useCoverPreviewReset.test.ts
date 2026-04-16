import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useCoverPreviewReset } from './useCoverPreviewReset';

const hoisted = vi.hoisted(() => ({
  getCachedDimensions: vi.fn(),
}));

vi.mock('../../../../utils/coverDimensionCache', () => ({
  getCachedDimensions: hoisted.getCachedDimensions,
}));

describe('useCoverPreviewReset', () => {
  it('does nothing when preview source is empty', () => {
    const setCrop = vi.fn();
    const setZoom = vi.fn();
    const setIsImageReady = vi.fn();

    renderHook(() =>
      useCoverPreviewReset({
        previewSrc: null,
        setCrop,
        setZoom,
        setIsImageReady,
      })
    );

    expect(setCrop).not.toHaveBeenCalled();
    expect(setZoom).not.toHaveBeenCalled();
    expect(setIsImageReady).not.toHaveBeenCalled();
  });

  it('resets crop/zoom/ready when preview starts', () => {
    hoisted.getCachedDimensions.mockReturnValue(null);
    const setCrop = vi.fn();
    const setZoom = vi.fn();
    const setIsImageReady = vi.fn();

    renderHook(() =>
      useCoverPreviewReset({
        previewSrc: '/covers/preview.webp',
        setCrop,
        setZoom,
        setIsImageReady,
      })
    );

    expect(setCrop).toHaveBeenCalledWith({ x: 0, y: 0 });
    expect(setZoom).toHaveBeenCalledWith(1);
    expect(setIsImageReady).toHaveBeenCalledWith(false);
  });

  it('keeps ready state when preview is already cached', () => {
    hoisted.getCachedDimensions.mockReturnValue({ width: 1600, height: 1213 });
    const setCrop = vi.fn();
    const setZoom = vi.fn();
    const setIsImageReady = vi.fn();

    renderHook(() =>
      useCoverPreviewReset({
        previewSrc: '/covers/preview.webp',
        setCrop,
        setZoom,
        setIsImageReady,
      })
    );

    expect(setCrop).toHaveBeenCalledWith({ x: 0, y: 0 });
    expect(setZoom).toHaveBeenCalledWith(1);
    expect(setIsImageReady).not.toHaveBeenCalled();
  });
});
