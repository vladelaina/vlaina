import { useCallback, useEffect } from 'react';
import {
  useSidebarSearchState,
  type SidebarSearchState,
} from '@/components/layout/sidebar/useSidebarSearchState';
import { useSidebarSearchShortcut } from '@/hooks/useSidebarSearchShortcut';
import { useUIStore } from '@/stores/uiSlice';

export function useNotesSidebarSearch(enabled: boolean): SidebarSearchState {
  const sidebarView = useUIStore((state) => state.notesSidebarView);
  const setSidebarView = useUIStore((state) => state.setNotesSidebarView);
  const {
    isSearchOpen,
    searchQuery,
    setSearchQuery,
    openSearch,
    closeSearch,
  } = useSidebarSearchState('notes');

  const toggleSearch = useCallback(() => {
    if (isSearchOpen) {
      closeSearch();
      return;
    }

    setSidebarView('workspace');
    openSearch();
  }, [closeSearch, isSearchOpen, openSearch, setSidebarView]);

  useSidebarSearchShortcut(toggleSearch, enabled, 'notes');

  useEffect(() => {
    if (enabled && sidebarView !== 'workspace') {
      closeSearch();
    }
  }, [closeSearch, enabled, sidebarView]);

  return {
    isSearchOpen,
    searchQuery,
    setSearchQuery,
    openSearch,
    closeSearch,
    toggleSearch,
  };
}
