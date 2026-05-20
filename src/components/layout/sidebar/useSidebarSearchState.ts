import { useCallback, useState } from 'react';
import { useUIStore } from '@/stores/uiSlice';

export interface SidebarSearchState {
  isSearchOpen: boolean;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  openSearch: () => void;
  closeSearch: () => void;
  toggleSearch: () => void;
}

export function useSidebarSearchState(): SidebarSearchState {
  const isSearchOpen = useUIStore((state) => state.sidebarSearchOpen);
  const setSidebarSearchOpen = useUIStore((state) => state.setSidebarSearchOpen);
  const toggleSidebarSearch = useUIStore((state) => state.toggleSidebarSearch);
  const [searchQuery, setSearchQuery] = useState('');

  const updateSearchQuery = useCallback((value: string) => {
    setSearchQuery(value);
  }, []);

  const openSearch = useCallback(() => {
    setSidebarSearchOpen(true);
  }, [setSidebarSearchOpen]);

  const closeSearch = useCallback(() => {
    setSidebarSearchOpen(false);
    setSearchQuery('');
  }, [setSidebarSearchOpen]);

  const toggleSearch = useCallback(() => {
    if (isSearchOpen) {
      setSearchQuery('');
    }
    toggleSidebarSearch();
  }, [isSearchOpen, toggleSidebarSearch]);

  return {
    isSearchOpen,
    searchQuery,
    setSearchQuery: updateSearchQuery,
    openSearch,
    closeSearch,
    toggleSearch,
  };
}
