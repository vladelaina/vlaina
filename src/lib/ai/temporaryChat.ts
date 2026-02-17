import type { ChatMessage, ChatSession } from '@/lib/ai/types';

export const TEMP_SESSION_PREFIX = 'temp-session-';

export function isTemporarySessionId(sessionId: string | null | undefined): boolean {
  return !!sessionId && sessionId.startsWith(TEMP_SESSION_PREFIX);
}

export function isTemporarySession(session: ChatSession | null | undefined): boolean {
  return !!session && (session.isTemporary === true || isTemporarySessionId(session.id));
}

export function createTemporarySession(modelId: string): ChatSession {
  const now = Date.now();
  return {
    id: `${TEMP_SESSION_PREFIX}${now}-${Math.random().toString(36).substring(2, 11)}`,
    title: 'Temporary Chat',
    modelId,
    isTemporary: true,
    createdAt: now,
    updatedAt: now
  };
}

export function stripTemporaryData(ai: {
  sessions: ChatSession[];
  messages: Record<string, ChatMessage[]>;
}) {
  const temporarySessionIds = new Set<string>();

  for (const session of ai.sessions) {
    if (isTemporarySession(session)) {
      temporarySessionIds.add(session.id);
    }
  }

  for (const sessionId of Object.keys(ai.messages)) {
    if (isTemporarySessionId(sessionId)) {
      temporarySessionIds.add(sessionId);
    }
  }

  const sessions = ai.sessions.filter((session) => !isTemporarySession(session));
  const messages = Object.fromEntries(
    Object.entries(ai.messages).filter(([sessionId]) => !temporarySessionIds.has(sessionId))
  );

  return {
    sessions,
    messages,
    temporarySessionIds: Array.from(temporarySessionIds)
  };
}

export function shouldPersistSession(
  ai: { sessions: ChatSession[] },
  sessionId: string
): boolean {
  if (isTemporarySessionId(sessionId)) {
    return false;
  }
  const session = ai.sessions.find((item) => item.id === sessionId);
  return !isTemporarySession(session);
}

export function hasUserMessage(messages: ChatMessage[]): boolean {
  return messages.some((message) => message.role === 'user');
}
