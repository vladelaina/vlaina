import { isTemporarySession } from '@/lib/ai/temporaryChat';
import type { ChatSession } from '@/lib/ai/types';

export interface ChatSidebarSearchEntry {
  session: ChatSession;
  searchText: string;
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

export function buildChatSidebarSearchEntries(sessions: ChatSession[]): ChatSidebarSearchEntry[] {
  return sessions.map((session) => ({
    session,
    searchText: (session.title || 'New Chat').toLowerCase(),
  }));
}

export function queryChatSidebarSessions(entries: ChatSidebarSearchEntry[], query: string) {
  const trimmedQuery = query.trim().toLowerCase();
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
