import { describe, expect, it } from 'vitest'
import type { ChatMessage, ChatSession } from '@/lib/ai/types'
import {
  MAX_LOADED_CHAT_MESSAGE_SESSIONS,
  limitLoadedChatSessionMessages,
} from './sessionMessageCache'

function createSession(id: string, updatedAt: number): ChatSession {
  return {
    id,
    title: id,
    modelId: 'model-1',
    createdAt: updatedAt,
    updatedAt,
  }
}

function createMessages(sessionIds: readonly string[]): Record<string, ChatMessage[]> {
  return Object.fromEntries(
    sessionIds.map((sessionId) => [
      sessionId,
      [{
        id: `message-${sessionId}`,
        role: 'user',
        content: sessionId,
        modelId: 'model-1',
        timestamp: 1,
        versions: [],
        currentVersionIndex: 0,
      } satisfies ChatMessage],
    ]),
  )
}

describe('limitLoadedChatSessionMessages', () => {
  it('keeps the most recent loaded sessions within the memory cache limit', () => {
    const sessionIds = Array.from(
      { length: MAX_LOADED_CHAT_MESSAGE_SESSIONS + 3 },
      (_value, index) => `session-${index}`,
    )
    const sessions = sessionIds.map((sessionId, index) => createSession(sessionId, index))
    const limited = limitLoadedChatSessionMessages(createMessages(sessionIds), sessions)

    expect(Object.keys(limited)).toHaveLength(MAX_LOADED_CHAT_MESSAGE_SESSIONS)
    expect(limited['session-0']).toBeUndefined()
    expect(limited[`session-${sessionIds.length - 1}`]).toBeDefined()
  })

  it('protects active, generating, and temporary session messages', () => {
    const sessionIds = Array.from(
      { length: MAX_LOADED_CHAT_MESSAGE_SESSIONS + 4 },
      (_value, index) => `session-${index}`,
    )
    const temporarySessionId = 'temp-session-1'
    const sessions = [
      ...sessionIds.map((sessionId, index) => createSession(sessionId, index)),
      createSession(temporarySessionId, 0),
    ]
    const limited = limitLoadedChatSessionMessages(
      createMessages([...sessionIds, temporarySessionId]),
      sessions,
      ['session-0', 'session-1'],
    )

    expect(limited['session-0']).toBeDefined()
    expect(limited['session-1']).toBeDefined()
    expect(limited[temporarySessionId]).toBeDefined()
  })
})
