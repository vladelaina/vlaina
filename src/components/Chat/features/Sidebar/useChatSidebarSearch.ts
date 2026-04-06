import { useMemo, type RefObject } from 'react';
import { useSidebarSearchDrawerState } from '@/components/layout/sidebar/SidebarSearchDrawer';
import { useSidebarSearchState } from '@/components/layout/sidebar/useSidebarSearchState';
import { useSidebarSearchShortcut } from '@/hooks/useSidebarSearchShortcut';
import type { ChatSession } from '@/lib/ai/types';
import {
  filterChatSidebarSessions,
  getVisibleChatSidebarSessions,
  sortChatSidebarSessions,
} from './chatSidebarSearch';

interface UseChatSidebarSearchOptions {
  enabled: boolean;
  scopeRef: RefObject<HTMLElement | null>;
  sessions: ChatSession[];
}

export function useChatSidebarSearch({
  enabled,
  scopeRef,
  sessions,
}: UseChatSidebarSearchOptions) {
  const {
    isSearchOpen,
    searchQuery,
    setSearchQuery,
    openSearch,
    closeSearch,
    toggleSearch,
  } = useSidebarSearchState();

  useSidebarSearchShortcut(toggleSearch, enabled);

  const drawer = useSidebarSearchDrawerState({
    isOpen: isSearchOpen,
    query: searchQuery,
    onOpen: openSearch,
    onClose: closeSearch,
    scopeRef,
  });

  const visibleSessions = useMemo(
    () => getVisibleChatSidebarSessions(sessions),
    [sessions],
  );

  const sortedSessions = useMemo(
    () => sortChatSidebarSessions(visibleSessions),
    [visibleSessions],
  );

  const filteredSessions = useMemo(
    () => filterChatSidebarSessions(sortedSessions, searchQuery),
    [searchQuery, sortedSessions],
  );

  return {
    isSearchOpen,
    searchQuery,
    setSearchQuery,
    openSearch,
    closeSearch,
    toggleSearch,
    ...drawer,
    filteredSessions,
    hasSessions: visibleSessions.length > 0,
    sessionsToRender: drawer.shouldShowSearchResults ? filteredSessions : sortedSessions,
  };
}
