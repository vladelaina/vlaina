import type { ChatMessage, MessageVersion } from '@/lib/ai/types'
import { generateId } from '@/lib/id'
import {
  saveSessionJson,
  scheduleSessionJsonSave,
} from '@/lib/storage/chatStorage'
import { shouldPersistSession } from '@/lib/ai/temporaryChat'
import { extractMessageImageSources } from '@/components/Chat/common/messageClipboard'
import { useUnifiedStore } from '../unified/useUnifiedStore'
import { useAIUIStore } from './chatState'

function createMessageVersion(content: string, createdAt: number): MessageVersion {
  return {
    content,
    createdAt,
    subsequentMessages: []
  }
}

interface AddMessageOptions {
  persistUnified?: boolean
  touchSession?: boolean
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
        versions: [createMessageVersion(message.content || '', createdAt)],
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

        const currentVersionIndex = message.currentVersionIndex
        const versions = [...message.versions]

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
    },

    addVersion: (id: string, sessionId?: string) => {
      const state = useUnifiedStore.getState()
      const ai = state.data.ai!
      const targetSessionId = sessionId || useAIUIStore.getState().currentSessionId
      if (!targetSessionId) return

      const sessionMessages = ai.messages[targetSessionId] || []
      const newMessages = sessionMessages.map((message) => {
        if (message.id !== id) return message

        const versions = [...message.versions]
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
      const futureMessages = messages.slice(index + 1)

      const currentVersionIndex = targetMessage.currentVersionIndex
      const versions = [...targetMessage.versions]

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
      if (!targetMessage.versions[targetIndex]) return

      const currentVersionIndex = targetMessage.currentVersionIndex
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
      }, true)

      if (shouldPersistSession(ai, sessionId)) {
        saveSessionJson(sessionId, finalMessages)
      }
    },
  }
}
