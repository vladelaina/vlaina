import { useEffect } from 'react';

export function useGlobalSearch(onSearch: () => void) {
  useEffect(() => {
    const handleOpenSearch = () => {
      onSearch();
    };

    window.addEventListener('vlaina-open-search', handleOpenSearch);
    return () => window.removeEventListener('vlaina-open-search', handleOpenSearch);
  }, [onSearch]);
}
