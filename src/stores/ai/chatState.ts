import { create } from 'zustand'
import { useUnifiedStore } from '../unified/useUnifiedStore'
import type { ChatMessage, ChatSession } from '@/lib/ai/types'
import { generateId } from '@/lib/id'
import { saveSessionJson } from '@/lib/storage/chatStorage'
import {
  createTemporarySession,
  isTemporarySession,
  isTemporarySessionId,
  stripTemporaryData,
} from '@/lib/ai/temporaryChat'

export interface AIUIState {
  generatingSessions: Record<string, boolean>;
  unreadSessions: Record<string, boolean>;
  error: string | null;
  currentSessionId: string | null;
  temporaryChatEnabled: boolean;
  selectionInitialized: boolean;
  temporaryReturnSessionId: string | null;
  setSessionLoading: (sessionId: string, loading: boolean) => void;
  markSessionUnread: (sessionId: string) => void;
  markSessionRead: (sessionId: string) => void;
  setError: (error: string | null) => void;
  initializeSelection: (selection: { currentSessionId: string | null; temporaryChatEnabled: boolean }) => void;
  setChatSelection: (selection: { currentSessionId: string | null; temporaryChatEnabled: boolean }) => void;
  setCurrentSessionId: (sessionId: string | null) => void;
  setTemporaryChatEnabled: (enabled: boolean) => void;
  setTemporaryReturnSessionId: (sessionId: string | null) => void;
  clearSessionState: (sessionId: string) => void;
}

interface ChatMutationState {
  sessions: ChatSession[];
  messages: Record<string, ChatMessage[]>;
}

interface TemporaryMutationState extends ChatMutationState {
  selectedModelId?: string | null;
  unreadSessionIds?: string[];
}

function uniqueSessionIds(sessionIds: string[]) {
  return Array.from(new Set(sessionIds))
}

export function filterUnreadSessionIds(unreadSessionIds: string[] | undefined, sessionIds: string[]) {
  const allowedIds = new Set(sessionIds)
  return uniqueSessionIds((unreadSessionIds || []).filter((sessionId) => allowedIds.has(sessionId)))
}

export const useAIUIStore = create<AIUIState>((set) => ({
  generatingSessions: {},
  unreadSessions: {},
  error: null,
  currentSessionId: null,
  temporaryChatEnabled: false,
  selectionInitialized: false,
  temporaryReturnSessionId: null,
  setSessionLoading: (id, loading) => set((state) => {
    const generatingSessions = { ...state.generatingSessions }
    if (loading) {
      generatingSessions[id] = true
    } else {
      delete generatingSessions[id]
    }
    return { generatingSessions }
  }),
  markSessionUnread: (id) => {
    set((state) => ({
      unreadSessions: { ...state.unreadSessions, [id]: true }
    }))

    const store = useUnifiedStore.getState()
    const ai = store.data.ai
    if (!ai) {
      return
    }

    const session = ai.sessions.find((item) => item.id === id)
    if (!session || isTemporarySessionId(id) || isTemporarySession(session)) {
      return
    }

    const nextUnreadSessionIds = uniqueSessionIds([...(ai.unreadSessionIds || []), id])
    if (nextUnreadSessionIds.length === (ai.unreadSessionIds || []).length) {
      return
    }

    store.updateAIData({ unreadSessionIds: nextUnreadSessionIds })
  },
  markSessionRead: (id) => {
    set((state) => {
      const newUnread = { ...state.unreadSessions }
      delete newUnread[id]
      return { unreadSessions: newUnread }
    })

    const store = useUnifiedStore.getState()
    const ai = store.data.ai
    if (!ai || !(ai.unreadSessionIds || []).includes(id)) {
      return
    }

    store.updateAIData({
      unreadSessionIds: (ai.unreadSessionIds || []).filter((sessionId) => sessionId !== id)
    })
  },
  setError: (error: string | null) => set({ error }),
  initializeSelection: ({ currentSessionId, temporaryChatEnabled }) => set((state) => (
    state.selectionInitialized
      ? state
      : {
          currentSessionId,
          temporaryChatEnabled,
          selectionInitialized: true,
        }
  )),
  setChatSelection: ({ currentSessionId, temporaryChatEnabled }) => set({
    currentSessionId,
    temporaryChatEnabled,
    selectionInitialized: true,
  }),
  setCurrentSessionId: (currentSessionId) => set({
    currentSessionId,
    selectionInitialized: true,
  }),
  setTemporaryChatEnabled: (temporaryChatEnabled) => set({
    temporaryChatEnabled,
    selectionInitialized: true,
  }),
  setTemporaryReturnSessionId: (sessionId) => set({ temporaryReturnSessionId: sessionId }),
  clearSessionState: (sessionId) => set((state) => {
    const generatingSessions = { ...state.generatingSessions }
    const unreadSessions = { ...state.unreadSessions }
    delete generatingSessions[sessionId]
    delete unreadSessions[sessionId]
    return { generatingSessions, unreadSessions }
  }),
}))

function clearTemporaryUIState(sessionIds: string[]) {
  const uiState = useAIUIStore.getState()
  sessionIds.forEach((id) => uiState.clearSessionState(id))
}

export function stripTemporaryForMutation(ai: ChatMutationState) {
  const stripped = stripTemporaryData(ai)
  clearTemporaryUIState(stripped.temporarySessionIds)
  return stripped
}

export function buildTemporarySessionState(
  stripped: ChatMutationState,
  modelId: string
) {
  const temporarySession = createTemporarySession(modelId)
  return {
    sessions: [temporarySession, ...stripped.sessions],
    messages: { ...stripped.messages, [temporarySession.id]: [] },
    currentSessionId: temporarySession.id
  }
}

export function createAIChatSession(title = 'New Chat'): string {
  const state = useUnifiedStore.getState()
  const ai = state.data.ai! as TemporaryMutationState
  const uiState = useAIUIStore.getState()
  const now = Date.now()

  if (uiState.temporaryChatEnabled) {
    const stripped = stripTemporaryForMutation(ai)
    const temporaryState = buildTemporarySessionState(stripped, ai.selectedModelId || '')

    state.updateAIData({
      sessions: temporaryState.sessions,
      messages: temporaryState.messages,
      unreadSessionIds: filterUnreadSessionIds(ai.unreadSessionIds, temporaryState.sessions.map((session) => session.id))
    })
    uiState.setChatSelection({
      currentSessionId: temporaryState.currentSessionId,
      temporaryChatEnabled: true,
    })
    return temporaryState.currentSessionId
  }

  const id = generateId('session-')
  const newSession: ChatSession = {
    id,
    title,
    modelId: ai.selectedModelId || '',
    createdAt: now,
    updatedAt: now
  }

  state.updateAIData({
    sessions: [newSession, ...ai.sessions],
    messages: { ...ai.messages, [id]: [] },
    unreadSessionIds: filterUnreadSessionIds(ai.unreadSessionIds, [id, ...ai.sessions.map((session) => session.id)])
  })
  uiState.setChatSelection({ currentSessionId: id, temporaryChatEnabled: false })

  saveSessionJson(id, [])
  return id
}
