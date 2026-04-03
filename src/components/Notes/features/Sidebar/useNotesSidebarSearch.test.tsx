import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { dispatchSidebarOpenSearchEvent } from '@/components/layout/sidebar/sidebarEvents';
import { useUIStore } from '@/stores/uiSlice';
import { useNotesSidebarSearch } from './useNotesSidebarSearch';

describe('useNotesSidebarSearch', () => {
  beforeEach(() => {
    useUIStore.setState({
      appViewMode: 'notes',
      notesSidebarView: 'workspace',
    });
  });

  it('switches outline back to workspace and keeps search open', () => {
    useUIStore.getState().setNotesSidebarView('outline');

    const { result } = renderHook(() => useNotesSidebarSearch(true));

    act(() => {
      dispatchSidebarOpenSearchEvent();
    });

    expect(useUIStore.getState().notesSidebarView).toBe('workspace');
    expect(result.current.isSearchOpen).toBe(true);
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
});
