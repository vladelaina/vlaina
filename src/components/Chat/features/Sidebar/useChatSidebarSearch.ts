import { useDeferredValue, useEffect, useMemo, useRef, type RefObject } from 'react';
import { useSidebarSearchDrawerState } from '@/components/layout/sidebar/SidebarSearchDrawer';
import { useSidebarSearchState } from '@/components/layout/sidebar/useSidebarSearchState';
import { useSidebarSearchShortcut } from '@/hooks/useSidebarSearchShortcut';
import type { ChatSession } from '@/lib/ai/types';
import {
  buildChatSidebarSearchEntries,
  getVisibleChatSidebarSessions,
  queryChatSidebarSessions,
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
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const previousQueryRef = useRef('');

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

  const searchEntries = useMemo(
    () => buildChatSidebarSearchEntries(sortedSessions),
    [sortedSessions],
  );

  const filteredSessions = useMemo(
    () => queryChatSidebarSessions(searchEntries, deferredSearchQuery),
    [deferredSearchQuery, searchEntries],
  );

  useEffect(() => {
    const trimmedQuery = deferredSearchQuery.trim();
    if (trimmedQuery === previousQueryRef.current) {
      return;
    }

    previousQueryRef.current = trimmedQuery;
    drawer.scrollRootRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [deferredSearchQuery, drawer.scrollRootRef]);

  return {
    isSearchOpen,
    searchQuery,
    deferredSearchQuery,
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
