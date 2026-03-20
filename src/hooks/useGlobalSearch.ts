import { useEffect } from 'react';

export function useGlobalSearch(onSearch: () => void) {
  useEffect(() => {
    const handleOpenSearch = () => {
      onSearch();
    };

    window.addEventListener('neko-open-search', handleOpenSearch);
    return () => window.removeEventListener('neko-open-search', handleOpenSearch);
  }, [onSearch]);
}
