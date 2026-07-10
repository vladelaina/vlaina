import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useCoverInteractionPersistence } from './useCoverInteractionPersistence';

describe('useCoverInteractionPersistence', () => {
  it('keeps automatic height unset while saving crop and zoom', () => {
    const onUpdate = vi.fn();
    const { result } = renderHook(() => useCoverInteractionPersistence({
      mediaSize: { width: 1200, height: 800 },
      effectiveContainerSize: { width: 900, height: 240 },
      url: 'covers/automatic.png',
      storedCoverHeight: undefined,
      onUpdate,
    }));

    act(() => result.current.saveToDb({ x: 20, y: -10 }, 1.25));

    expect(onUpdate).toHaveBeenCalledWith(
      'covers/automatic.png',
      expect.any(Number),
      expect.any(Number),
      undefined,
      1.25,
    );
  });

  it('preserves an explicitly stored height while saving crop and zoom', () => {
    const onUpdate = vi.fn();
    const { result } = renderHook(() => useCoverInteractionPersistence({
      mediaSize: { width: 1200, height: 800 },
      effectiveContainerSize: { width: 900, height: 240 },
      url: 'covers/fixed.png',
      storedCoverHeight: 320,
      onUpdate,
    }));

    act(() => result.current.saveToDb({ x: 20, y: -10 }, 1.25));

    expect(onUpdate).toHaveBeenCalledWith(
      'covers/fixed.png',
      expect.any(Number),
      expect.any(Number),
      320,
      1.25,
    );
  });
});
