import { isTemporarySession } from '@/lib/ai/temporaryChat';
import type { ChatSession } from '@/lib/ai/types';

export interface ChatSidebarSearchEntry {
  session: ChatSession;
  searchText: string;
}

const MAX_CHAT_SIDEBAR_SEARCH_QUERY_CHARS = 256;
const MAX_CHAT_SIDEBAR_SEARCH_FIELD_CHARS = 4096;

function getChatSidebarSearchQuery(query: string): string {
  return query.trim().slice(0, MAX_CHAT_SIDEBAR_SEARCH_QUERY_CHARS).toLowerCase();
}

function getChatSidebarSearchField(value: string | undefined): string {
  return (value || 'New').slice(0, MAX_CHAT_SIDEBAR_SEARCH_FIELD_CHARS).toLowerCase();
}

export function getVisibleChatSidebarSessions(sessions: ChatSession[]) {
  return sessions.filter((session) => !isTemporarySession(session));
}

export function sortChatSidebarSessions(sessions: ChatSession[]) {
  return [...sessions].sort((a, b) => {
    const pinDiff = Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned));
    if (pinDiff !== 0) {
      return pinDiff;
    }

    return b.updatedAt - a.updatedAt;
  });
}

export function getNavigableChatSidebarSessions(sessions: ChatSession[]) {
  return sortChatSidebarSessions(getVisibleChatSidebarSessions(sessions));
}

export function buildChatSidebarSearchEntries(sessions: ChatSession[]): ChatSidebarSearchEntry[] {
  return sessions.map((session) => ({
    session,
    searchText: getChatSidebarSearchField(session.title),
  }));
}

export function queryChatSidebarSessions(entries: ChatSidebarSearchEntry[], query: string) {
  const trimmedQuery = getChatSidebarSearchQuery(query);
  if (!trimmedQuery) {
    return [];
  }

  return entries
    .filter((entry) => entry.searchText.includes(trimmedQuery))
    .map((entry) => entry.session);
}

export function filterChatSidebarSessions(
  sessions: ChatSession[],
  query: string,
) {
  return queryChatSidebarSessions(buildChatSidebarSearchEntries(sessions), query);
}
