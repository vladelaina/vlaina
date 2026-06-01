import type { ApiTranscriptMessage, ChatMessage, ChatMessageContent, ChatSession } from '@/lib/ai/types'
import { generateId } from '@/lib/id'
import {
  cancelSessionJsonSave,
  deleteSessionJson,
  hasSessionJson,
  loadSessionJson,
  saveSessionJson,
} from '@/lib/storage/chatStorage'
import { persistDataUrlAttachment } from '@/lib/storage/attachmentStorage'
import { requestManager } from '@/lib/ai/requestManager'
import {
  isTemporarySession,
  isTemporarySessionId,
} from '@/lib/ai/temporaryChat'
import { aliasSessionId } from '@/lib/ai/sessionIdAliases'
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
import { extractMarkdownImageSources } from '@/components/Chat/common/messageClipboard'

let switchSessionGeneration = 0;
const DATA_IMAGE_SOURCE_PREFIX = 'data:image/'
const inlineImagePersistenceSessions = new Set<string>()

function collectInlineImageSourcesFromContent(content: string | undefined) {
  if (!content) {
    return []
  }
  return extractMarkdownImageSources(content).filter((src) => src.startsWith(DATA_IMAGE_SOURCE_PREFIX))
}

function collectInlineImageSourcesFromApiContent(content: ChatMessageContent | null | undefined) {
  if (typeof content === 'string') {
    return collectInlineImageSourcesFromContent(content)
  }

  if (!Array.isArray(content)) {
    return []
  }

  return content
    .map((part) => part.type === 'image_url' ? part.image_url.url : null)
    .filter((src): src is string => !!src && src.startsWith(DATA_IMAGE_SOURCE_PREFIX))
}

function collectInlineImageSourcesFromApiTranscript(apiTranscript: ApiTranscriptMessage[] | undefined) {
  if (!apiTranscript) {
    return []
  }

  return apiTranscript.flatMap((message) => collectInlineImageSourcesFromApiContent(message.content))
}

function replaceAllSourceReferences(content: string, replacements: Map<string, string>) {
  let nextContent = content
  replacements.forEach((target, source) => {
    nextContent = nextContent.split(source).join(target)
  })
  return nextContent
}

function replaceApiTranscriptContent(
  content: ChatMessageContent | null | undefined,
  replacements: Map<string, string>,
): ChatMessageContent | null | undefined {
  if (typeof content === 'string') {
    return replaceAllSourceReferences(content, replacements)
  }

  if (!Array.isArray(content)) {
    return content
  }

  return content.map((part) => {
    if (part.type !== 'image_url') {
      return part
    }
    return {
      ...part,
      image_url: {
        ...part.image_url,
        url: replacements.get(part.image_url.url) || part.image_url.url,
      },
    }
  })
}

function replaceApiTranscriptSources(
  apiTranscript: ApiTranscriptMessage[] | undefined,
  replacements: Map<string, string>,
): ApiTranscriptMessage[] | undefined {
  return apiTranscript?.map((message) => ({
    ...message,
    content: replaceApiTranscriptContent(message.content, replacements),
  }))
}

function collectInlineImageSources(messages: ChatMessage[], sources = new Set<string>()) {
  messages.forEach((message) => {
    collectInlineImageSourcesFromContent(message.content).forEach((source) => sources.add(source))
    collectInlineImageSourcesFromApiTranscript(message.apiTranscript).forEach((source) => sources.add(source))
    message.imageSources?.forEach((source) => {
      if (source.startsWith(DATA_IMAGE_SOURCE_PREFIX)) {
        sources.add(source)
      }
    })
    message.versions?.forEach((version) => {
      collectInlineImageSourcesFromContent(version.content).forEach((source) => sources.add(source))
      collectInlineImageSourcesFromApiTranscript(version.apiTranscript).forEach((source) => sources.add(source))
      collectInlineImageSources(version.subsequentMessages || [], sources)
    })
  })

  return sources
}

function applyImageSourceReplacements(messages: ChatMessage[], replacements: Map<string, string>): ChatMessage[] {
  return messages.map((message) => ({
    ...message,
    content: replaceAllSourceReferences(message.content, replacements),
    apiTranscript: replaceApiTranscriptSources(message.apiTranscript, replacements),
    imageSources: message.imageSources?.map((source) => replacements.get(source) || source),
    versions: message.versions?.map((version) => ({
      ...version,
      content: replaceAllSourceReferences(version.content, replacements),
      apiTranscript: replaceApiTranscriptSources(version.apiTranscript, replacements),
      subsequentMessages: applyImageSourceReplacements(version.subsequentMessages || [], replacements),
    })),
  }))
}

async function persistInlineImageSourcesForSession(sessionId: string) {
  if (inlineImagePersistenceSessions.has(sessionId)) {
    return
  }

  inlineImagePersistenceSessions.add(sessionId)
  try {
    const state = useUnifiedStore.getState()
    const ai = state.data.ai!
    const messages = ai.messages[sessionId] || []
    const sources = collectInlineImageSources(messages)
    if (sources.size === 0) {
      return
    }

    const replacements = new Map<string, string>()
    for (const source of sources) {
      const persistedSource = await persistDataUrlAttachment(source).catch(() => null)
      if (persistedSource) {
        replacements.set(source, persistedSource)
      }
    }

    if (replacements.size === 0) {
      return
    }

    const latestState = useUnifiedStore.getState()
    const latestAI = latestState.data.ai!
    if (!latestAI.sessions.some((session) => session.id === sessionId)) {
      return
    }
    const latestMessages = latestAI.messages[sessionId] || []
    const nextMessages = applyImageSourceReplacements(latestMessages, replacements)

    latestState.updateAIData({
      messages: {
        ...latestAI.messages,
        [sessionId]: nextMessages,
      },
    }, true)
    void saveSessionJson(sessionId, nextMessages)
  } finally {
    inlineImagePersistenceSessions.delete(sessionId)
  }
}

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

    promoteTemporarySession: async () => {
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
          title: 'New',
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

        void saveSessionJson(promotedSessionId, nextMessages[promotedSessionId] || [])
        void persistInlineImageSourcesForSession(promotedSessionId)
        return promotedSessionId
      })
    },

    createSession: (title = 'New') => createAIChatSession(title),

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
        if (!loadedMessages && await hasSessionJson(sessionId)) {
          useAIUIStore.getState().setError('This chat could not be loaded from disk. The original file was left untouched.');
          return
        }
        const freshState = useUnifiedStore.getState()
        freshState.updateAIData({
          messages: {
            ...freshState.data.ai!.messages,
            [sessionId]: loadedMessages || []
          }
        })
      }
      globalThis.setTimeout(() => {
        void persistInlineImageSourcesForSession(sessionId)
      }, 0)
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

        if (!latestAI.sessions.some((session) => session.id === id)) {
          return
        }

        try {
          await deleteSessionJson(id)
        } catch (error) {
          latestUIState.setError('Could not delete this chat from disk. The chat was kept.');
          throw error
        }

        cancelSessionJsonSave(id)
        latestUIState.clearSessionState(id)

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

        const persistentSessions = latestAI.sessions.filter((session) => !isTemporarySession(session))
        try {
          await Promise.all(persistentSessions.map((session) => deleteSessionJson(session.id)))
        } catch (error) {
          uiState.setError('Could not clear chats from disk. Existing chats were kept.');
          throw error
        }

        latestAI.sessions.forEach((session) => {
          requestManager.abort(session.id)
          cancelSessionJsonSave(session.id)
          uiState.clearSessionState(session.id)
        })

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
