import type { ChatMessage, MessageVersion } from '@/lib/ai/types'
import {
  saveSessionJson,
  scheduleSessionJsonSave,
} from '@/lib/storage/chatStorage'
import { shouldPersistSession } from '@/lib/ai/temporaryChat'
import { extractMessageImageSources } from '@/components/Chat/common/messageClipboard'
import { useUnifiedStore } from '../unified/useUnifiedStore'

function createMessageVersion(content: string, createdAt: number): MessageVersion {
  return {
    content,
    createdAt,
    subsequentMessages: []
  }
}

export function createMessageActions() {
  return {
    addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'> & { id?: string }) => {
      const state = useUnifiedStore.getState()
      const ai = state.data.ai!
      const { currentSessionId } = ai
      if (!currentSessionId) return

      const createdAt = Date.now()
      const newMessage: ChatMessage = {
        ...message,
        imageSources:
          message.role === 'user'
            ? (message.imageSources && message.imageSources.length > 0
                ? message.imageSources
                : extractMessageImageSources(message.content || ''))
            : message.imageSources,
        id: message.id || `msg-${createdAt}-${Math.random().toString(36).substring(2, 11)}`,
        timestamp: createdAt,
        versions: [createMessageVersion(message.content || '', createdAt)],
        currentVersionIndex: 0
      }

      const sessionMessages = ai.messages[currentSessionId] || []
      const newMessages = [...sessionMessages, newMessage]

      state.updateAIData({
        messages: { ...ai.messages, [currentSessionId]: newMessages },
        sessions: ai.sessions.map((session) =>
          session.id === currentSessionId ? { ...session, updatedAt: Date.now() } : session
        )
      })

      if (shouldPersistSession(ai, currentSessionId)) {
        saveSessionJson(currentSessionId, newMessages)
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

        const currentVersionIndex = message.currentVersionIndex ?? 0
        const versions = message.versions
          ? [...message.versions]
          : [createMessageVersion(message.content, message.timestamp)]

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

    completeMessage: (sessionId: string, _id: string) => {
      const state = useUnifiedStore.getState()
      const ai = state.data.ai!
      const sessionMessages = ai.messages[sessionId]
      if (sessionMessages && shouldPersistSession(ai, sessionId)) {
        void saveSessionJson(sessionId, sessionMessages)
      }
      state.updateAIData({})
    },

    addVersion: (id: string) => {
      const state = useUnifiedStore.getState()
      const ai = state.data.ai!
      const { currentSessionId } = ai
      if (!currentSessionId) return

      const sessionMessages = ai.messages[currentSessionId] || []
      const newMessages = sessionMessages.map((message) => {
        if (message.id !== id) return message

        const versions = message.versions
          ? [...message.versions]
          : [createMessageVersion(typeof message.content === 'string' ? message.content : '', message.timestamp)]
        versions.push(createMessageVersion('', Date.now()))

        return {
          ...message,
          content: '',
          versions,
          currentVersionIndex: versions.length - 1
        }
      })

      state.updateAIData({
        messages: {
          ...ai.messages,
          [currentSessionId]: newMessages
        }
      })

      if (shouldPersistSession(ai, currentSessionId)) {
        saveSessionJson(currentSessionId, newMessages)
      }
    },

    editMessageAndBranch: (sessionId: string, messageId: string, newContent: string) => {
      const state = useUnifiedStore.getState()
      const ai = state.data.ai!
      const messages = ai.messages[sessionId] || []
      const index = messages.findIndex((message) => message.id === messageId)
      if (index === -1) return

      const targetMessage = messages[index]
      const futureMessages = messages.slice(index + 1)

      const currentVersionIndex = targetMessage.currentVersionIndex ?? 0
      const versions = targetMessage.versions
        ? [...targetMessage.versions]
        : [createMessageVersion(targetMessage.content, targetMessage.timestamp)]

      versions[currentVersionIndex] = {
        ...versions[currentVersionIndex],
        subsequentMessages: futureMessages
      }
      versions.push(createMessageVersion(newContent, Date.now()))

      const newMessages = messages.slice(0, index + 1)
      newMessages[index] = {
        ...targetMessage,
        content: newContent,
        imageSources: extractMessageImageSources(newContent),
        versions,
        currentVersionIndex: versions.length - 1
      }

      state.updateAIData({
        messages: { ...ai.messages, [sessionId]: newMessages }
      })

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
      if (!targetMessage.versions || !targetMessage.versions[targetIndex]) return

      const currentVersionIndex = targetMessage.currentVersionIndex ?? 0
      if (currentVersionIndex === targetIndex) return

      const futureMessages = messages.slice(index + 1)
      const versions = [...targetMessage.versions]
      versions[currentVersionIndex] = {
        ...versions[currentVersionIndex],
        subsequentMessages: futureMessages
      }

      const restoredFuture = versions[targetIndex].subsequentMessages || []
      const newMessages = messages.slice(0, index + 1)
      newMessages[index] = {
        ...targetMessage,
        content: versions[targetIndex].content,
        imageSources: extractMessageImageSources(versions[targetIndex].content),
        currentVersionIndex: targetIndex,
        versions
      }

      const finalMessages = [...newMessages, ...restoredFuture]

      state.updateAIData({
        messages: { ...ai.messages, [sessionId]: finalMessages }
      })

      if (shouldPersistSession(ai, sessionId)) {
        saveSessionJson(sessionId, finalMessages)
      }
    },
  }
}
