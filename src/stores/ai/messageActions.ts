import type { ApiTranscriptMessage, ChatMessage, MessageVersion } from '@/lib/ai/types'
import { normalizeApiTranscriptMessages } from '@/lib/ai/apiTranscript'
import { generateId } from '@/lib/id'
import {
  saveSessionJson,
  scheduleSessionJsonSave,
} from '@/lib/storage/chatStorage'
import { shouldPersistSession } from '@/lib/ai/temporaryChat'
import { extractMessageImageSources } from '@/components/Chat/common/messageClipboard'
import { useUnifiedStore } from '../unified/useUnifiedStore'
import { useAIUIStore } from './chatState'

function createMessageVersion(content: string, createdAt: number, apiTranscript?: ApiTranscriptMessage[]): MessageVersion {
  const normalizedApiTranscript = normalizeApiTranscriptMessages(apiTranscript)
  return {
    content,
    createdAt,
    subsequentMessages: [],
    ...(normalizedApiTranscript ? { apiTranscript: normalizedApiTranscript } : {})
  }
}

function getSafeMessageVersions(message: ChatMessage): MessageVersion[] {
  if (Array.isArray(message.versions) && message.versions.length > 0) {
    return [...message.versions]
  }

  return [createMessageVersion(message.content || '', message.timestamp || Date.now(), message.apiTranscript)]
}

function getSafeCurrentVersionIndex(message: ChatMessage, versions: MessageVersion[]): number {
  const index = Number.isInteger(message.currentVersionIndex) ? message.currentVersionIndex : 0
  return index >= 0 && index < versions.length ? index : 0
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
      const targetSessionId = sessionId || useAIUIStore.getState().currentSessionId
      if (!targetSessionId) return
      const persistUnified = options?.persistUnified !== false
      const touchSession = options?.touchSession !== false

      const createdAt = Date.now()
      const newMessage: ChatMessage = {
        ...message,
        imageSources:
          message.role === 'user'
            ? (message.imageSources && message.imageSources.length > 0
                ? message.imageSources
                : extractMessageImageSources(message.content || ''))
            : message.imageSources,
        id: message.id || generateId('msg-'),
        timestamp: createdAt,
        versions: [createMessageVersion(message.content || '', createdAt, message.apiTranscript)],
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
      const state = useUnifiedStore.getState()
      const ai = state.data.ai!
      const sessionMessages = ai.messages[sessionId] || []

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
          imageSources: extractMessageImageSources(content),
          versions,
          currentVersionIndex
        }
      })

      state.updateAIData({
        messages: {
          ...ai.messages,
          [sessionId]: newMessages
        }
      }, true)

      if (shouldPersistSession(ai, sessionId)) {
        scheduleSessionJsonSave(sessionId, newMessages)
      }
    },

    updateMessageApiTranscript: (sessionId: string, id: string, apiTranscript: ApiTranscriptMessage[]) => {
      const normalizedApiTranscript = normalizeApiTranscriptMessages(apiTranscript)
      if (!normalizedApiTranscript) return

      const state = useUnifiedStore.getState()
      const ai = state.data.ai!
      const sessionMessages = ai.messages[sessionId] || []

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
          [sessionId]: newMessages
        }
      }, true)

      if (shouldPersistSession(ai, sessionId)) {
        scheduleSessionJsonSave(sessionId, newMessages)
      }
    },

    completeMessage: (sessionId: string, _id: string) => {
      const state = useUnifiedStore.getState()
      const ai = state.data.ai!
      const sessionMessages = ai.messages[sessionId]
      if (sessionMessages && shouldPersistSession(ai, sessionId)) {
        void saveSessionJson(sessionId, sessionMessages)
      }
    },

    addVersion: (id: string, sessionId?: string) => {
      const state = useUnifiedStore.getState()
      const ai = state.data.ai!
      const targetSessionId = sessionId || useAIUIStore.getState().currentSessionId
      if (!targetSessionId) return

      const sessionMessages = ai.messages[targetSessionId] || []
      const newMessages = sessionMessages.map((message) => {
        if (message.id !== id) return message

        const versions = getSafeMessageVersions(message)
        versions.push(createMessageVersion('', Date.now()))
        const limited = limitMessageVersions(versions, versions.length - 1)

        return {
          ...message,
          content: '',
          apiTranscript: undefined,
          versions: limited.versions,
          currentVersionIndex: limited.currentVersionIndex
        }
      })

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
      const state = useUnifiedStore.getState()
      const ai = state.data.ai!
      const messages = ai.messages[sessionId] || []
      const index = messages.findIndex((message) => message.id === messageId)
      if (index === -1) return

      const targetMessage = messages[index]
      const futureMessages = pruneVersionBranchMessages(messages.slice(index + 1))

      const versions = getSafeMessageVersions(targetMessage)
      const currentVersionIndex = getSafeCurrentVersionIndex(targetMessage, versions)

      versions[currentVersionIndex] = {
        ...versions[currentVersionIndex],
        subsequentMessages: futureMessages
      }
      versions.push(createMessageVersion(newContent, Date.now()))
      const limited = limitMessageVersions(versions, versions.length - 1)

      const newMessages = messages.slice(0, index + 1)
      newMessages[index] = {
        ...targetMessage,
        content: newContent,
        apiTranscript: undefined,
        imageSources: extractMessageImageSources(newContent),
        versions: limited.versions,
        currentVersionIndex: limited.currentVersionIndex
      }

      state.updateAIData({
        messages: { ...ai.messages, [sessionId]: newMessages }
      }, true)

      if (shouldPersistSession(ai, sessionId)) {
        saveSessionJson(sessionId, newMessages)
      }
    },

    switchMessageVersion: (sessionId: string, messageId: string, targetIndex: number) => {
      const state = useUnifiedStore.getState()
      const ai = state.data.ai!
      const messages = ai.messages[sessionId] || []
      const index = messages.findIndex((message) => message.id === messageId)
      if (index === -1) return

      const targetMessage = messages[index]
      const versions = getSafeMessageVersions(targetMessage)
      if (!versions[targetIndex]) return

      const currentVersionIndex = getSafeCurrentVersionIndex(targetMessage, versions)
      if (currentVersionIndex === targetIndex) return

      const futureMessages = pruneVersionBranchMessages(messages.slice(index + 1))
      versions[currentVersionIndex] = {
        ...versions[currentVersionIndex],
        subsequentMessages: futureMessages
      }

      const restoredFuture = pruneVersionBranchMessages(versions[targetIndex].subsequentMessages || [])
      const limited = limitMessageVersions(versions, targetIndex)
      const newMessages = messages.slice(0, index + 1)
      newMessages[index] = {
        ...targetMessage,
        content: versions[targetIndex].content,
        apiTranscript: versions[targetIndex].apiTranscript,
        imageSources: extractMessageImageSources(versions[targetIndex].content),
        currentVersionIndex: limited.currentVersionIndex,
        versions: limited.versions
      }

      const finalMessages = [...newMessages, ...restoredFuture]

      state.updateAIData({
        messages: { ...ai.messages, [sessionId]: finalMessages }
      }, true)

      if (shouldPersistSession(ai, sessionId)) {
        saveSessionJson(sessionId, finalMessages)
      }
    },
  }
}
