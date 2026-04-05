import type { ChatMessage, ChatSession } from '@/lib/ai/types'
import {
  cancelSessionJsonSave,
  deleteSessionJson,
  loadSessionJson,
  saveSessionJson,
} from '@/lib/storage/chatStorage'
import { requestManager } from '@/lib/ai/requestManager'
import {
  isTemporarySession,
  isTemporarySessionId,
} from '@/lib/ai/temporaryChat'
import { useUnifiedStore } from '../unified/useUnifiedStore'
import {
  buildTemporarySessionState,
  createAIChatSession,
  stripTemporaryForMutation,
  useAIUIStore,
} from './chatState'

export function createSessionActions() {
  return {
    toggleTemporaryChat: (enabled?: boolean) => {
      const state = useUnifiedStore.getState()
      const ai = state.data.ai!
      const uiState = useAIUIStore.getState()
      const nextEnabled = enabled ?? !ai.temporaryChatEnabled

      if (nextEnabled === !!ai.temporaryChatEnabled) {
        return
      }

      if (nextEnabled) {
        const returnSessionId = ai.currentSessionId && !isTemporarySessionId(ai.currentSessionId)
          ? ai.currentSessionId
          : uiState.temporaryReturnSessionId
        const stripped = stripTemporaryForMutation(ai)
        const temporaryState = buildTemporarySessionState(stripped, ai.selectedModelId || '')

        state.updateAIData({
          temporaryChatEnabled: true,
          sessions: temporaryState.sessions,
          messages: temporaryState.messages,
          currentSessionId: temporaryState.currentSessionId
        })
        uiState.setTemporaryReturnSessionId(returnSessionId || null)
        return
      }

      const stripped = stripTemporaryForMutation(ai)
      const restoreSessionId = uiState.temporaryReturnSessionId && stripped.sessions.some((session) => session.id === uiState.temporaryReturnSessionId)
        ? uiState.temporaryReturnSessionId
        : null

      state.updateAIData({
        temporaryChatEnabled: false,
        sessions: stripped.sessions,
        messages: stripped.messages,
        currentSessionId: restoreSessionId
      })
      uiState.setTemporaryReturnSessionId(null)
    },

    openNewChat: () => {
      const state = useUnifiedStore.getState()
      const ai = state.data.ai!

      if (!ai.temporaryChatEnabled) {
        state.updateAIData({ currentSessionId: null })
        return
      }

      const uiState = useAIUIStore.getState()
      const stripped = stripTemporaryForMutation(ai)
      state.updateAIData({
        temporaryChatEnabled: false,
        sessions: stripped.sessions,
        messages: stripped.messages,
        currentSessionId: null
      })
      uiState.setTemporaryReturnSessionId(null)
    },

    promoteTemporarySession: () => {
      const state = useUnifiedStore.getState()
      const ai = state.data.ai!
      const uiState = useAIUIStore.getState()
      const currentSessionId = ai.currentSessionId

      if (!ai.temporaryChatEnabled || !isTemporarySessionId(currentSessionId)) {
        return null
      }
      const temporarySessionId = currentSessionId as string

      const temporarySession = ai.sessions.find((session) => session.id === temporarySessionId)
      if (!temporarySession || !isTemporarySession(temporarySession)) {
        return null
      }

      const now = Date.now()
      const promotedSessionId = `session-${now}-${Math.random().toString(36).substring(2, 11)}`
      const promotedSession: ChatSession = {
        id: promotedSessionId,
        title: 'New Chat',
        modelId: temporarySession.modelId || ai.selectedModelId || '',
        isPinned: temporarySession.isPinned,
        createdAt: temporarySession.createdAt || now,
        updatedAt: now
      }

      const sessionsWithoutOtherTemporary = ai.sessions.filter((session) => {
        if (!isTemporarySession(session)) return true
        return session.id === temporarySessionId
      })
      const nextSessions = sessionsWithoutOtherTemporary.map((session) =>
        session.id === temporarySessionId ? promotedSession : session
      )

      const nextMessages = Object.fromEntries(
        Object.entries(ai.messages).filter(([sessionId]) =>
          !isTemporarySessionId(sessionId) || sessionId === temporarySessionId
        )
      ) as Record<string, ChatMessage[]>
      nextMessages[promotedSessionId] = nextMessages[temporarySessionId] || []
      delete nextMessages[temporarySessionId]

      requestManager.abort(temporarySessionId)
      cancelSessionJsonSave(temporarySessionId)
      uiState.clearSessionState(temporarySessionId)
      uiState.setTemporaryReturnSessionId(null)

      state.updateAIData({
        temporaryChatEnabled: false,
        sessions: nextSessions,
        messages: nextMessages,
        currentSessionId: promotedSessionId
      })

      void saveSessionJson(promotedSessionId, nextMessages[promotedSessionId] || [])
      return promotedSessionId
    },

    createSession: (title = 'New Chat') => createAIChatSession(title),

    switchSession: async (sessionId: string) => {
      const state = useUnifiedStore.getState()
      const ai = state.data.ai!

      if (ai.temporaryChatEnabled && !isTemporarySessionId(sessionId)) {
        const uiState = useAIUIStore.getState()
        const stripped = stripTemporaryForMutation(ai)
        uiState.setTemporaryReturnSessionId(null)

        state.updateAIData({
          temporaryChatEnabled: false,
          sessions: stripped.sessions,
          messages: stripped.messages,
          currentSessionId: sessionId
        })
      } else {
        state.updateAIData({ currentSessionId: sessionId })
        if (isTemporarySessionId(sessionId)) {
          if (!(sessionId in ai.messages)) {
            const freshState = useUnifiedStore.getState()
            freshState.updateAIData({
              messages: {
                ...freshState.data.ai!.messages,
                [sessionId]: []
              }
            }, true)
          }
          return
        }
      }

      const latestAI = useUnifiedStore.getState().data.ai!
      if (!(sessionId in latestAI.messages)) {
        const loadedMessages = await loadSessionJson(sessionId)
        const freshState = useUnifiedStore.getState()
        freshState.updateAIData({
          messages: {
            ...freshState.data.ai!.messages,
            [sessionId]: loadedMessages || []
          }
        })
      }
    },

    updateSession: (id: string, updates: Partial<ChatSession>) => {
      const state = useUnifiedStore.getState()
      const ai = state.data.ai!
      state.updateAIData({
        sessions: ai.sessions.map((session) =>
          session.id === id ? { ...session, ...updates, updatedAt: Date.now() } : session
        )
      })
    },

    deleteSession: (id: string) => {
      const state = useUnifiedStore.getState()
      const ai = state.data.ai!
      const uiState = useAIUIStore.getState()
      requestManager.abort(id)
      cancelSessionJsonSave(id)
      uiState.clearSessionState(id)

      if (isTemporarySessionId(id)) {
        const stripped = stripTemporaryForMutation(ai)

        if (ai.temporaryChatEnabled) {
          const temporaryState = buildTemporarySessionState(stripped, ai.selectedModelId || '')
          state.updateAIData({
            sessions: temporaryState.sessions,
            messages: temporaryState.messages,
            currentSessionId: temporaryState.currentSessionId
          })
        } else {
          state.updateAIData({
            sessions: stripped.sessions,
            messages: stripped.messages,
            currentSessionId: ai.currentSessionId === id ? null : ai.currentSessionId
          })
        }
        return
      }

      const newSessions = ai.sessions.filter((session) => session.id !== id)
      const newMessages = { ...ai.messages }
      delete newMessages[id]

      state.updateAIData({
        sessions: newSessions,
        messages: newMessages,
        currentSessionId: ai.currentSessionId === id ? null : ai.currentSessionId
      })
      void deleteSessionJson(id)
    },

    clearSessions: () => {
      const state = useUnifiedStore.getState()
      const ai = state.data.ai!
      const uiState = useAIUIStore.getState()
      ai.sessions.forEach((session) => {
        requestManager.abort(session.id)
        cancelSessionJsonSave(session.id)
        uiState.clearSessionState(session.id)
        if (!isTemporarySession(session)) {
          void deleteSessionJson(session.id)
        }
      })

      if (ai.temporaryChatEnabled) {
        stripTemporaryForMutation(ai)
        const temporaryState = buildTemporarySessionState({ sessions: [], messages: {} }, ai.selectedModelId || '')
        state.updateAIData({
          sessions: temporaryState.sessions,
          messages: temporaryState.messages,
          currentSessionId: temporaryState.currentSessionId
        })
        return
      }

      state.updateAIData({ sessions: [], messages: {}, currentSessionId: null })
    },
  }
}
