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

export function updateMessageAction(sessionId: string, id: string, content: string): void {
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
}
