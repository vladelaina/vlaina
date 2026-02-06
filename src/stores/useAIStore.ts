import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Provider, AIModel, ChatMessage, ChatSession } from '@/lib/ai/types'
import { generateModelName, generateModelGroup } from '@/lib/ai/utils'

interface AIStore {
  providers: Provider[]
  models: AIModel[]
  
  // Session Management
  sessions: ChatSession[]
  currentSessionId: string | null
  messages: Record<string, ChatMessage[]> // Key: sessionId
  
  // UI State
  selectedModelId: string | null
  isLoading: boolean
  error: string | null

  // Provider Actions
  addProvider: (provider: Omit<Provider, 'id' | 'createdAt' | 'updatedAt'>) => string
  updateProvider: (id: string, updates: Partial<Provider>) => void
  deleteProvider: (id: string) => void
  getProvider: (id: string) => Provider | undefined

  // Model Actions
  addModel: (model: Omit<AIModel, 'createdAt'>) => void
  addModels: (models: Array<Omit<AIModel, 'createdAt'>>) => void
  updateModel: (id: string, updates: Partial<AIModel>) => void
  deleteModel: (id: string) => void
  getModel: (id: string) => AIModel | undefined
  getModelsByProvider: (providerId: string) => AIModel[]

  // Selection
  selectModel: (modelId: string | null) => void
  getSelectedModel: () => AIModel | undefined

  // Session Actions
  createSession: (title?: string) => string
  switchSession: (sessionId: string) => void
  updateSession: (id: string, updates: Partial<ChatSession>) => void
  deleteSession: (id: string) => void
  clearSessions: () => void

  // Message Actions (Targeting current session)
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void
  updateMessage: (id: string, content: string) => void
  clearMessages: () => void // Clears current session messages

  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

export const useAIStore = create<AIStore>()(
  persist(
    (set, get) => ({
      providers: [],
      models: [],
      sessions: [],
      currentSessionId: null,
      messages: {}, // Map sessionId -> messages
      selectedModelId: null,
      isLoading: false,
      error: null,

      addProvider: (provider) => {
        const id = `provider-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
        const now = Date.now()
        const newProvider: Provider = {
          ...provider,
          id,
          createdAt: now,
          updatedAt: now
        }
        set((state) => ({
          providers: [...state.providers, newProvider]
        }))
        return id
      },

      updateProvider: (id, updates) => {
        set((state) => ({
          providers: state.providers.map((p) =>
            p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p
          )
        }))
      },

      deleteProvider: (id) => {
        set((state) => ({
          providers: state.providers.filter((p) => p.id !== id),
          models: state.models.filter((m) => m.providerId !== id),
          selectedModelId: state.selectedModelId && 
            state.models.find(m => m.id === state.selectedModelId)?.providerId === id
            ? null
            : state.selectedModelId
        }))
      },

      getProvider: (id) => {
        return get().providers.find((p) => p.id === id)
      },

      addModel: (model) => {
        const newModel: AIModel = {
          ...model,
          name: model.name || generateModelName(model.id),
          group: model.group || generateModelGroup(model.id),
          createdAt: Date.now()
        }
        set((state) => ({
          models: [...state.models, newModel]
        }))
      },

      addModels: (models) => {
        const now = Date.now()
        const newModels: AIModel[] = models.map((model) => ({
          ...model,
          name: model.name || generateModelName(model.id),
          group: model.group || generateModelGroup(model.id),
          createdAt: now
        }))
        set((state) => ({
          models: [...state.models, ...newModels]
        }))
      },

      updateModel: (id, updates) => {
        set((state) => ({
          models: state.models.map((m) =>
            m.id === id ? { ...m, ...updates } : m
          )
        }))
      },

      deleteModel: (id) => {
        set((state) => ({
          models: state.models.filter((m) => m.id !== id),
          selectedModelId: state.selectedModelId === id ? null : state.selectedModelId
        }))
      },

      getModel: (id) => {
        return get().models.find((m) => m.id === id)
      },

      getModelsByProvider: (providerId) => {
        return get().models.filter((m) => m.providerId === providerId && m.enabled)
      },

      selectModel: (modelId) => {
        set({ selectedModelId: modelId })
      },

      getSelectedModel: () => {
        const { selectedModelId, models } = get()
        if (!selectedModelId) return undefined
        return models.find((m) => m.id === selectedModelId)
      },

      // --- Session Logic ---

      createSession: (title = 'New Chat') => {
        const id = `session-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
        const { selectedModelId } = get()
        
        const newSession: ChatSession = {
          id,
          title,
          modelId: selectedModelId || '',
          createdAt: Date.now(),
          updatedAt: Date.now()
        }

        set((state) => ({
          sessions: [newSession, ...state.sessions],
          currentSessionId: id,
          messages: { ...state.messages, [id]: [] }
        }))
        
        return id
      },

      switchSession: (sessionId) => {
        set({ currentSessionId: sessionId })
      },

      updateSession: (id, updates) => {
        set((state) => ({
          sessions: state.sessions.map((s) => 
            s.id === id ? { ...s, ...updates, updatedAt: Date.now() } : s
          )
        }))
      },

      deleteSession: (id) => {
        set((state) => {
          const newSessions = state.sessions.filter(s => s.id !== id);
          const newMessages = { ...state.messages };
          delete newMessages[id];
          
          return {
            sessions: newSessions,
            messages: newMessages,
            currentSessionId: state.currentSessionId === id 
              ? (newSessions[0]?.id || null) 
              : state.currentSessionId
          }
        })
      },

      clearSessions: () => {
        set({ sessions: [], messages: {}, currentSessionId: null })
      },

      addMessage: (message) => {
        const { currentSessionId } = get();
        if (!currentSessionId) return;

        const newMessage: ChatMessage = {
          ...message,
          id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
          timestamp: Date.now()
        }

        set((state) => {
          const sessionMessages = state.messages[currentSessionId] || [];
          return {
            messages: {
              ...state.messages,
              [currentSessionId]: [...sessionMessages, newMessage]
            },
            // Update session timestamp
            sessions: state.sessions.map(s => 
              s.id === currentSessionId ? { ...s, updatedAt: Date.now() } : s
            )
          }
        })
      },

      updateMessage: (id, content) => {
        const { currentSessionId } = get();
        if (!currentSessionId) return;

        set((state) => {
          const sessionMessages = state.messages[currentSessionId] || [];
          return {
            messages: {
              ...state.messages,
              [currentSessionId]: sessionMessages.map(m => 
                m.id === id ? { ...m, content } : m
              )
            }
          }
        })
      },

      clearMessages: () => {
        const { currentSessionId } = get();
        if (!currentSessionId) return;
        
        set((state) => ({
          messages: {
            ...state.messages,
            [currentSessionId]: []
          }
        }))
      },

      setLoading: (loading) => {
        set({ isLoading: loading })
      },

      setError: (error) => {
        set({ error })
      }
    }),
    {
      name: 'nekotick-ai-config',
      partialize: (state) => ({
        providers: state.providers,
        models: state.models,
        sessions: state.sessions,
        messages: state.messages,
        currentSessionId: state.currentSessionId,
        selectedModelId: state.selectedModelId
      })
    }
  )
)