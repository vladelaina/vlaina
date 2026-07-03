import type { ApiTranscriptMessage, ChatMessage, MessageVersion } from '@/lib/ai/types'
import { normalizeApiTranscriptMessages } from '@/lib/ai/apiTranscript'
import { generateId } from '@/lib/id'
import {
  cancelSessionJsonSave,
  deleteSessionJson,
  saveSessionJson,
  scheduleSessionJsonSave,
} from '@/lib/storage/chatStorage'
import {
  isTemporarySession,
  isTemporarySessionId,
  needsAutoTitle,
  shouldPersistSession,
} from '@/lib/ai/temporaryChat'
import { resolveSessionIdAlias } from '@/lib/ai/sessionIdAliases'
import {
  MAX_CHAT_MESSAGE_IMAGE_SOURCE_ENTRIES,
  MAX_CHAT_MESSAGE_IMAGE_SOURCES,
} from '@/components/Chat/common/messageClipboard'
import { extractChatMessageImageSources } from '@/lib/ai/chatImageSourcePolicy'
import { stripThinkingContent } from '@/lib/ai/stripThinkingContent'
import { stripWebSearchRequestMarkup } from '@/lib/ai/webSearch/requestMarkup'
import { extractWebSearchStatuses } from '@/lib/ai/webSearch/statusMarkup'
import { requestManager } from '@/lib/ai/requestManager'
import { useUnifiedStore } from '../unified/useUnifiedStore'
import { persistLastChatSessionIdForCurrentWindow, useAIUIStore } from './chatState'

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

function areJsonValuesEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
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

function extractStoredImageSources(content: string): string[] {
  return extractChatMessageImageSources(content, {
    maxSources: MAX_CHAT_MESSAGE_IMAGE_SOURCES,
    maxTokens: MAX_CHAT_MESSAGE_IMAGE_SOURCE_ENTRIES,
    persistable: true,
  })
}

function getNewMessageImageSources(message: Omit<ChatMessage, 'id' | 'timestamp' | 'versions' | 'currentVersionIndex'>): string[] | undefined {
  return extractStoredImageSources(message.content || '')
}

function hasSession(ai: { sessions: Array<{ id: string }> }, sessionId: string): boolean {
  return ai.sessions.some((session) => session.id === sessionId)
}

function hasVisibleAssistantReply(content: string): boolean {
  const withoutWebSearchStatuses = extractWebSearchStatuses(content || '').content
  return stripWebSearchRequestMarkup(stripThinkingContent(withoutWebSearchStatuses)).length > 0
}

const MAX_MESSAGE_VERSIONS = 20
const MAX_VERSION_BRANCH_MESSAGES = 100
const MAX_VERSION_BRANCH_DEPTH = 0
const MAX_MESSAGE_ID_SCAN_NODES = 10000
const MAX_MESSAGE_ID_CHARS = 512
const MAX_MESSAGE_ID_SCAN_BRANCH_DEPTH = 1

function selectMessageIdScanVersions(message: ChatMessage): MessageVersion[] {
  const versions = Array.isArray(message.versions) ? message.versions : []
  if (versions.length <= MAX_MESSAGE_VERSIONS) {
    return versions
  }

  const activeIndex = getSafeCurrentVersionIndex(message, versions)
  const keepIndexes = new Set<number>([activeIndex])
  for (let index = versions.length - 1; index >= 0 && keepIndexes.size < MAX_MESSAGE_VERSIONS; index -= 1) {
    keepIndexes.add(index)
  }

  return Array.from(keepIndexes)
    .sort((left, right) => left - right)
    .map((index) => versions[index]!)
}

function collectSessionMessageIds(messages: ChatMessage[]): Set<string> {
  const ids = new Set<string>()
  const seenMessages = new Set<ChatMessage>()
  const stack: Array<{ depth: number; messages: ChatMessage[] }> = [{ depth: 0, messages }]

  while (stack.length > 0 && seenMessages.size < MAX_MESSAGE_ID_SCAN_NODES) {
    const frame = stack.pop()!
    for (const message of frame.messages) {
      if (seenMessages.size >= MAX_MESSAGE_ID_SCAN_NODES) {
        break
      }
      if (seenMessages.has(message)) {
        continue
      }
      seenMessages.add(message)
      ids.add(message.id)

      if (frame.depth >= MAX_MESSAGE_ID_SCAN_BRANCH_DEPTH) {
        continue
      }

      for (const version of selectMessageIdScanVersions(message)) {
        if (Array.isArray(version.subsequentMessages) && version.subsequentMessages.length > 0) {
          stack.push({
            depth: frame.depth + 1,
            messages: version.subsequentMessages.slice(0, MAX_VERSION_BRANCH_MESSAGES),
          })
        }
      }
    }
  }

  return ids
}

function createUniqueMessageId(messages: ChatMessage[], preferredId?: string): string {
  const existingIds = collectSessionMessageIds(messages)
  const normalizedPreferredId = preferredId?.trim().slice(0, MAX_MESSAGE_ID_CHARS) || ''
  if (normalizedPreferredId && !existingIds.has(normalizedPreferredId)) {
    return normalizedPreferredId
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const id = generateId('msg-')
    if (!existingIds.has(id)) {
      return id
    }
  }

  let fallbackIndex = existingIds.size
  let fallbackId = `msg-${Date.now()}-${fallbackIndex}`
  while (existingIds.has(fallbackId)) {
    fallbackIndex += 1
    fallbackId = `msg-${Date.now()}-${fallbackIndex}`
  }
  return fallbackId
}

interface AddMessageOptions {
  persistUnified?: boolean
  touchSession?: boolean
}

function saveSessionJsonInBackground(sessionId: string, messages: ChatMessage[]) {
  void saveSessionJson(sessionId, messages).catch(() => {})
}

function deleteSessionJsonInBackground(sessionId: string) {
  void deleteSessionJson(sessionId).catch(() => {})
}

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
      const sessionMessages = ai.messages[targetSessionId] || []

      const createdAt = Date.now()
      const id = createUniqueMessageId(sessionMessages, message.id)
      const newMessage: ChatMessage = {
        ...message,
        imageSources: getNewMessageImageSources(message),
        id,
        timestamp: createdAt,
        versions: [createMessageVersion(message.content || '', createdAt, 'original', message.apiTranscript)],
        currentVersionIndex: 0
      }

      const newMessages = [...sessionMessages, newMessage]

      state.updateAIData({
        messages: { ...ai.messages, [targetSessionId]: newMessages },
        sessions: touchSession
          ? ai.sessions.map((session) =>
              session.id === targetSessionId ? { ...session, modelId: message.modelId, updatedAt: Date.now() } : session
            )
          : ai.sessions
      }, !persistUnified)

      if (shouldPersistSession(ai, targetSessionId)) {
        saveSessionJsonInBackground(targetSessionId, newMessages)
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
      const existingMessage = sessionMessages.find((message) => message.id === id)
      if (!existingMessage) return

      const existingVersions = getSafeMessageVersions(existingMessage)
      const existingVersionIndex = getSafeCurrentVersionIndex(existingMessage, existingVersions)
      if (
        existingMessage.content === content &&
        existingVersions[existingVersionIndex]?.content === content
      ) {
        return
      }

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
          imageSources: extractStoredImageSources(content),
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
      const existingMessage = sessionMessages.find((message) => message.id === id)
      if (!existingMessage) return

      const existingVersions = getSafeMessageVersions(existingMessage)
      const existingVersionIndex = getSafeCurrentVersionIndex(existingMessage, existingVersions)
      const normalizedExistingTranscript = normalizeApiTranscriptMessages(existingMessage.apiTranscript)
      const normalizedExistingVersionTranscript = normalizeApiTranscriptMessages(
        existingVersions[existingVersionIndex]?.apiTranscript
      )
      if (
        areJsonValuesEqual(normalizedExistingTranscript, normalizedApiTranscript) &&
        areJsonValuesEqual(normalizedExistingVersionTranscript, normalizedApiTranscript)
      ) {
        return
      }

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

    completeMessage: (sessionId: string, id: string) => {
      const targetSessionId = resolveSessionIdAlias(sessionId)
      const state = useUnifiedStore.getState()
      const ai = state.data.ai!
      if (!hasSession(ai, targetSessionId)) return
      const sessionMessages = ai.messages[targetSessionId]
      if (!sessionMessages?.some((message) => message.id === id)) return
      if (sessionMessages && shouldPersistSession(ai, targetSessionId)) {
        saveSessionJsonInBackground(targetSessionId, sessionMessages)
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
          imageSources: extractStoredImageSources(''),
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
        saveSessionJsonInBackground(targetSessionId, newMessages)
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
        imageSources: extractStoredImageSources(newContent),
        versions: limited.versions,
        currentVersionIndex: limited.currentVersionIndex
      }

      state.updateAIData({
        messages: { ...ai.messages, [targetSessionId]: newMessages }
      }, true)

      if (shouldPersistSession(ai, targetSessionId)) {
        saveSessionJsonInBackground(targetSessionId, newMessages)
      }
    },

    retractPendingUserRequest: (
      sessionId: string,
      userMessageId: string,
      assistantMessageId?: string | null
    ): string | null => {
      const targetSessionId = resolveSessionIdAlias(sessionId)
      const state = useUnifiedStore.getState()
      const ai = state.data.ai!
      if (!hasSession(ai, targetSessionId)) return null
      const messages = ai.messages[targetSessionId] || []
      const userIndex = messages.findIndex((message) => message.id === userMessageId)
      if (userIndex === -1) return null

      const userMessage = messages[userIndex]
      if (userMessage.role !== 'user') return null

      let removeEnd = userIndex + 1
      if (assistantMessageId) {
        const assistantIndex = messages.findIndex((message) => message.id === assistantMessageId)
        if (assistantIndex !== -1) {
          const assistantMessage = messages[assistantIndex]
          if (
            assistantMessage.role !== 'assistant' ||
            assistantIndex !== userIndex + 1 ||
            assistantIndex !== messages.length - 1 ||
            hasVisibleAssistantReply(assistantMessage.content)
          ) {
            return null
          }
          removeEnd = assistantIndex + 1
        }
      }

      if (userIndex !== messages.length - 1 && removeEnd !== messages.length) {
        return null
      }

      const newMessages = [
        ...messages.slice(0, userIndex),
        ...messages.slice(removeEnd),
      ]
      const session = ai.sessions.find((item) => item.id === targetSessionId)
      const currentSessionId = useAIUIStore.getState().currentSessionId
      const shouldRollbackSessionToNewChat =
        newMessages.length === 0 &&
        userIndex === 0 &&
        currentSessionId !== null &&
        resolveSessionIdAlias(currentSessionId) === targetSessionId &&
        needsAutoTitle(session?.title) &&
        !isTemporarySessionId(targetSessionId) &&
        !isTemporarySession(session)

      if (shouldRollbackSessionToNewChat) {
        const nextMessages = { ...ai.messages }
        delete nextMessages[targetSessionId]
        cancelSessionJsonSave(targetSessionId)
        requestManager.abort(targetSessionId)
        useAIUIStore.getState().clearSessionState(targetSessionId)
        useAIUIStore.getState().setChatSelection({
          currentSessionId: null,
          temporaryChatEnabled: false,
        })
        persistLastChatSessionIdForCurrentWindow(null)

        state.updateAIData({
          sessions: ai.sessions.filter((item) => item.id !== targetSessionId),
          messages: nextMessages,
          unreadSessionIds: (ai.unreadSessionIds || []).filter((id) => id !== targetSessionId),
        })
        deleteSessionJsonInBackground(targetSessionId)
        return userMessage.content
      }

      state.updateAIData({
        messages: { ...ai.messages, [targetSessionId]: newMessages }
      }, true)

      if (shouldPersistSession(ai, targetSessionId)) {
        saveSessionJsonInBackground(targetSessionId, newMessages)
      }

      return userMessage.content
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
        imageSources: extractStoredImageSources(targetVersion.content),
        currentVersionIndex: limited.currentVersionIndex,
        versions: limited.versions
      }

      const finalMessages = [...newMessages, ...restoredFuture]

      state.updateAIData({
        messages: { ...ai.messages, [targetSessionId]: finalMessages }
      }, true)

      if (shouldPersistSession(ai, targetSessionId)) {
        saveSessionJsonInBackground(targetSessionId, finalMessages)
      }
    },
  }
}
