export const SIDEBAR_OPEN_SEARCH_EVENT = 'app-open-search';

export type SidebarSearchScope = 'notes' | 'chat';

export function dispatchSidebarOpenSearchEvent(scope?: SidebarSearchScope) {
  window.dispatchEvent(new CustomEvent(SIDEBAR_OPEN_SEARCH_EVENT, {
    detail: scope ? { scope } : undefined,
  }));
}
