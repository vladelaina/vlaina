import { useEffect } from 'react';
import {
  SIDEBAR_OPEN_SEARCH_EVENT,
  type SidebarSearchScope,
} from '@/components/layout/sidebar/sidebarEvents';

export function useSidebarSearchShortcut(
  onSearch: () => void,
  enabled: boolean,
  scope: SidebarSearchScope,
) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleOpenSearch = (event: Event) => {
      const eventScope = (event as CustomEvent<{ scope?: SidebarSearchScope }>).detail?.scope;
      if (eventScope !== scope) {
        return;
      }
      onSearch();
    };

    window.addEventListener(SIDEBAR_OPEN_SEARCH_EVENT, handleOpenSearch);
    return () => window.removeEventListener(SIDEBAR_OPEN_SEARCH_EVENT, handleOpenSearch);
  }, [enabled, onSearch, scope]);
}
