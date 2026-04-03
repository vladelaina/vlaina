import { useCallback, useState } from 'react';

export interface SidebarSearchState {
  isSearchOpen: boolean;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  openSearch: () => void;
  closeSearch: () => void;
  toggleSearch: () => void;
}

export function useSidebarSearchState(): SidebarSearchState {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const updateSearchQuery = useCallback((value: string) => {
    setSearchQuery(value);
  }, []);

  const openSearch = useCallback(() => {
    setIsSearchOpen(true);
  }, []);

  const closeSearch = useCallback(() => {
    setIsSearchOpen(false);
    setSearchQuery('');
  }, []);

  const toggleSearch = useCallback(() => {
    setIsSearchOpen((previous) => {
      const next = !previous;
      if (!next) {
        setSearchQuery('');
      }
      return next;
    });
  }, []);

  return {
    isSearchOpen,
    searchQuery,
    setSearchQuery: updateSearchQuery,
    openSearch,
    closeSearch,
    toggleSearch,
  };
}
