import { create } from 'zustand'
import { useEffect } from 'react'
import { useUnifiedStore } from './useUnifiedStore'
import type { Provider, AIModel, ChatMessage, ChatSession } from '@/lib/ai/types'
import { generateModelName, generateModelGroup } from '@/lib/ai/utils'
import { appendMessageToMarkdown, saveSessionToMarkdown } from '@/lib/storage/chatStorage'

// 1. UI State Store (Transient)
interface AIUIState {
  isLoading: boolean;
  error: string | null;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

const useAIUIStore = create<AIUIState>((set) => ({
  isLoading: false,
  error: null,
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error: string | null) => set({ error }),
}));

// 2. Actions
const actions = {
  addProvider: (provider: Omit<Provider, 'id' | 'createdAt' | 'updatedAt'>) => {
    const id = `provider-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
    const now = Date.now()
    const newProvider: Provider = { ...provider, id, createdAt: now, updatedAt: now }
    const state = useUnifiedStore.getState();
    const currentProviders = state.data.ai?.providers || [];
    state.updateAIData({ providers: [...currentProviders, newProvider] });
    return id
  },

  updateProvider: (id: string, updates: Partial<Provider>) => {
    const state = useUnifiedStore.getState();
    const providers = state.data.ai?.providers || [];
    state.updateAIData({
      providers: providers.map((p) =>
        p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p
      )
    })
  },

  deleteProvider: (id: string) => {
    const state = useUnifiedStore.getState();
    const ai = state.data.ai!;
    state.updateAIData({
      providers: ai.providers.filter((p) => p.id !== id),
      models: ai.models.filter((m) => m.providerId !== id),
      selectedModelId: ai.selectedModelId && 
        ai.models.find(m => m.id === ai.selectedModelId)?.providerId === id
        ? null
        : ai.selectedModelId
    })
  },

  addModel: (model: Omit<AIModel, 'createdAt'>) => {
    const state = useUnifiedStore.getState();
    const ai = state.data.ai!;
    const newModel: AIModel = {
      ...model,
      name: model.name || generateModelName(model.id),
      group: model.group || generateModelGroup(model.id),
      createdAt: Date.now()
    }
    
    const updates: any = { models: [...ai.models, newModel] };
    if (!ai.selectedModelId) {
        updates.selectedModelId = newModel.id;
    }
    state.updateAIData(updates);
  },

  addModels: (models: Array<Omit<AIModel, 'createdAt'>>) => {
    const state = useUnifiedStore.getState();
    const ai = state.data.ai!;
    const now = Date.now()
    const newModels: AIModel[] = models.map((model) => ({
      ...model,
      name: model.name || generateModelName(model.id),
      group: model.group || generateModelGroup(model.id),
      createdAt: now
    }))
    
    const updates: any = { models: [...ai.models, ...newModels] };
    if (!ai.selectedModelId && newModels.length > 0) {
        updates.selectedModelId = newModels[0].id;
    }
    state.updateAIData(updates);
  },

  deleteModel: (id: string) => {
    const state = useUnifiedStore.getState();
    const ai = state.data.ai!;
    state.updateAIData({
      models: ai.models.filter((m) => m.id !== id),
      selectedModelId: ai.selectedModelId === id ? null : ai.selectedModelId
    })
  },

  selectModel: (modelId: string | null) => {
    useUnifiedStore.getState().updateAIData({ selectedModelId: modelId })
  },

  createSession: (title = 'New Chat') => {
    const id = `session-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
    const state = useUnifiedStore.getState();
    const ai = state.data.ai!;
    
    const newSession: ChatSession = {
      id,
      title,
      modelId: ai.selectedModelId || '',
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    state.updateAIData({
      sessions: [newSession, ...ai.sessions],
      currentSessionId: id,
      messages: { ...ai.messages, [id]: [] }
    })
    
    saveSessionToMarkdown(newSession, []);
    return id
  },

  switchSession: (sessionId: string) => {
    useUnifiedStore.getState().updateAIData({ currentSessionId: sessionId })
  },

  updateSession: (id: string, updates: Partial<ChatSession>) => {
    const state = useUnifiedStore.getState();
    const ai = state.data.ai!;
    state.updateAIData({
      sessions: ai.sessions.map((s) => 
        s.id === id ? { ...s, ...updates, updatedAt: Date.now() } : s
      )
    })
  },

  deleteSession: (id: string) => {
    const state = useUnifiedStore.getState();
    const ai = state.data.ai!;
    const newSessions = ai.sessions.filter(s => s.id !== id);
    const newMessages = { ...ai.messages };
    delete newMessages[id];
    
    state.updateAIData({
      sessions: newSessions,
      messages: newMessages,
      currentSessionId: ai.currentSessionId === id 
        ? (newSessions[0]?.id || null) 
        : ai.currentSessionId
    });
  },

  clearSessions: () => {
    useUnifiedStore.getState().updateAIData({ sessions: [], messages: {}, currentSessionId: null })
  },

  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'> & { id?: string }) => {
    const state = useUnifiedStore.getState();
    const ai = state.data.ai!;
    const { currentSessionId } = ai;
    if (!currentSessionId) return;

    const newMessage: ChatMessage = {
      ...message,
      id: message.id || `msg-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      timestamp: Date.now(),
      versions: [message.content || ''],
      currentVersionIndex: 0
    }

    const sessionMessages = ai.messages[currentSessionId] || [];
    const newMessages = [...sessionMessages, newMessage];
    
    state.updateAIData({
      messages: { ...ai.messages, [currentSessionId]: newMessages },
      sessions: ai.sessions.map(s => s.id === currentSessionId ? { ...s, updatedAt: Date.now() } : s)
    });

    if (message.role === 'user') {
        appendMessageToMarkdown(currentSessionId, newMessage);
    }
    
    return newMessage.id;
  },

  updateMessage: (id: string, content: string) => {
    const state = useUnifiedStore.getState();
    const ai = state.data.ai!;
    const { currentSessionId } = ai;
    if (!currentSessionId) return;

    const sessionMessages = ai.messages[currentSessionId] || [];
    state.updateAIData({
      messages: {
        ...ai.messages,
        [currentSessionId]: sessionMessages.map(m => {
            if (m.id !== id) return m;
            
            // Sync versions
            const idx = m.currentVersionIndex ?? 0;
            const versions = m.versions ? [...m.versions] : [m.content];
            versions[idx] = content;
            
            return { ...m, content, versions, currentVersionIndex: idx };
        })
      }
    }, true); // Skip persist for high-frequency updates
  },

  completeMessage: (id: string) => {
      const state = useUnifiedStore.getState();
      const ai = state.data.ai!;
      const { currentSessionId } = ai;
      if (!currentSessionId) return;

      const sessionMessages = ai.messages[currentSessionId] || [];
      const msg = sessionMessages.find(m => m.id === id);
      if (msg) {
          appendMessageToMarkdown(currentSessionId, msg);
          // Trigger final persist
          state.updateAIData({}); 
      }
  },

  // Versioning Actions
  addVersion: (id: string) => {
      const state = useUnifiedStore.getState();
      const ai = state.data.ai!;
      const { currentSessionId } = ai;
      if (!currentSessionId) return;

      const sessionMessages = ai.messages[currentSessionId] || [];
      state.updateAIData({
          messages: {
              ...ai.messages,
              [currentSessionId]: sessionMessages.map(m => {
                  if (m.id !== id) return m;
                  const versions = m.versions ? [...m.versions, ''] : [m.content, ''];
                  const newIndex = versions.length - 1;
                  return { ...m, versions, currentVersionIndex: newIndex, content: '' };
              })
          }
      });
  },

  switchVersion: (id: string, direction: 'prev' | 'next') => {
      const state = useUnifiedStore.getState();
      const ai = state.data.ai!;
      const { currentSessionId } = ai;
      if (!currentSessionId) return;

      const sessionMessages = ai.messages[currentSessionId] || [];
      state.updateAIData({
          messages: {
              ...ai.messages,
              [currentSessionId]: sessionMessages.map(m => {
                  if (m.id !== id) return m;
                  const versions = m.versions || [m.content];
                  const currentIdx = m.currentVersionIndex ?? 0;
                  
                  let newIdx = currentIdx;
                  if (direction === 'prev' && currentIdx > 0) newIdx--;
                  if (direction === 'next' && currentIdx < versions.length - 1) newIdx++;
                  
                  return { 
                      ...m, 
                      currentVersionIndex: newIdx, 
                      content: versions[newIdx] 
                  };
              })
          }
      });
  }
};

// 3. The Hook
export const useAIStore = () => {
  const aiData = useUnifiedStore(s => s.data.ai);
  const uiState = useAIUIStore();
  const loaded = useUnifiedStore(s => s.loaded);
  const load = useUnifiedStore(s => s.load);

  useEffect(() => {
      if (!loaded) {
          load();
      }
  }, [loaded, load]);

  return {
    providers: aiData?.providers || [],
    models: aiData?.models || [],
    sessions: aiData?.sessions || [],
    currentSessionId: aiData?.currentSessionId || null,
    messages: aiData?.messages || {},
    selectedModelId: aiData?.selectedModelId || null,
    
    ...uiState,
    ...actions,
    
    getProvider: (id: string) => aiData?.providers.find(p => p.id === id),
    getModel: (id: string) => aiData?.models.find(m => m.id === id),
    getSelectedModel: () => aiData?.selectedModelId ? aiData.models.find(m => m.id === aiData.selectedModelId) : undefined,
    getModelsByProvider: (pid: string) => aiData?.models.filter(m => m.providerId === pid && m.enabled) || [],
  };
};