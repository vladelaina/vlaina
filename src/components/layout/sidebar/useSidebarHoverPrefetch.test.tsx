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
    const cancel = vi.fn();
    const { result } = renderHook(() =>
      useSidebarHoverPrefetch(prefetch, { delayMs: 50, cancel })
    );

    act(() => {
      result.current.onMouseEnter();
      result.current.onMouseLeave();
      vi.advanceTimersByTime(50);
    });

    expect(prefetch).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalledTimes(1);
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

  it('cancels an already scheduled or started prefetch when the pointer leaves', () => {
    vi.useFakeTimers();
    const prefetch = vi.fn();
    const cancel = vi.fn();
    const { result } = renderHook(() =>
      useSidebarHoverPrefetch(prefetch, { delayMs: 50, cancel })
    );

    act(() => {
      result.current.onMouseEnter();
      vi.advanceTimersByTime(50);
    });
    expect(prefetch).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.onMouseLeave();
    });

    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('cancels pending hover prefetch on unmount', () => {
    vi.useFakeTimers();
    const prefetch = vi.fn();
    const cancel = vi.fn();
    const { result, unmount } = renderHook(() =>
      useSidebarHoverPrefetch(prefetch, { delayMs: 50, cancel })
    );

    act(() => {
      result.current.onMouseEnter();
    });
    unmount();

    act(() => {
      vi.advanceTimersByTime(50);
    });

    expect(prefetch).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});
