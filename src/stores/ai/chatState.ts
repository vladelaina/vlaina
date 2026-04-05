import { create } from 'zustand'
import { useUnifiedStore } from '../unified/useUnifiedStore'
import type { ChatMessage, ChatSession } from '@/lib/ai/types'
import { saveSessionJson } from '@/lib/storage/chatStorage'
import {
  createTemporarySession,
  stripTemporaryData,
} from '@/lib/ai/temporaryChat'

export interface AIUIState {
  generatingSessions: Record<string, boolean>;
  unreadSessions: Record<string, boolean>;
  error: string | null;
  temporaryReturnSessionId: string | null;
  setSessionLoading: (sessionId: string, loading: boolean) => void;
  markSessionUnread: (sessionId: string) => void;
  markSessionRead: (sessionId: string) => void;
  setError: (error: string | null) => void;
  setTemporaryReturnSessionId: (sessionId: string | null) => void;
  clearSessionState: (sessionId: string) => void;
}

interface ChatMutationState {
  sessions: ChatSession[];
  messages: Record<string, ChatMessage[]>;
}

interface TemporaryMutationState extends ChatMutationState {
  currentSessionId?: string | null;
  selectedModelId?: string | null;
  temporaryChatEnabled?: boolean;
}

export const useAIUIStore = create<AIUIState>((set) => ({
  generatingSessions: {},
  unreadSessions: {},
  error: null,
  temporaryReturnSessionId: null,
  setSessionLoading: (id, loading) => set((state) => ({
    generatingSessions: { ...state.generatingSessions, [id]: loading }
  })),
  markSessionUnread: (id) => set((state) => ({
    unreadSessions: { ...state.unreadSessions, [id]: true }
  })),
  markSessionRead: (id) => set((state) => {
    const newUnread = { ...state.unreadSessions }
    delete newUnread[id]
    return { unreadSessions: newUnread }
  }),
  setError: (error: string | null) => set({ error }),
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
  const now = Date.now()

  if (ai.temporaryChatEnabled) {
    const stripped = stripTemporaryForMutation(ai)
    const temporaryState = buildTemporarySessionState(stripped, ai.selectedModelId || '')

    state.updateAIData({
      sessions: temporaryState.sessions,
      currentSessionId: temporaryState.currentSessionId,
      messages: temporaryState.messages
    })
    return temporaryState.currentSessionId
  }

  const id = `session-${now}-${Math.random().toString(36).substring(2, 11)}`
  const newSession: ChatSession = {
    id,
    title,
    modelId: ai.selectedModelId || '',
    createdAt: now,
    updatedAt: now
  }

  state.updateAIData({
    sessions: [newSession, ...ai.sessions],
    currentSessionId: id,
    messages: { ...ai.messages, [id]: [] }
  })

  saveSessionJson(id, [])
  return id
}
