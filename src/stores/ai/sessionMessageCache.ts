import type { ChatMessage, ChatSession } from '@/lib/ai/types'
import { isTemporarySession, isTemporarySessionId } from '@/lib/ai/temporaryChat'

export const MAX_LOADED_CHAT_MESSAGE_SESSIONS = 8

function getSessionRecency(session: ChatSession | undefined): number {
  if (!session) return 0
  const updatedAt = typeof session.updatedAt === 'number' && Number.isFinite(session.updatedAt)
    ? session.updatedAt
    : 0
  const createdAt = typeof session.createdAt === 'number' && Number.isFinite(session.createdAt)
    ? session.createdAt
    : 0
  return Math.max(updatedAt, createdAt)
}

function getProtectedSessionIds(
  messages: Record<string, ChatMessage[]>,
  sessions: readonly ChatSession[],
  protectedSessionIds: readonly (string | null | undefined)[],
) {
  const protectedIds = new Set<string>()

  protectedSessionIds.forEach((sessionId) => {
    if (sessionId) protectedIds.add(sessionId)
  })

  sessions.forEach((session) => {
    if (isTemporarySession(session) || isTemporarySessionId(session.id)) {
      protectedIds.add(session.id)
    }
  })

  Object.keys(messages).forEach((sessionId) => {
    if (isTemporarySessionId(sessionId)) {
      protectedIds.add(sessionId)
    }
  })

  return protectedIds
}

export function limitLoadedChatSessionMessages(
  messages: Record<string, ChatMessage[]>,
  sessions: readonly ChatSession[],
  protectedSessionIds: readonly (string | null | undefined)[] = [],
): Record<string, ChatMessage[]> {
  const messageSessionIds = Object.keys(messages)
  if (messageSessionIds.length <= MAX_LOADED_CHAT_MESSAGE_SESSIONS) {
    return messages
  }

  const sessionById = new Map(sessions.map((session) => [session.id, session]))
  const messageOrder = new Map(messageSessionIds.map((sessionId, index) => [sessionId, index]))
  const protectedIds = getProtectedSessionIds(messages, sessions, protectedSessionIds)
  const keepIds = new Set<string>(
    messageSessionIds.filter((sessionId) => protectedIds.has(sessionId)),
  )

  const candidates = messageSessionIds
    .filter((sessionId) => !protectedIds.has(sessionId))
    .sort((left, right) => {
      const recencyDiff = getSessionRecency(sessionById.get(right)) - getSessionRecency(sessionById.get(left))
      if (recencyDiff !== 0) return recencyDiff
      return (messageOrder.get(right) ?? 0) - (messageOrder.get(left) ?? 0)
    })

  for (const sessionId of candidates) {
    if (keepIds.size >= MAX_LOADED_CHAT_MESSAGE_SESSIONS) break
    keepIds.add(sessionId)
  }

  if (keepIds.size === messageSessionIds.length) {
    return messages
  }

  return Object.fromEntries(
    messageSessionIds
      .filter((sessionId) => keepIds.has(sessionId))
      .map((sessionId) => [sessionId, messages[sessionId]]),
  )
}
