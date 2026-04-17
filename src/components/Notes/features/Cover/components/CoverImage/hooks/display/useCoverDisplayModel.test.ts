import type { MutableRefObject } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useCoverDisplayModel } from './useCoverDisplayModel';
import type { CoverFlowPhase } from '../../coverFlowPhase';

const hoisted = vi.hoisted(() => ({
  getCachedDimensions: vi.fn(),
}));

vi.mock('../../../../utils/coverDimensionCache', () => ({
  getCachedDimensions: hoisted.getCachedDimensions,
}));

function createPrevSrcRef(current: string | null): MutableRefObject<string | null> {
  return { current };
}

interface DisplayModelProps {
  phase: CoverFlowPhase;
  resolvedSrc: string | null;
  prevSrc: string | null;
  isSourceStale: boolean;
  crop: { x: number; y: number };
  zoom: number;
  positionX: number;
  positionY: number;
  isImageReady: boolean;
}

interface PreviewStateProps {
  previewSrc: string | null;
  isImageReady: boolean;
}

describe('useCoverDisplayModel', () => {
  it('promotes a preloaded preview source without waiting for cropper load', async () => {
    hoisted.getCachedDimensions.mockReturnValue({ width: 2880, height: 1608 });
    const setIsImageReady = vi.fn();

    const { result, rerender } = renderHook(({ isImageReady }) =>
      useCoverDisplayModel({
        phase: 'previewing',
        previewSrc: '/covers/preview.webp',
        resolvedSrc: '/covers/resolved.webp',
        isSourceStale: false,
        prevSrcRef: createPrevSrcRef('/covers/resolved.webp'),
        crop: { x: 24, y: -16 },
        zoom: 2,
        positionX: 10,
        positionY: 90,
        isImageReady,
        setIsImageReady,
      }),
      { initialProps: { isImageReady: false } }
    );

    expect(result.current.sourceIsReady).toBe(true);
    expect(result.current.placeholderSrc).toBe('/covers/preview.webp');

    await waitFor(() => {
      expect(setIsImageReady).toHaveBeenCalledWith(true);
    });

    rerender({ isImageReady: true });

    await waitFor(() => {
      expect(result.current.sourceIsReady).toBe(true);
    });
    expect(result.current.mediaSrc).toBe('/covers/preview.webp');
    expect(result.current.placeholderSrc).toBe('/covers/preview.webp');
  });

  it('uses centered preview display state while previewing', () => {
    hoisted.getCachedDimensions.mockReturnValue({ width: 2880, height: 1608 });
    const { result } = renderHook(() =>
      useCoverDisplayModel({
        phase: 'previewing',
        previewSrc: '/covers/preview.webp',
        resolvedSrc: '/covers/resolved.webp',
        isSourceStale: false,
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
    hoisted.getCachedDimensions.mockReturnValue(null);
    const setIsImageReady = vi.fn();
    const { result, rerender } = renderHook(({ isImageReady }) =>
      useCoverDisplayModel({
        phase: 'ready',
        previewSrc: null,
        resolvedSrc: '/covers/resolved.webp',
        isSourceStale: false,
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
    hoisted.getCachedDimensions.mockReturnValue(null);
    const { result, rerender } = renderHook(({ isImageReady }) =>
      useCoverDisplayModel({
        phase: 'committing',
        previewSrc: null,
        resolvedSrc: '/covers/resolved.webp',
        isSourceStale: false,
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

  it('keeps a cached preview ready while committing a selected cover', () => {
    hoisted.getCachedDimensions.mockReturnValue({ width: 1600, height: 1213 });
    const setIsImageReady = vi.fn();
    const { result } = renderHook(() =>
      useCoverDisplayModel({
        phase: 'committing',
        previewSrc: '/covers/preview.webp',
        resolvedSrc: '/covers/resolved.webp',
        isSourceStale: true,
        prevSrcRef: createPrevSrcRef('/covers/resolved.webp'),
        crop: { x: 0, y: 0 },
        zoom: 1,
        positionX: 50,
        positionY: 50,
        isImageReady: false,
        setIsImageReady,
      })
    );

    expect(result.current.mediaSrc).toBe('/covers/preview.webp');
    expect(result.current.placeholderSrc).toBe('/covers/preview.webp');
    expect(result.current.sourceIsReady).toBe(true);
    expect(result.current.suspendPositionSync).toBe(true);
    expect(setIsImageReady).toHaveBeenCalledWith(true);
  });

  it('keeps the resolved cover ready when clearing a cached preview', () => {
    hoisted.getCachedDimensions.mockImplementation((src: string) => {
      if (src === '/covers/preview.webp') {
        return { width: 1600, height: 1213 };
      }
      if (src === '/covers/resolved.webp') {
        return { width: 1500, height: 969 };
      }
      return null;
    });

    const initialProps: PreviewStateProps = {
      previewSrc: '/covers/preview.webp',
      isImageReady: true,
    };

    const { result, rerender } = renderHook(
      ({ previewSrc, isImageReady }: PreviewStateProps) =>
        useCoverDisplayModel({
          phase: previewSrc ? 'previewing' : 'ready',
          previewSrc,
          resolvedSrc: '/covers/resolved.webp',
          isSourceStale: false,
          prevSrcRef: createPrevSrcRef('/covers/resolved.webp'),
          crop: { x: 0, y: 0 },
          zoom: 1,
          positionX: 50,
          positionY: 50,
          isImageReady,
          setIsImageReady: vi.fn(),
        }),
      {
        initialProps,
      }
    );

    expect(result.current.mediaSrc).toBe('/covers/preview.webp');
    expect(result.current.sourceIsReady).toBe(true);

    rerender({
      previewSrc: null,
      isImageReady: false,
    });

    expect(result.current.mediaSrc).toBe('/covers/resolved.webp');
    expect(result.current.placeholderSrc).toBe('/covers/resolved.webp');
    expect(result.current.sourceIsReady).toBe(true);
    expect(result.current.suspendPositionSync).toBe(false);
  });

  it('holds the previous stable geometry while a new source is not ready yet', async () => {
    hoisted.getCachedDimensions.mockReturnValue(null);
    const initialProps: DisplayModelProps = {
      phase: 'ready',
      resolvedSrc: '/covers/current.webp',
      prevSrc: null,
      isSourceStale: false,
      crop: { x: 18, y: -12 },
      zoom: 1.8,
      positionX: 22,
      positionY: 76,
      isImageReady: false,
    };

    const { result, rerender } = renderHook(
      ({
        phase,
        resolvedSrc,
        prevSrc,
        isSourceStale,
        crop,
        zoom,
        positionX,
        positionY,
        isImageReady,
      }: DisplayModelProps) =>
        useCoverDisplayModel({
          phase,
          previewSrc: null,
          resolvedSrc,
          isSourceStale,
          prevSrcRef: createPrevSrcRef(prevSrc),
          crop,
          zoom,
          positionX,
          positionY,
          isImageReady,
          setIsImageReady: vi.fn(),
        }),
      {
        initialProps,
      }
    );

    act(() => {
      result.current.handleSourceReady('/covers/current.webp');
    });

    rerender({
      ...initialProps,
      isImageReady: true,
    });

    await waitFor(() => {
      expect(result.current.sourceIsReady).toBe(true);
    });

    const committingProps: DisplayModelProps = {
      phase: 'ready',
      resolvedSrc: null,
      prevSrc: '/covers/current.webp',
      isSourceStale: true,
      crop: { x: 0, y: 0 },
      zoom: 1,
      positionX: 50,
      positionY: 50,
      isImageReady: false,
    };

    rerender(committingProps);

    expect(result.current.mediaSrc).toBe('/covers/current.webp');
    expect(result.current.placeholderSrc).toBe('/covers/current.webp');
    expect(result.current.displayPositionX).toBe(22);
    expect(result.current.displayPositionY).toBe(76);
    expect(result.current.effectiveCrop).toEqual({ x: 18, y: -12 });
    expect(result.current.effectiveZoom).toBe(1.8);
    expect(result.current.syncPositionX).toBe(50);
    expect(result.current.syncPositionY).toBe(50);
    expect(result.current.syncZoom).toBe(1);
  });
});
