import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { dispatchSidebarOpenSearchEvent } from '@/components/layout/sidebar/sidebarEvents';
import { useGlobalSearch } from './useGlobalSearch';

describe('useGlobalSearch', () => {
  it('subscribes only when enabled', () => {
    const onSearch = vi.fn();

    const { rerender } = renderHook(
      ({ enabled }) => useGlobalSearch(onSearch, enabled),
      {
        initialProps: { enabled: false },
      },
    );

    act(() => {
      dispatchSidebarOpenSearchEvent();
    });
    expect(onSearch).not.toHaveBeenCalled();

    rerender({ enabled: true });

    act(() => {
      dispatchSidebarOpenSearchEvent();
    });
    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  it('removes the previous listener when the callback changes', () => {
    const first = vi.fn();
    const second = vi.fn();

    const { rerender } = renderHook(
      ({ handler }) => useGlobalSearch(handler, true),
      {
        initialProps: { handler: first },
      },
    );

    rerender({ handler: second });

    act(() => {
      dispatchSidebarOpenSearchEvent();
    });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('works with enabled state toggled inside a component', () => {
    const onSearch = vi.fn();

    const { result } = renderHook(() => {
      const [enabled, setEnabled] = useState(false);
      useGlobalSearch(onSearch, enabled);
      return setEnabled;
    });

    act(() => {
      dispatchSidebarOpenSearchEvent();
    });
    expect(onSearch).not.toHaveBeenCalled();

    act(() => {
      result.current(true);
    });

    act(() => {
      dispatchSidebarOpenSearchEvent();
    });
    expect(onSearch).toHaveBeenCalledTimes(1);
  });
});
