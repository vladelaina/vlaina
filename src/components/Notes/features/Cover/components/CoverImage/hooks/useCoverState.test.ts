import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useCoverState } from './useCoverState';

describe('useCoverState', () => {
  it('does not reset local zoom when scale prop stays unchanged', () => {
    const { result, rerender } = renderHook(({ scale }) => useCoverState({ scale }), {
      initialProps: { scale: 1 },
    });

    act(() => {
      result.current.setZoom(1.08);
    });
    expect(result.current.zoom).toBeCloseTo(1.08, 6);

    rerender({ scale: 1 });
    expect(result.current.zoom).toBeCloseTo(1.08, 6);
  });

  it('syncs zoom when external scale prop changes', () => {
    const { result, rerender } = renderHook(({ scale }) => useCoverState({ scale }), {
      initialProps: { scale: 1 },
    });

    act(() => {
      result.current.setZoom(1.08);
    });
    expect(result.current.zoom).toBeCloseTo(1.08, 6);

    rerender({ scale: 1.25 });
    expect(result.current.zoom).toBeCloseTo(1.25, 6);
  });
});
