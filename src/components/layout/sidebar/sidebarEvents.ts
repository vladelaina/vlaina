export const SIDEBAR_OPEN_SEARCH_EVENT = 'vlaina-open-search';

export function dispatchSidebarOpenSearchEvent() {
  window.dispatchEvent(new Event(SIDEBAR_OPEN_SEARCH_EVENT));
}
