import { useRef } from 'react';
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useCoverPositionSync } from './useCoverPositionSync';

describe('useCoverPositionSync', () => {
  it('keeps the current crop object when synced pixels are unchanged', () => {
    const setCrop = vi.fn();

    function useHarness() {
      const ignoreCropSyncRef = useRef(false);
      useCoverPositionSync({
        positionX: 25,
        positionY: 75,
        mediaSize: { width: 1000, height: 500 },
        effectiveContainerSize: { width: 400, height: 200 },
        zoom: 2,
        isInteracting: false,
        isResizing: false,
        ignoreCropSyncRef,
        setCrop,
      });
    }

    renderHook(() => useHarness());

    expect(setCrop).toHaveBeenCalledWith(expect.any(Function));
    const updateCrop = setCrop.mock.calls[0]?.[0] as (crop: { x: number; y: number }) => { x: number; y: number };
    const unchangedCrop = { x: 100, y: -50 };

    expect(updateCrop(unchangedCrop)).toBe(unchangedCrop);
    expect(updateCrop({ x: 0, y: 0 })).toEqual({ x: 100, y: -50 });
  });
});
