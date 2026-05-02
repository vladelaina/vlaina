import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSidebarHoverPrefetch } from './useSidebarHoverPrefetch';

describe('useSidebarHoverPrefetch', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('cancels prefetch when the pointer leaves before the delay', () => {
    vi.useFakeTimers();
    const prefetch = vi.fn();
    const { result } = renderHook(() => useSidebarHoverPrefetch(prefetch, { delayMs: 50 }));

    act(() => {
      result.current.onMouseEnter();
      result.current.onMouseLeave();
      vi.advanceTimersByTime(50);
    });

    expect(prefetch).not.toHaveBeenCalled();
  });

  it('runs prefetch after the hover delay', () => {
    vi.useFakeTimers();
    const prefetch = vi.fn();
    const { result } = renderHook(() => useSidebarHoverPrefetch(prefetch, { delayMs: 50 }));

    act(() => {
      result.current.onMouseEnter();
      vi.advanceTimersByTime(49);
    });
    expect(prefetch).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(prefetch).toHaveBeenCalledTimes(1);
  });
});
