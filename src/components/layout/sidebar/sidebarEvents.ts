export const SIDEBAR_OPEN_SEARCH_EVENT = 'app-open-search';
export const SIDEBAR_CLOSE_SEARCH_EVENT = 'app-close-search';

export type SidebarSearchScope = 'notes' | 'chat';

export function dispatchSidebarOpenSearchEvent(scope: SidebarSearchScope) {
  window.dispatchEvent(new CustomEvent(SIDEBAR_OPEN_SEARCH_EVENT, {
    detail: { scope },
  }));
}

export function dispatchSidebarCloseSearchEvent(scope: SidebarSearchScope) {
  window.dispatchEvent(new CustomEvent(SIDEBAR_CLOSE_SEARCH_EVENT, {
    detail: { scope },
  }));
}
