import type { ChatMessage, ChatSession } from '@/lib/ai/types'
import { generateId } from '@/lib/id'
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
  filterUnreadSessionIds,
  stripTemporaryForMutation,
  useAIUIStore,
} from './chatState'
import {
  runWithSessionMutationLock,
  runWithSessionMutationLocks,
} from '@/lib/ai/sessionMutationLock'

let switchSessionGeneration = 0;

export function createSessionActions() {
  return {
    toggleTemporaryChat: (enabled?: boolean) => {
      const state = useUnifiedStore.getState()
      const ai = state.data.ai!
      const uiState = useAIUIStore.getState()
      const nextEnabled = enabled ?? !uiState.temporaryChatEnabled

      if (nextEnabled === uiState.temporaryChatEnabled) {
        return
      }

      if (nextEnabled) {
        const returnSessionId = uiState.currentSessionId && !isTemporarySessionId(uiState.currentSessionId)
          ? uiState.currentSessionId
          : uiState.temporaryReturnSessionId
        const stripped = stripTemporaryForMutation(ai)
        const temporaryState = buildTemporarySessionState(stripped, ai.selectedModelId || '')

        state.updateAIData({
          sessions: temporaryState.sessions,
          messages: temporaryState.messages,
          unreadSessionIds: filterUnreadSessionIds(ai.unreadSessionIds, temporaryState.sessions.map((session) => session.id)),
        })
        uiState.setTemporaryReturnSessionId(returnSessionId || null)
        uiState.setChatSelection({
          currentSessionId: temporaryState.currentSessionId,
          temporaryChatEnabled: true,
        })
        return
      }

      const stripped = stripTemporaryForMutation(ai)
      const restoreSessionId = uiState.temporaryReturnSessionId && stripped.sessions.some((session) => session.id === uiState.temporaryReturnSessionId)
        ? uiState.temporaryReturnSessionId
        : null

      state.updateAIData({
        sessions: stripped.sessions,
        messages: stripped.messages,
        unreadSessionIds: filterUnreadSessionIds(ai.unreadSessionIds, stripped.sessions.map((session) => session.id)),
      })
      uiState.setTemporaryReturnSessionId(null)
      uiState.setChatSelection({
        currentSessionId: restoreSessionId,
        temporaryChatEnabled: false,
      })
    },

    openNewChat: () => {
      const state = useUnifiedStore.getState()
      const ai = state.data.ai!
      const uiState = useAIUIStore.getState()

      if (!uiState.temporaryChatEnabled) {
        uiState.setChatSelection({ currentSessionId: null, temporaryChatEnabled: false })
        return
      }

      const stripped = stripTemporaryForMutation(ai)
      state.updateAIData({
        sessions: stripped.sessions,
        messages: stripped.messages,
        unreadSessionIds: filterUnreadSessionIds(ai.unreadSessionIds, stripped.sessions.map((session) => session.id)),
      })
      uiState.setTemporaryReturnSessionId(null)
      uiState.setChatSelection({ currentSessionId: null, temporaryChatEnabled: false })
    },

    promoteTemporarySession: () => {
      const state = useUnifiedStore.getState()
      const ai = state.data.ai!
      const uiState = useAIUIStore.getState()
      const currentSessionId = uiState.currentSessionId

      if (!uiState.temporaryChatEnabled || !isTemporarySessionId(currentSessionId)) {
        return null
      }
      const temporarySessionId = currentSessionId as string

      const temporarySession = ai.sessions.find((session) => session.id === temporarySessionId)
      if (!temporarySession || !isTemporarySession(temporarySession)) {
        return null
      }

      const now = Date.now()
      const promotedSessionId = generateId('session-')
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
      const nextUnreadSessionIds = Array.from(new Set(
        (ai.unreadSessionIds || [])
          .map((sessionId) => sessionId === temporarySessionId ? promotedSessionId : sessionId)
          .filter((sessionId) => sessionId === promotedSessionId || nextSessions.some((session) => session.id === sessionId))
      ))

      requestManager.abort(temporarySessionId)
      cancelSessionJsonSave(temporarySessionId)
      uiState.clearSessionState(temporarySessionId)
      uiState.setTemporaryReturnSessionId(null)

      state.updateAIData({
        sessions: nextSessions,
        messages: nextMessages,
        unreadSessionIds: nextUnreadSessionIds,
      })
      uiState.setChatSelection({
        currentSessionId: promotedSessionId,
        temporaryChatEnabled: false,
      })

      void saveSessionJson(promotedSessionId, nextMessages[promotedSessionId] || [])
      return promotedSessionId
    },

    createSession: (title = 'New Chat') => createAIChatSession(title),

    switchSession: async (sessionId: string) => {
      switchSessionGeneration += 1
      const myGeneration = switchSessionGeneration
      const state = useUnifiedStore.getState()
      const ai = state.data.ai!
      const uiState = useAIUIStore.getState()

      if (uiState.temporaryChatEnabled && !isTemporarySessionId(sessionId)) {
        const stripped = stripTemporaryForMutation(ai)
        uiState.setTemporaryReturnSessionId(null)

        state.updateAIData({
          sessions: stripped.sessions,
          messages: stripped.messages,
          unreadSessionIds: filterUnreadSessionIds(ai.unreadSessionIds, stripped.sessions.map((session) => session.id)),
        })
        uiState.setChatSelection({ currentSessionId: sessionId, temporaryChatEnabled: false })
      } else {
        uiState.setCurrentSessionId(sessionId)
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
        if (switchSessionGeneration !== myGeneration) return
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
      void runWithSessionMutationLock(id, async () => {
        const state = useUnifiedStore.getState()
        const ai = state.data.ai!
        if (!ai.sessions.some((session) => session.id === id)) {
          return
        }

        state.updateAIData({
          sessions: ai.sessions.map((session) =>
            session.id === id ? { ...session, ...updates, updatedAt: Date.now() } : session
          )
        })
      })
    },

    deleteSession: async (id: string) => {
      const state = useUnifiedStore.getState()
      const ai = state.data.ai!
      const uiState = useAIUIStore.getState()

      if (isTemporarySessionId(id)) {
        requestManager.abort(id)
        cancelSessionJsonSave(id)
        uiState.clearSessionState(id)

        const stripped = stripTemporaryForMutation(ai)

        if (uiState.temporaryChatEnabled) {
          const temporaryState = buildTemporarySessionState(stripped, ai.selectedModelId || '')
          state.updateAIData({
            sessions: temporaryState.sessions,
            messages: temporaryState.messages,
            unreadSessionIds: filterUnreadSessionIds(ai.unreadSessionIds, temporaryState.sessions.map((session) => session.id)),
          })
          uiState.setChatSelection({
            currentSessionId: temporaryState.currentSessionId,
            temporaryChatEnabled: true,
          })
        } else {
          state.updateAIData({
            sessions: stripped.sessions,
            messages: stripped.messages,
            unreadSessionIds: filterUnreadSessionIds(ai.unreadSessionIds, stripped.sessions.map((session) => session.id)),
          })
          if (uiState.currentSessionId === id) {
            uiState.setCurrentSessionId(null)
          }
        }
        return
      }

      await runWithSessionMutationLock(id, async () => {
        const latestState = useUnifiedStore.getState()
        const latestAI = latestState.data.ai!
        const latestUIState = useAIUIStore.getState()

        requestManager.abort(id)
        cancelSessionJsonSave(id)
        latestUIState.clearSessionState(id)

        if (!latestAI.sessions.some((session) => session.id === id)) {
          return
        }

        const newSessions = latestAI.sessions.filter((session) => session.id !== id)
        const newMessages = { ...latestAI.messages }
        delete newMessages[id]

        latestState.updateAIData({
          sessions: newSessions,
          messages: newMessages,
          unreadSessionIds: (latestAI.unreadSessionIds || []).filter((sessionId) => sessionId !== id),
        })
        if (latestUIState.currentSessionId === id) {
          latestUIState.setCurrentSessionId(null)
        }
        await deleteSessionJson(id)
      })
    },

    clearSessions: async () => {
      const state = useUnifiedStore.getState()
      const ai = state.data.ai!
      const sessionIds = ai.sessions.map((session) => session.id)

      await runWithSessionMutationLocks(sessionIds, async () => {
        const latestState = useUnifiedStore.getState()
        const latestAI = latestState.data.ai!
        const uiState = useAIUIStore.getState()

        await Promise.all(
          latestAI.sessions.map(async (session) => {
            requestManager.abort(session.id)
            cancelSessionJsonSave(session.id)
            uiState.clearSessionState(session.id)

            if (!isTemporarySession(session)) {
              await deleteSessionJson(session.id)
            }
          })
        )

        if (uiState.temporaryChatEnabled) {
          stripTemporaryForMutation(latestAI)
          const temporaryState = buildTemporarySessionState({ sessions: [], messages: {} }, latestAI.selectedModelId || '')
          latestState.updateAIData({
            sessions: temporaryState.sessions,
            messages: temporaryState.messages,
            unreadSessionIds: [],
          })
          uiState.setChatSelection({
            currentSessionId: temporaryState.currentSessionId,
            temporaryChatEnabled: true,
          })
          return
        }

        latestState.updateAIData({ sessions: [], messages: {}, unreadSessionIds: [] })
        uiState.setChatSelection({ currentSessionId: null, temporaryChatEnabled: false })
      })
    },
  }
}
