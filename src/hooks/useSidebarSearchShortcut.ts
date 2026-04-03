import { useEffect } from 'react';
import { SIDEBAR_OPEN_SEARCH_EVENT } from '@/components/layout/sidebar/sidebarEvents';

export function useSidebarSearchShortcut(onSearch: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleOpenSearch = () => {
      onSearch();
    };

    window.addEventListener(SIDEBAR_OPEN_SEARCH_EVENT, handleOpenSearch);
    return () => window.removeEventListener(SIDEBAR_OPEN_SEARCH_EVENT, handleOpenSearch);
  }, [enabled, onSearch]);
}
