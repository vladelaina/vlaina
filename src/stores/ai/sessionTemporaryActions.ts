import type { ChatMessage, ChatSession } from '@/lib/ai/types'
import { translate } from '@/lib/i18n'
import { generateId } from '@/lib/id'
import { cancelSessionJsonSave, saveSessionJson } from '@/lib/storage/chatStorage'
import { requestManager } from '@/lib/ai/requestManager'
import { isTemporarySession, isTemporarySessionId } from '@/lib/ai/temporaryChat'
import { aliasSessionId } from '@/lib/ai/sessionIdAliases'
import { runWithSessionMutationLock } from '@/lib/ai/sessionMutationLock'
import { useUnifiedStore } from '../unified/useUnifiedStore'
import {
  buildTemporarySessionState,
  filterUnreadSessionIds,
  persistLastChatSessionIdForCurrentWindow,
  stripTemporaryForMutation,
  useAIUIStore,
} from './chatState'
import { persistInlineImageSourcesForSessionInBackground } from './sessionInlineImagePersistence'

function saveSessionJsonInBackground(sessionId: string, messages: ChatMessage[]) {
  void saveSessionJson(sessionId, messages).catch(() => {})
}

export function toggleTemporaryChat(enabled?: boolean) {
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
    }, true)
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
  }, true)
  uiState.setTemporaryReturnSessionId(null)
  uiState.setChatSelection({
    currentSessionId: restoreSessionId,
    temporaryChatEnabled: false,
  })
  persistLastChatSessionIdForCurrentWindow(restoreSessionId)
}

export function openNewChat() {
  const state = useUnifiedStore.getState()
  const ai = state.data.ai!
  const uiState = useAIUIStore.getState()

  if (!uiState.temporaryChatEnabled) {
    uiState.setChatSelection({ currentSessionId: null, temporaryChatEnabled: false })
    persistLastChatSessionIdForCurrentWindow(null)
    return
  }

  const stripped = stripTemporaryForMutation(ai)
  state.updateAIData({
    sessions: stripped.sessions,
    messages: stripped.messages,
    unreadSessionIds: filterUnreadSessionIds(ai.unreadSessionIds, stripped.sessions.map((session) => session.id)),
  }, true)
  uiState.setTemporaryReturnSessionId(null)
  uiState.setChatSelection({ currentSessionId: null, temporaryChatEnabled: false })
  persistLastChatSessionIdForCurrentWindow(null)
}

export async function promoteTemporarySession() {
  const initialUIState = useAIUIStore.getState()
  const initialSessionId = initialUIState.currentSessionId
  if (!initialUIState.temporaryChatEnabled || !isTemporarySessionId(initialSessionId)) {
    return null
  }
  const temporarySessionId = initialSessionId as string

  return await runWithSessionMutationLock(temporarySessionId, async () => {
    const state = useUnifiedStore.getState()
    const ai = state.data.ai!
    const uiState = useAIUIStore.getState()
    const currentSessionId = uiState.currentSessionId

    if (
      !uiState.temporaryChatEnabled ||
      currentSessionId !== temporarySessionId ||
      !isTemporarySessionId(currentSessionId)
    ) {
      return null
    }

    const temporarySession = ai.sessions.find((session) => session.id === temporarySessionId)
    if (!temporarySession || !isTemporarySession(temporarySession)) {
      return null
    }

    const now = Date.now()
    const promotedSessionId = generateId('session-')
    const promotedSession: ChatSession = {
      id: promotedSessionId,
      title: translate('chat.newChatTitle'),
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

    const isPromotingGenerating =
      requestManager.isGenerating(temporarySessionId) ||
      !!uiState.generatingSessions[temporarySessionId]

    if (isPromotingGenerating) {
      aliasSessionId(temporarySessionId, promotedSessionId)
      requestManager.transfer(temporarySessionId, promotedSessionId)
      uiState.moveSessionState(temporarySessionId, promotedSessionId)
    } else {
      uiState.clearSessionState(temporarySessionId)
    }
    cancelSessionJsonSave(temporarySessionId)
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
    persistLastChatSessionIdForCurrentWindow(promotedSessionId)

    saveSessionJsonInBackground(promotedSessionId, nextMessages[promotedSessionId] || [])
    persistInlineImageSourcesForSessionInBackground(promotedSessionId)
    return promotedSessionId
  })
}
