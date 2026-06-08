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
import { awaitStartedOrCancelQueuedSessionPrefetch } from './sessionPrefetchActions'
import {
  runWithSessionMutationLock,
  runWithSessionMutationLocks,
} from '@/lib/ai/sessionMutationLock'
import { parseMarkdownImageTokens } from '@/components/Chat/common/messageImageTokens'
import { normalizeRenderableDataImageSrc } from '@/components/common/markdown/imagePolicy'

let switchSessionGeneration = 0;
const inlineImagePersistenceSessions = new Set<string>()
type InlineImageSourceGroups = Map<string, Set<string>>
const INLINE_DATA_IMAGE_TARGET_HINT_PATTERN = /\bdata(?::|&|&#)/i
const MAX_INLINE_IMAGE_PERSISTENCE_MESSAGE_NODES = 10_000
const MAX_INLINE_IMAGE_PERSISTENCE_VERSIONS = 20
const MAX_INLINE_IMAGE_PERSISTENCE_BRANCH_MESSAGES = 100
const MAX_INLINE_IMAGE_PERSISTENCE_BRANCH_DEPTH = 1
const MAX_INLINE_IMAGE_TOKENS_PER_CONTENT = 2000
const MAX_INLINE_IMAGE_PERSISTENCE_SOURCES = 1000

function addInlineImageSource(groups: InlineImageSourceGroups, source: string | null | undefined) {
  if (!source) {
    return
  }
  const normalized = normalizeRenderableDataImageSrc(source)
  if (!normalized) {
    return
  }
  if (!groups.has(normalized) && groups.size >= MAX_INLINE_IMAGE_PERSISTENCE_SOURCES) {
    return
  }
  const aliases = groups.get(normalized) ?? new Set<string>()
  aliases.add(normalized)
  aliases.add(source)
  groups.set(normalized, aliases)
}

function collectInlineImageSourcesFromContent(content: string | undefined, groups: InlineImageSourceGroups) {
  if (!content) {
    return
  }
  if (!INLINE_DATA_IMAGE_TARGET_HINT_PATTERN.test(content)) {
    return
  }
  parseMarkdownImageTokens(content, {
    maxTokens: MAX_INLINE_IMAGE_TOKENS_PER_CONTENT,
  }).forEach((token) => addInlineImageSource(groups, token.src))
}

function collectInlineImageSourcesFromApiContent(content: ChatMessageContent | null | undefined, groups: InlineImageSourceGroups) {
  if (typeof content === 'string') {
    collectInlineImageSourcesFromContent(content, groups)
    return
  }

  if (!Array.isArray(content)) {
    return
  }

  content.forEach((part) => {
    if (part.type === 'image_url') {
      addInlineImageSource(groups, part.image_url.url)
    }
  })
}

function collectInlineImageSourcesFromApiTranscript(apiTranscript: ApiTranscriptMessage[] | undefined, groups: InlineImageSourceGroups) {
  if (!apiTranscript) {
    return
  }

  apiTranscript.forEach((message) => collectInlineImageSourcesFromApiContent(message.content, groups))
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

function collectInlineImageSources(messages: ChatMessage[], groups: InlineImageSourceGroups = new Map()) {
  const stack: Array<{ depth: number; messages: ChatMessage[] }> = [{ depth: 0, messages }]
  let visited = 0

  while (stack.length > 0 && visited < MAX_INLINE_IMAGE_PERSISTENCE_MESSAGE_NODES) {
    const frame = stack.pop()!

    for (const message of frame.messages) {
      if (visited >= MAX_INLINE_IMAGE_PERSISTENCE_MESSAGE_NODES) {
        break
      }
      visited += 1

      collectInlineImageSourcesFromContent(message.content, groups)
      collectInlineImageSourcesFromApiTranscript(message.apiTranscript, groups)
      message.imageSources?.forEach((source) => addInlineImageSource(groups, source))
      message.versions?.slice(0, MAX_INLINE_IMAGE_PERSISTENCE_VERSIONS).forEach((version) => {
        collectInlineImageSourcesFromContent(version.content, groups)
        collectInlineImageSourcesFromApiTranscript(version.apiTranscript, groups)
        if (
          frame.depth < MAX_INLINE_IMAGE_PERSISTENCE_BRANCH_DEPTH &&
          Array.isArray(version.subsequentMessages) &&
          version.subsequentMessages.length > 0
        ) {
          stack.push({
            depth: frame.depth + 1,
            messages: version.subsequentMessages.slice(0, MAX_INLINE_IMAGE_PERSISTENCE_BRANCH_MESSAGES),
          })
        }
      })
    }
  }

  return groups
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
    for (const [source, aliases] of sources) {
      const persistedSource = await persistDataUrlAttachment(source).catch(() => null)
      if (persistedSource) {
        aliases.forEach((alias) => replacements.set(alias, persistedSource))
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

function scheduleInlineImagePersistence(sessionId: string) {
  globalThis.setTimeout(() => {
    void persistInlineImageSourcesForSession(sessionId)
  }, 0)
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
        const reusedActivePrefetch = await awaitStartedOrCancelQueuedSessionPrefetch(sessionId)
        if (switchSessionGeneration !== myGeneration) return
        if (reusedActivePrefetch && sessionId in (useUnifiedStore.getState().data.ai?.messages ?? {})) {
          scheduleInlineImagePersistence(sessionId)
          return
        }
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
      scheduleInlineImagePersistence(sessionId)
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
