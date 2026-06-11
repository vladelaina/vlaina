import { useCallback, useState } from 'react';
import { useUIStore } from '@/stores/uiSlice';
import type { SidebarSearchScope } from './sidebarEvents';

export interface SidebarSearchState {
  isSearchOpen: boolean;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  openSearch: () => void;
  closeSearch: () => void;
  toggleSearch: () => void;
}

export function useSidebarSearchState(scope: SidebarSearchScope): SidebarSearchState {
  const isSearchOpen = useUIStore((state) =>
    scope === 'chat' ? state.chatSidebarSearchOpen : state.sidebarSearchOpen
  );
  const setSidebarSearchOpen = useUIStore((state) =>
    scope === 'chat' ? state.setChatSidebarSearchOpen : state.setSidebarSearchOpen
  );
  const toggleSidebarSearch = useUIStore((state) =>
    scope === 'chat' ? state.toggleChatSidebarSearch : state.toggleSidebarSearch
  );
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
