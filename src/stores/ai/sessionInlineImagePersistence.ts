import type { ChatMessage } from '@/lib/ai/types'
import {
  createStoredAttachmentFromSource,
  deleteAttachment,
  persistDataUrlAttachment,
} from '@/lib/storage/attachmentStorage'
import { saveSessionJson } from '@/lib/storage/chatStorage'
import { useUnifiedStore } from '../unified/useUnifiedStore'
import {
  MAX_INLINE_IMAGE_ORPHAN_DELETE_CONCURRENCY,
  MAX_INLINE_IMAGE_PERSISTENCE_PENDING_SESSIONS,
} from './sessionInlineImageConstants'
import { applyImageSourceReplacements } from './sessionInlineImageReplacement'
import {
  collectInlineImageSources,
  hasInlineImageSourcesOutsideProcessedSet,
  hasMarkdownInlineDataImageHint,
} from './sessionInlineImageSources'

const inlineImagePersistenceSessions = new Set<string>()
const inlineImagePersistenceRerunSessions = new Set<string>()
const inlineImagePersistenceScheduledSessions = new Set<string>()

function saveSessionJsonInBackground(sessionId: string, messages: ChatMessage[]) {
  void saveSessionJson(sessionId, messages).catch(() => {})
}

function hasChatSession(sessionId: string): boolean {
  return useUnifiedStore.getState().data.ai?.sessions.some((session) => session.id === sessionId) === true
}

async function deleteStoredAttachmentSource(source: string) {
  const attachment = createStoredAttachmentFromSource(source)
  if (!attachment) {
    return
  }
  await deleteAttachment(attachment).catch(() => {})
}

async function deleteStoredAttachmentSources(sources: readonly string[]) {
  await settleWithConcurrencyLimit(
    sources,
    MAX_INLINE_IMAGE_ORPHAN_DELETE_CONCURRENCY,
    deleteStoredAttachmentSource
  )
}

export async function settleWithConcurrencyLimit<T>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
): Promise<PromiseSettledResult<void>[]> {
  const results = new Array<PromiseSettledResult<void>>(items.length)
  let nextIndex = 0
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (nextIndex < items.length) {
        const index = nextIndex
        nextIndex += 1
        try {
          await worker(items[index]!)
          results[index] = { status: 'fulfilled', value: undefined }
        } catch (reason) {
          results[index] = { status: 'rejected', reason }
        }
      }
    }
  )
  await Promise.all(workers)
  return results
}

async function persistInlineImageSourcesForSession(sessionId: string) {
  if (inlineImagePersistenceSessions.has(sessionId)) {
    inlineImagePersistenceRerunSessions.add(sessionId)
    return
  }
  if (inlineImagePersistenceSessions.size >= MAX_INLINE_IMAGE_PERSISTENCE_PENDING_SESSIONS) {
    return
  }

  inlineImagePersistenceSessions.add(sessionId)
  try {
    const state = useUnifiedStore.getState()
    const ai = state.data.ai!
    const messages = ai.messages[sessionId] || []
    const sources = collectInlineImageSources(messages)
    if (sources.size === 0) {
      const scrubContext = { changed: false, messageNodes: 0 }
      const scrubbedMessages = applyImageSourceReplacements(messages, new Map(), scrubContext)
      if (scrubContext.changed && hasChatSession(sessionId)) {
        const latest = useUnifiedStore.getState()
        const latestAi = latest.data.ai!
        latest.updateAIData({
          messages: {
            ...latestAi.messages,
            [sessionId]: scrubbedMessages,
          },
        }, true)
        saveSessionJsonInBackground(sessionId, scrubbedMessages)
      }
      return
    }

    const replacements = new Map<string, string>()
    const persistedSources: string[] = []
    for (const [source, aliases] of sources) {
      if (!hasChatSession(sessionId)) {
        await deleteStoredAttachmentSources(persistedSources)
        return
      }
      const persistedSource = await persistDataUrlAttachment(source).catch(() => null)
      if (persistedSource) {
        persistedSources.push(persistedSource)
        aliases.forEach((alias) => replacements.set(alias, persistedSource))
      }
    }

    if (replacements.size === 0) {
      return
    }

    const latestState = useUnifiedStore.getState()
    const latestAI = latestState.data.ai!
    if (!latestAI.sessions.some((session) => session.id === sessionId)) {
      await deleteStoredAttachmentSources(persistedSources)
      return
    }
    const latestMessages = latestAI.messages[sessionId] || []
    const nextMessages = applyImageSourceReplacements(latestMessages, replacements)
    if (hasMarkdownInlineDataImageHint(nextMessages) && hasInlineImageSourcesOutsideProcessedSet(nextMessages, sources)) {
      inlineImagePersistenceRerunSessions.add(sessionId)
      globalThis.setTimeout(() => {
        persistInlineImageSourcesForSessionInBackground(sessionId)
      }, 0)
    }

    latestState.updateAIData({
      messages: {
        ...latestAI.messages,
        [sessionId]: nextMessages,
      },
    }, true)
    saveSessionJsonInBackground(sessionId, nextMessages)
  } finally {
    inlineImagePersistenceSessions.delete(sessionId)
    if (inlineImagePersistenceRerunSessions.delete(sessionId)) {
      persistInlineImageSourcesForSessionInBackground(sessionId)
    }
  }
}

export function persistInlineImageSourcesForSessionInBackground(sessionId: string) {
  void persistInlineImageSourcesForSession(sessionId).catch(() => {})
}

export function scheduleInlineImagePersistence(sessionId: string) {
  if (inlineImagePersistenceSessions.has(sessionId)) {
    inlineImagePersistenceRerunSessions.add(sessionId)
    return
  }
  if (inlineImagePersistenceScheduledSessions.has(sessionId)) {
    return
  }
  if (
    inlineImagePersistenceSessions.size + inlineImagePersistenceScheduledSessions.size >=
    MAX_INLINE_IMAGE_PERSISTENCE_PENDING_SESSIONS
  ) {
    return
  }

  inlineImagePersistenceScheduledSessions.add(sessionId)
  globalThis.setTimeout(() => {
    inlineImagePersistenceScheduledSessions.delete(sessionId)
    persistInlineImageSourcesForSessionInBackground(sessionId)
  }, 0)
}
