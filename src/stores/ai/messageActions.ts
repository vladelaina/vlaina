import type { ApiTranscriptMessage, ChatMessage, MessageVersion } from '@/lib/ai/types'
import { normalizeApiTranscriptMessages } from '@/lib/ai/apiTranscript'
import { generateId } from '@/lib/id'
import {
  saveSessionJson,
  scheduleSessionJsonSave,
} from '@/lib/storage/chatStorage'
import { shouldPersistSession } from '@/lib/ai/temporaryChat'
import { resolveSessionIdAlias } from '@/lib/ai/sessionIdAliases'
import {
  extractRenderedMarkdownImageSources,
  extractRenderedMessageImageSources,
  isRenderedImageSource,
} from '@/components/Chat/common/messageClipboard'
import { normalizeRenderableImageSrc } from '@/components/common/markdown/imagePolicy'
import { useUnifiedStore } from '../unified/useUnifiedStore'
import { useAIUIStore } from './chatState'

function createMessageVersion(
  content: string,
  createdAt: number,
  kind: MessageVersion['kind'],
  apiTranscript?: ApiTranscriptMessage[],
): MessageVersion {
  const normalizedApiTranscript = normalizeApiTranscriptMessages(apiTranscript)
  return {
    content,
    createdAt,
    kind,
    subsequentMessages: [],
    ...(normalizedApiTranscript ? { apiTranscript: normalizedApiTranscript } : {})
  }
}

function getSafeMessageVersions(message: ChatMessage): MessageVersion[] {
  if (Array.isArray(message.versions) && message.versions.length > 0) {
    return [...message.versions]
  }

  return [createMessageVersion(message.content || '', message.timestamp || Date.now(), 'original', message.apiTranscript)]
}

function getSafeCurrentVersionIndex(message: ChatMessage, versions: MessageVersion[]): number {
  const index = Number.isInteger(message.currentVersionIndex) ? message.currentVersionIndex : 0
  return index >= 0 && index < versions.length ? index : 0
}

function canMessageUseVersionKind(message: ChatMessage, kind: MessageVersion['kind']): boolean {
  if (message.role === 'assistant') {
    return kind === 'original' || kind === 'regeneration'
  }
  if (message.role === 'user') {
    return kind === 'original' || kind === 'edit'
  }
  return kind === 'original'
}

function extractStoredImageSources(role: ChatMessage['role'], content: string): string[] {
  return role === 'user'
    ? extractRenderedMarkdownImageSources(content)
    : extractRenderedMessageImageSources(content)
}

function sanitizeProvidedImageSources(imageSources: string[] | undefined): string[] {
  return (imageSources ?? [])
    .map((src) => normalizeRenderableImageSrc(src))
    .filter((src): src is string => src !== null && isRenderedImageSource(src))
}

function getNewMessageImageSources(message: Omit<ChatMessage, 'id' | 'timestamp' | 'versions' | 'currentVersionIndex'>): string[] | undefined {
  const providedSources = sanitizeProvidedImageSources(message.imageSources)
  if (message.role !== 'user') {
    return providedSources.length > 0 ? providedSources : undefined
  }

  return providedSources.length > 0
    ? providedSources
    : extractStoredImageSources(message.role, message.content || '')
}

function hasSession(ai: { sessions: Array<{ id: string }> }, sessionId: string): boolean {
  return ai.sessions.some((session) => session.id === sessionId)
}

interface AddMessageOptions {
  persistUnified?: boolean
  touchSession?: boolean
}

const MAX_MESSAGE_VERSIONS = 20
const MAX_VERSION_BRANCH_MESSAGES = 100
const MAX_VERSION_BRANCH_DEPTH = 0

function limitMessageVersions(
  versions: MessageVersion[],
  activeIndex: number
): { versions: MessageVersion[]; currentVersionIndex: number } {
  if (versions.length <= MAX_MESSAGE_VERSIONS) {
    return { versions, currentVersionIndex: activeIndex }
  }

  const keepIndexes = new Set<number>([activeIndex])
  for (let index = versions.length - 1; index >= 0 && keepIndexes.size < MAX_MESSAGE_VERSIONS; index -= 1) {
    keepIndexes.add(index)
  }

  const keptIndexes = Array.from(keepIndexes).sort((left, right) => left - right)
  return {
    versions: keptIndexes.map((index) => versions[index]!),
    currentVersionIndex: keptIndexes.indexOf(activeIndex),
  }
}

function pruneVersionBranchMessages(
  messages: ChatMessage[],
  depth = 0
): ChatMessage[] {
  return messages
    .slice(0, MAX_VERSION_BRANCH_MESSAGES)
    .map((message) => pruneMessageVersionBranches(message, depth))
}

function pruneMessageVersionBranches(message: ChatMessage, depth: number): ChatMessage {
  const versions = getSafeMessageVersions(message)
  const currentVersionIndex = getSafeCurrentVersionIndex(message, versions)
  const limited = limitMessageVersions(versions, currentVersionIndex)
  const shouldKeepNestedBranches = depth < MAX_VERSION_BRANCH_DEPTH

  return {
    ...message,
    versions: limited.versions.map((version) => ({
      ...version,
      subsequentMessages: shouldKeepNestedBranches
        ? pruneVersionBranchMessages(version.subsequentMessages || [], depth + 1)
        : [],
    })),
    currentVersionIndex: limited.currentVersionIndex,
  }
}

export function createMessageActions() {
  return {
    addMessage: (
      message: Omit<ChatMessage, 'id' | 'timestamp' | 'versions' | 'currentVersionIndex'> & { id?: string },
      sessionId?: string,
      options?: AddMessageOptions,
    ) => {
      const state = useUnifiedStore.getState()
      const ai = state.data.ai!
      const rawSessionId = sessionId || useAIUIStore.getState().currentSessionId
      if (!rawSessionId) return
      const targetSessionId = resolveSessionIdAlias(rawSessionId)
      if (!hasSession(ai, targetSessionId)) return
      const persistUnified = options?.persistUnified !== false
      const touchSession = options?.touchSession !== false

      const createdAt = Date.now()
      const newMessage: ChatMessage = {
        ...message,
        imageSources: getNewMessageImageSources(message),
        id: message.id || generateId('msg-'),
        timestamp: createdAt,
        versions: [createMessageVersion(message.content || '', createdAt, 'original', message.apiTranscript)],
        currentVersionIndex: 0
      }

      const sessionMessages = ai.messages[targetSessionId] || []
      const newMessages = [...sessionMessages, newMessage]

      state.updateAIData({
        messages: { ...ai.messages, [targetSessionId]: newMessages },
        sessions: touchSession
          ? ai.sessions.map((session) =>
              session.id === targetSessionId ? { ...session, updatedAt: Date.now() } : session
            )
          : ai.sessions
      }, !persistUnified)

      if (shouldPersistSession(ai, targetSessionId)) {
        saveSessionJson(targetSessionId, newMessages)
      }
      return newMessage.id
    },

    updateMessage: (sessionId: string, id: string, content: string) => {
      const targetSessionId = resolveSessionIdAlias(sessionId)
      const state = useUnifiedStore.getState()
      const ai = state.data.ai!
      const sessionMessages = ai.messages[targetSessionId] || []

      if (!hasSession(ai, targetSessionId)) return
      if (sessionMessages.length === 0) return

      const newMessages = sessionMessages.map((message) => {
        if (message.id !== id) return message

        const versions = getSafeMessageVersions(message)
        const currentVersionIndex = getSafeCurrentVersionIndex(message, versions)

        if (versions[currentVersionIndex]) {
          versions[currentVersionIndex] = { ...versions[currentVersionIndex], content }
        }

        return {
          ...message,
          content,
          imageSources: extractStoredImageSources(message.role, content),
          versions,
          currentVersionIndex
        }
      })

      state.updateAIData({
        messages: {
          ...ai.messages,
          [targetSessionId]: newMessages
        }
      }, true)

      if (shouldPersistSession(ai, targetSessionId)) {
        scheduleSessionJsonSave(targetSessionId, newMessages)
      }
    },

    updateMessageApiTranscript: (sessionId: string, id: string, apiTranscript: ApiTranscriptMessage[]) => {
      const normalizedApiTranscript = normalizeApiTranscriptMessages(apiTranscript)
      if (!normalizedApiTranscript) return

      const targetSessionId = resolveSessionIdAlias(sessionId)
      const state = useUnifiedStore.getState()
      const ai = state.data.ai!
      const sessionMessages = ai.messages[targetSessionId] || []

      if (!hasSession(ai, targetSessionId)) return
      if (sessionMessages.length === 0) return

      const newMessages = sessionMessages.map((message) => {
        if (message.id !== id) return message

        const versions = getSafeMessageVersions(message)
        const currentVersionIndex = getSafeCurrentVersionIndex(message, versions)

        if (versions[currentVersionIndex]) {
          versions[currentVersionIndex] = { ...versions[currentVersionIndex], apiTranscript: normalizedApiTranscript }
        }

        return {
          ...message,
          apiTranscript: normalizedApiTranscript,
          versions,
          currentVersionIndex
        }
      })

      state.updateAIData({
        messages: {
          ...ai.messages,
          [targetSessionId]: newMessages
        }
      }, true)

      if (shouldPersistSession(ai, targetSessionId)) {
        scheduleSessionJsonSave(targetSessionId, newMessages)
      }
    },

    completeMessage: (sessionId: string, _id: string) => {
      const targetSessionId = resolveSessionIdAlias(sessionId)
      const state = useUnifiedStore.getState()
      const ai = state.data.ai!
      if (!hasSession(ai, targetSessionId)) return
      const sessionMessages = ai.messages[targetSessionId]
      if (sessionMessages && shouldPersistSession(ai, targetSessionId)) {
        void saveSessionJson(targetSessionId, sessionMessages)
      }
    },

    addVersion: (id: string, sessionId?: string) => {
      const state = useUnifiedStore.getState()
      const ai = state.data.ai!
      const rawSessionId = sessionId || useAIUIStore.getState().currentSessionId
      if (!rawSessionId) return
      const targetSessionId = resolveSessionIdAlias(rawSessionId)
      if (!hasSession(ai, targetSessionId)) return

      const sessionMessages = ai.messages[targetSessionId] || []
      let didAddVersion = false
      const newMessages = sessionMessages.map((message) => {
        if (message.id !== id) return message
        if (message.role !== 'assistant') return message

        const versions = getSafeMessageVersions(message)
        versions.push(createMessageVersion('', Date.now(), 'regeneration'))
        const limited = limitMessageVersions(versions, versions.length - 1)
        didAddVersion = true

        return {
          ...message,
          content: '',
          apiTranscript: undefined,
          versions: limited.versions,
          currentVersionIndex: limited.currentVersionIndex
        }
      })

      if (!didAddVersion) return

      state.updateAIData({
        messages: {
          ...ai.messages,
          [targetSessionId]: newMessages
        }
      }, true)

      if (shouldPersistSession(ai, targetSessionId)) {
        saveSessionJson(targetSessionId, newMessages)
      }
    },

    editMessageAndBranch: (sessionId: string, messageId: string, newContent: string) => {
      const targetSessionId = resolveSessionIdAlias(sessionId)
      const state = useUnifiedStore.getState()
      const ai = state.data.ai!
      if (!hasSession(ai, targetSessionId)) return
      const messages = ai.messages[targetSessionId] || []
      const index = messages.findIndex((message) => message.id === messageId)
      if (index === -1) return

      const targetMessage = messages[index]
      if (targetMessage.role !== 'user') return

      const futureMessages = pruneVersionBranchMessages(messages.slice(index + 1))

      const versions = getSafeMessageVersions(targetMessage)
      const currentVersionIndex = getSafeCurrentVersionIndex(targetMessage, versions)

      versions[currentVersionIndex] = {
        ...versions[currentVersionIndex],
        subsequentMessages: futureMessages
      }
      versions.push(createMessageVersion(newContent, Date.now(), 'edit'))
      const limited = limitMessageVersions(versions, versions.length - 1)

      const newMessages = messages.slice(0, index + 1)
      newMessages[index] = {
        ...targetMessage,
        content: newContent,
        apiTranscript: undefined,
        imageSources: extractStoredImageSources(targetMessage.role, newContent),
        versions: limited.versions,
        currentVersionIndex: limited.currentVersionIndex
      }

      state.updateAIData({
        messages: { ...ai.messages, [targetSessionId]: newMessages }
      }, true)

      if (shouldPersistSession(ai, targetSessionId)) {
        saveSessionJson(targetSessionId, newMessages)
      }
    },

    switchMessageVersion: (sessionId: string, messageId: string, targetIndex: number) => {
      const targetSessionId = resolveSessionIdAlias(sessionId)
      const state = useUnifiedStore.getState()
      const ai = state.data.ai!
      if (!hasSession(ai, targetSessionId)) return
      const messages = ai.messages[targetSessionId] || []
      const index = messages.findIndex((message) => message.id === messageId)
      if (index === -1) return

      const targetMessage = messages[index]
      const versions = getSafeMessageVersions(targetMessage)
      const targetVersion = versions[targetIndex]
      if (!targetVersion) return
      if (!canMessageUseVersionKind(targetMessage, targetVersion.kind)) return

      const currentVersionIndex = getSafeCurrentVersionIndex(targetMessage, versions)
      if (currentVersionIndex === targetIndex) return

      const futureMessages = pruneVersionBranchMessages(messages.slice(index + 1))
      versions[currentVersionIndex] = {
        ...versions[currentVersionIndex],
        subsequentMessages: futureMessages
      }

      const restoredFuture = pruneVersionBranchMessages(targetVersion.subsequentMessages || [])
      const limited = limitMessageVersions(versions, targetIndex)
      const newMessages = messages.slice(0, index + 1)
      newMessages[index] = {
        ...targetMessage,
        content: targetVersion.content,
        apiTranscript: targetVersion.apiTranscript,
        imageSources: extractStoredImageSources(targetMessage.role, targetVersion.content),
        currentVersionIndex: limited.currentVersionIndex,
        versions: limited.versions
      }

      const finalMessages = [...newMessages, ...restoredFuture]

      state.updateAIData({
        messages: { ...ai.messages, [targetSessionId]: finalMessages }
      }, true)

      if (shouldPersistSession(ai, targetSessionId)) {
        saveSessionJson(targetSessionId, finalMessages)
      }
    },
  }
}
