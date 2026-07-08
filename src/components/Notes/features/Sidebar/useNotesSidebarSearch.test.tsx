import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  SIDEBAR_OPEN_SEARCH_EVENT,
  dispatchSidebarOpenSearchEvent,
} from '@/components/layout/sidebar/sidebarEvents';
import { useUIStore } from '@/stores/uiSlice';
import { useNotesSidebarSearch } from './useNotesSidebarSearch';

describe('useNotesSidebarSearch', () => {
  beforeEach(() => {
    useUIStore.setState({
      appViewMode: 'notes',
      notesSidebarView: 'workspace',
      sidebarSearchOpen: false,
      chatSidebarSearchOpen: false,
    });
  });

  it('switches outline back to workspace and keeps search open', () => {
    useUIStore.getState().setNotesSidebarView('outline');

    const { result } = renderHook(() => useNotesSidebarSearch(true));

    act(() => {
      dispatchSidebarOpenSearchEvent('notes');
    });

    expect(useUIStore.getState().notesSidebarView).toBe('workspace');
    expect(result.current.isSearchOpen).toBe(true);
  });

  it('ignores chat-scoped search events', () => {
    const { result } = renderHook(() => useNotesSidebarSearch(true));

    act(() => {
      dispatchSidebarOpenSearchEvent('chat');
    });

    expect(result.current.isSearchOpen).toBe(false);
  });

  it('ignores unscoped search events', () => {
    const { result } = renderHook(() => useNotesSidebarSearch(true));

    act(() => {
      window.dispatchEvent(new CustomEvent(SIDEBAR_OPEN_SEARCH_EVENT));
    });

    expect(result.current.isSearchOpen).toBe(false);
  });

  it('does not mirror chat sidebar search state', () => {
    useUIStore.getState().setChatSidebarSearchOpen(true);

    const { result } = renderHook(() => useNotesSidebarSearch(true));

    expect(result.current.isSearchOpen).toBe(false);
    expect(useUIStore.getState().chatSidebarSearchOpen).toBe(true);
  });

  it('closes search when leaving the workspace view', () => {
    const { result } = renderHook(() => useNotesSidebarSearch(true));

    act(() => {
      result.current.openSearch();
      result.current.setSearchQuery('note');
    });

    expect(result.current.isSearchOpen).toBe(true);

    act(() => {
      useUIStore.getState().setNotesSidebarView('outline');
    });

    expect(result.current.isSearchOpen).toBe(false);
    expect(result.current.searchQuery).toBe('');
  });

  it('closes notes search when notes search is disabled by app view', () => {
    const { result, rerender } = renderHook(
      ({ enabled }) => useNotesSidebarSearch(enabled),
      { initialProps: { enabled: true } },
    );

    act(() => {
      result.current.openSearch();
    });

    expect(result.current.isSearchOpen).toBe(true);

    rerender({ enabled: false });

    expect(useUIStore.getState().sidebarSearchOpen).toBe(false);
  });
});
