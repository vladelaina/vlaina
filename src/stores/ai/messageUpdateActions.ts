import type { ApiTranscriptMessage } from '@/lib/ai/types'
import { normalizeApiTranscriptMessages } from '@/lib/ai/apiTranscript'
import { scheduleSessionJsonSave } from '@/lib/storage/chatStorage'
import { shouldPersistSession } from '@/lib/ai/temporaryChat'
import { resolveSessionIdAlias } from '@/lib/ai/sessionIdAliases'
import { useUnifiedStore } from '../unified/useUnifiedStore'
import {
  areJsonValuesEqual,
  extractStoredImageSources,
  getSafeCurrentVersionIndex,
  getSafeMessageVersions,
  hasSession,
} from './messageActionUtils'
import { sanitizeWebSearchStatuses } from '@/lib/ai/webSearch/status'
import type { WebSearchStatus } from '@/lib/ai/webSearch/types'

function findMessageIndexFromEnd(messages: readonly { id: string }[], id: string): number {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.id === id) {
      return index
    }
  }
  return -1
}

export function updateMessageAction(sessionId: string, id: string, content: string): void {
  const targetSessionId = resolveSessionIdAlias(sessionId)
  const state = useUnifiedStore.getState()
  const ai = state.data.ai!
  const sessionMessages = ai.messages[targetSessionId] || []

  if (!hasSession(ai, targetSessionId)) return
  if (sessionMessages.length === 0) return
  const messageIndex = findMessageIndexFromEnd(sessionMessages, id)
  const existingMessage = sessionMessages[messageIndex]
  if (!existingMessage) return

  const existingVersions = getSafeMessageVersions(existingMessage)
  const existingVersionIndex = getSafeCurrentVersionIndex(existingMessage, existingVersions)
  if (
    existingMessage.content === content &&
    existingVersions[existingVersionIndex]?.content === content
  ) {
    return
  }

  const versions = getSafeMessageVersions(existingMessage)
  const currentVersionIndex = getSafeCurrentVersionIndex(existingMessage, versions)

  if (versions[currentVersionIndex]) {
    versions[currentVersionIndex] = { ...versions[currentVersionIndex], content }
  }

  const newMessages = sessionMessages.slice()
  newMessages[messageIndex] = {
    ...existingMessage,
    content,
    imageSources: extractStoredImageSources(content),
    versions,
    currentVersionIndex
  }

  state.updateAIData({
    messages: {
      ...ai.messages,
      [targetSessionId]: newMessages
    }
  }, true)

  if (shouldPersistSession(ai, targetSessionId)) {
    scheduleSessionJsonSave(targetSessionId, newMessages)
  }
}

export function updateMessageApiTranscriptAction(
  sessionId: string,
  id: string,
  apiTranscript: ApiTranscriptMessage[]
): void {
  const normalizedApiTranscript = normalizeApiTranscriptMessages(apiTranscript)
  if (!normalizedApiTranscript) return

  const targetSessionId = resolveSessionIdAlias(sessionId)
  const state = useUnifiedStore.getState()
  const ai = state.data.ai!
  const sessionMessages = ai.messages[targetSessionId] || []

  if (!hasSession(ai, targetSessionId)) return
  if (sessionMessages.length === 0) return
  const messageIndex = findMessageIndexFromEnd(sessionMessages, id)
  const existingMessage = sessionMessages[messageIndex]
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

  const versions = getSafeMessageVersions(existingMessage)
  const currentVersionIndex = getSafeCurrentVersionIndex(existingMessage, versions)

  if (versions[currentVersionIndex]) {
    versions[currentVersionIndex] = { ...versions[currentVersionIndex], apiTranscript: normalizedApiTranscript }
  }

  const newMessages = sessionMessages.slice()
  newMessages[messageIndex] = {
    ...existingMessage,
    apiTranscript: normalizedApiTranscript,
    versions,
    currentVersionIndex
  }

  state.updateAIData({
    messages: {
      ...ai.messages,
      [targetSessionId]: newMessages
    }
  }, true)

  if (shouldPersistSession(ai, targetSessionId)) {
    scheduleSessionJsonSave(targetSessionId, newMessages)
  }
}

export function updateMessageWebSearchStatusAction(
  sessionId: string,
  id: string,
  status: WebSearchStatus,
): void {
  const [normalizedStatus] = sanitizeWebSearchStatuses([status])
  if (!normalizedStatus) return

  const targetSessionId = resolveSessionIdAlias(sessionId)
  const state = useUnifiedStore.getState()
  const ai = state.data.ai!
  const sessionMessages = ai.messages[targetSessionId] || []

  if (!hasSession(ai, targetSessionId)) return
  const messageIndex = findMessageIndexFromEnd(sessionMessages, id)
  const existingMessage = sessionMessages[messageIndex]
  if (!existingMessage) return

  const statuses = sanitizeWebSearchStatuses([
    ...(existingMessage.webSearchStatuses || []),
    normalizedStatus,
  ])
  const versions = getSafeMessageVersions(existingMessage)
  const currentVersionIndex = getSafeCurrentVersionIndex(existingMessage, versions)
  if (versions[currentVersionIndex]) {
    versions[currentVersionIndex] = {
      ...versions[currentVersionIndex],
      webSearchStatuses: statuses,
    }
  }

  const newMessages = sessionMessages.slice()
  newMessages[messageIndex] = {
    ...existingMessage,
    webSearchStatuses: statuses,
    versions,
    currentVersionIndex,
  }

  state.updateAIData({
    messages: {
      ...ai.messages,
      [targetSessionId]: newMessages,
    },
  }, true)
}
