import { useEffect } from 'react';

/**
 * Hook to listen for the global search event ('neko-open-search').
 * This event can be triggered by the global sidebar search button or the Ctrl+K shortcut.
 * 
 * @param onSearch Callback function to execute when search is triggered.
 */
export function useGlobalSearch(onSearch: () => void) {
  useEffect(() => {
    const handleOpenSearch = () => {
      onSearch();
    };

    window.addEventListener('neko-open-search', handleOpenSearch);
    return () => window.removeEventListener('neko-open-search', handleOpenSearch);
  }, [onSearch]);
}
