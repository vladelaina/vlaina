import { isTemporarySession } from '@/lib/ai/temporaryChat';
import type { ChatSession } from '@/lib/ai/types';

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

export function filterChatSidebarSessions(
  sessions: ChatSession[],
  query: string,
) {
  const trimmedQuery = query.trim().toLowerCase();
  if (!trimmedQuery) {
    return [];
  }

  return sessions.filter((session) =>
    (session.title || 'New Chat').toLowerCase().includes(trimmedQuery),
  );
}
