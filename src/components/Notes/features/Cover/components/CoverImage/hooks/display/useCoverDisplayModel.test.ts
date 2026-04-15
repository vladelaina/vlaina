import type { MutableRefObject } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useCoverDisplayModel } from './useCoverDisplayModel';

function createPrevSrcRef(current: string | null): MutableRefObject<string | null> {
  return { current };
}

describe('useCoverDisplayModel', () => {
  it('uses centered preview display state while previewing', () => {
    const { result } = renderHook(() =>
      useCoverDisplayModel({
        phase: 'previewing',
        previewSrc: '/covers/preview.webp',
        resolvedSrc: '/covers/resolved.webp',
        prevSrcRef: createPrevSrcRef(null),
        crop: { x: 24, y: -16 },
        zoom: 2,
        positionX: 10,
        positionY: 90,
        isImageReady: false,
        setIsImageReady: vi.fn(),
      })
    );

    expect(result.current.mediaSrc).toBe('/covers/preview.webp');
    expect(result.current.displayPositionX).toBe(50);
    expect(result.current.displayPositionY).toBe(50);
    expect(result.current.syncPositionX).toBe(50);
    expect(result.current.syncPositionY).toBe(50);
    expect(result.current.syncZoom).toBe(1);
    expect(result.current.effectiveCrop).toEqual({ x: 0, y: 0 });
    expect(result.current.effectiveZoom).toBe(1);
    expect(result.current.suspendPositionSync).toBe(true);
  });

  it('marks source ready when current media source is reported loaded', async () => {
    const setIsImageReady = vi.fn();
    const { result, rerender } = renderHook(({ isImageReady }) =>
      useCoverDisplayModel({
        phase: 'ready',
        previewSrc: null,
        resolvedSrc: '/covers/resolved.webp',
        prevSrcRef: createPrevSrcRef(null),
        crop: { x: 2, y: 3 },
        zoom: 1.2,
        positionX: 40,
        positionY: 60,
        isImageReady,
        setIsImageReady,
      }),
      { initialProps: { isImageReady: false } }
    );

    expect(result.current.sourceIsReady).toBe(false);
    expect(result.current.suspendPositionSync).toBe(true);

    act(() => {
      result.current.handleSourceReady('/covers/resolved.webp');
    });

    rerender({ isImageReady: true });

    await waitFor(() => {
      expect(result.current.sourceIsReady).toBe(true);
    });
    expect(result.current.syncPositionX).toBe(40);
    expect(result.current.syncPositionY).toBe(60);
    expect(result.current.syncZoom).toBe(1.2);
    expect(result.current.placeholderSrc).toBe('/covers/resolved.webp');
    expect(result.current.suspendPositionSync).toBe(false);
    expect(setIsImageReady).toHaveBeenCalledWith(true);
  });

  it('keeps position sync suspended during selection commit', async () => {
    const { result, rerender } = renderHook(({ isImageReady }) =>
      useCoverDisplayModel({
        phase: 'committing',
        previewSrc: null,
        resolvedSrc: '/covers/resolved.webp',
        prevSrcRef: createPrevSrcRef(null),
        crop: { x: 0, y: 0 },
        zoom: 1,
        positionX: 50,
        positionY: 50,
        isImageReady,
        setIsImageReady: vi.fn(),
      }),
      { initialProps: { isImageReady: true } }
    );

    expect(result.current.displayPositionX).toBe(50);
    expect(result.current.displayPositionY).toBe(50);
    expect(result.current.effectiveCrop).toEqual({ x: 0, y: 0 });
    expect(result.current.effectiveZoom).toBe(1);
    expect(result.current.syncPositionX).toBe(50);
    expect(result.current.syncPositionY).toBe(50);
    expect(result.current.syncZoom).toBe(1);

    act(() => {
      result.current.handleSourceReady('/covers/resolved.webp');
    });

    rerender({ isImageReady: true });

    await waitFor(() => {
      expect(result.current.sourceIsReady).toBe(true);
    });
    expect(result.current.suspendPositionSync).toBe(true);
  });
});
