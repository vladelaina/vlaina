import type { ChatMessage, ChatSession } from '@/lib/ai/types';

export const TEMP_SESSION_PREFIX = 'temp-session-';

export function isTemporarySessionId(sessionId: string | null | undefined): boolean {
  return !!sessionId && sessionId.startsWith(TEMP_SESSION_PREFIX);
}

export function isTemporarySession(session: ChatSession | null | undefined): boolean {
  return !!session && isTemporarySessionId(session.id);
}

export function createTemporarySession(modelId: string): ChatSession {
  const now = Date.now();
  return {
    id: `${TEMP_SESSION_PREFIX}${crypto.randomUUID()}`,
    title: 'Temporary Chat',
    modelId,
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

const IMAGE_MARKDOWN_REGEX = /!\[.*?\]\(.*?\)/g;
const TITLE_SOURCE_MAX_LENGTH = 1200;
const AUTO_TITLE_PLACEHOLDERS = new Set(['New Chat']);

export function needsAutoTitle(title: string | null | undefined): boolean {
  const normalizedTitle = title?.trim() ?? '';
  return !normalizedTitle || AUTO_TITLE_PLACEHOLDERS.has(normalizedTitle);
}

export function buildTitleSourceFromMessages(messages: ChatMessage[]): string {
  const userSnippets = messages
    .filter((message) => message.role === 'user')
    .map((message) =>
      message.content
        .replace(IMAGE_MARKDOWN_REGEX, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter(Boolean);

  if (userSnippets.length === 0) {
    return 'Image Query';
  }

  const combined = userSnippets.join('\n').trim();
  if (!combined) {
    return 'Image Query';
  }

  return combined.length > TITLE_SOURCE_MAX_LENGTH
    ? combined.slice(0, TITLE_SOURCE_MAX_LENGTH)
    : combined;
}
