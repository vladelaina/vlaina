import { create } from 'zustand'
import { useEffect } from 'react'
import { useUnifiedStore } from './useUnifiedStore'
import type { Provider, AIModel, ChatMessage, ChatSession, MessageVersion } from '@/lib/ai/types'
import { generateModelName, generateModelGroup } from '@/lib/ai/utils'
import { saveSessionJson, loadSessionJson } from '@/lib/storage/chatStorage'

interface AIUIState {
  generatingSessions: Record<string, boolean>;
  unreadSessions: Record<string, boolean>;
  error: string | null;
  setSessionLoading: (sessionId: string, loading: boolean) => void;
  markSessionUnread: (sessionId: string) => void;
  markSessionRead: (sessionId: string) => void;
  setError: (error: string | null) => void;
}

const useAIUIStore = create<AIUIState>((set) => ({
  generatingSessions: {},
  unreadSessions: {},
  error: null,
  setSessionLoading: (id, loading) => set((state) => ({
      generatingSessions: { ...state.generatingSessions, [id]: loading }
  })),
  markSessionUnread: (id) => set((state) => ({
      unreadSessions: { ...state.unreadSessions, [id]: true }
  })),
  markSessionRead: (id) => set((state) => {
      const newUnread = { ...state.unreadSessions };
      delete newUnread[id];
      return { unreadSessions: newUnread };
  }),
  setError: (error: string | null) => set({ error }),
}));

export const actions = {
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

  updateModel: (id: string, updates: Partial<AIModel>) => {
    const state = useUnifiedStore.getState();
    const ai = state.data.ai!;
    state.updateAIData({
      models: ai.models.map((m) => m.id === id ? { ...m, ...updates } : m)
    })
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

  openNewChat: () => {
      useUnifiedStore.getState().updateAIData({ currentSessionId: null })
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
    
    saveSessionJson(id, []);
    return id
  },

  switchSession: async (sessionId: string) => {
    const state = useUnifiedStore.getState();
    const ai = state.data.ai!;
    
    state.updateAIData({ currentSessionId: sessionId });

    // Precise Lazy Load: Only load if the key is missing from the messages map
    if (!(sessionId in ai.messages)) {
        const loadedMessages = await loadSessionJson(sessionId);
        // Even if loadedMessages is null/empty, we set it to [] to mark it as "loaded"
        const freshState = useUnifiedStore.getState();
        freshState.updateAIData({
            messages: { 
                ...freshState.data.ai!.messages, 
                [sessionId]: loadedMessages || [] 
            }
        });
    }
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
        ? null 
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
      versions: [{ 
          content: message.content || '', 
          createdAt: Date.now(), 
          subsequentMessages: [] 
      }],
      currentVersionIndex: 0
    }

    const sessionMessages = ai.messages[currentSessionId] || [];
    const newMessages = [...sessionMessages, newMessage];
    
    state.updateAIData({
      messages: { ...ai.messages, [currentSessionId]: newMessages },
      sessions: ai.sessions.map(s => s.id === currentSessionId ? { ...s, updatedAt: Date.now() } : s)
    });

    saveSessionJson(currentSessionId, newMessages);
    return newMessage.id;
  },

  updateMessage: (sessionId: string, id: string, content: string) => {
    const state = useUnifiedStore.getState();
    const ai = state.data.ai!;
    const sessionMessages = ai.messages[sessionId] || [];
    
    if (sessionMessages.length === 0) return;

    const newMessages = sessionMessages.map(m => {
        if (m.id !== id) return m;
        
        const idx = m.currentVersionIndex ?? 0;
        const versions = m.versions ? [...m.versions] : [{ content: m.content, createdAt: m.timestamp, subsequentMessages: [] }];
        
        if (versions[idx]) {
            versions[idx] = { ...versions[idx], content };
        }
        
        return { ...m, content, versions, currentVersionIndex: idx };
    });

    state.updateAIData({
      messages: {
        ...ai.messages,
        [sessionId]: newMessages
      }
    }, true); 

    saveSessionJson(sessionId, newMessages);
  },

  completeMessage: (_sessionId: string, _id: string) => {
      useUnifiedStore.getState().updateAIData({}); 
  },

  addVersion: (id: string) => {
      const state = useUnifiedStore.getState();
      const ai = state.data.ai!;
      const { currentSessionId } = ai;
      if (!currentSessionId) return;

      const sessionMessages = ai.messages[currentSessionId] || [];
      const newMessages = sessionMessages.map(m => {
          if (m.id !== id) return m;
          
          const versions = m.versions ? [...m.versions] : [{ 
              content: typeof m.content === 'string' ? m.content : '', 
              createdAt: m.timestamp,
              subsequentMessages: []
          }];
          
          const newVersion: MessageVersion = {
              content: '',
              createdAt: Date.now(),
              subsequentMessages: []
          };
          
          versions.push(newVersion);
          const newIndex = versions.length - 1;
          
          return { 
              ...m, 
              content: '', 
              versions, 
              currentVersionIndex: newIndex 
          };
      });

      state.updateAIData({
          messages: {
              ...ai.messages,
              [currentSessionId]: newMessages
          }
      });

      saveSessionJson(currentSessionId, newMessages);
  },

  editMessageAndBranch: (sessionId: string, messageId: string, newContent: string) => {
      const state = useUnifiedStore.getState();
      const ai = state.data.ai!;
      const messages = ai.messages[sessionId] || [];
      const index = messages.findIndex(m => m.id === messageId);
      if (index === -1) return;

      const targetMsg = messages[index];
      const futureMessages = messages.slice(index + 1);

      const currentIdx = targetMsg.currentVersionIndex ?? 0;
      const versions = targetMsg.versions ? [...targetMsg.versions] : [{ content: targetMsg.content, createdAt: targetMsg.timestamp, subsequentMessages: [] }];
      
      versions[currentIdx] = {
          ...versions[currentIdx],
          subsequentMessages: futureMessages
      };

      const newVersion: MessageVersion = {
          content: newContent,
          createdAt: Date.now(),
          subsequentMessages: []
      };
      versions.push(newVersion);
      const newIndex = versions.length - 1;

      const newMessages = messages.slice(0, index + 1);
      newMessages[index] = {
          ...targetMsg,
          content: newContent,
          versions: versions,
          currentVersionIndex: newIndex
      };

      state.updateAIData({
          messages: { ...ai.messages, [sessionId]: newMessages }
      });

      saveSessionJson(sessionId, newMessages);
  },

  switchMessageVersion: (sessionId: string, messageId: string, targetIndex: number) => {
      const state = useUnifiedStore.getState();
      const ai = state.data.ai!;
      const messages = ai.messages[sessionId] || [];
      const index = messages.findIndex(m => m.id === messageId);
      if (index === -1) return;

      const targetMsg = messages[index];
      if (!targetMsg.versions || !targetMsg.versions[targetIndex]) return;

      const currentIdx = targetMsg.currentVersionIndex ?? 0;
      if (currentIdx === targetIndex) return;

      const futureMessages = messages.slice(index + 1);
      const versions = [...targetMsg.versions];
      
      versions[currentIdx] = {
          ...versions[currentIdx],
          subsequentMessages: futureMessages
      };

      const restoredFuture = versions[targetIndex].subsequentMessages || [];
      
      const newMessages = messages.slice(0, index + 1);
      newMessages[index] = {
          ...targetMsg,
          content: versions[targetIndex].content,
          currentVersionIndex: targetIndex,
          versions: versions
      };
      
      const finalMessages = [...newMessages, ...restoredFuture];

      state.updateAIData({
          messages: { ...ai.messages, [sessionId]: finalMessages }
      });

      saveSessionJson(sessionId, finalMessages);
  },
};

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
    nativeWebSearchEnabled: aiData?.nativeWebSearchEnabled || false,
    
    ...uiState,
    ...actions,

    toggleNativeWebSearch: () => {
        const current = useUnifiedStore.getState().data.ai?.nativeWebSearchEnabled || false;
        useUnifiedStore.getState().updateAIData({ nativeWebSearchEnabled: !current });
    },

    getProvider: (id: string) => aiData?.providers.find(p => p.id === id),
    getModel: (id: string) => aiData?.models.find(m => m.id === id),
    getSelectedModel: () => aiData?.selectedModelId ? aiData.models.find(m => m.id === aiData.selectedModelId) : undefined,
    getModelsByProvider: (pid: string) => aiData?.models.filter(m => m.providerId === pid && m.enabled) || [],
    
    isSessionLoading: (sessionId: string) => !!uiState.generatingSessions[sessionId],
    isSessionUnread: (sessionId: string) => !!uiState.unreadSessions[sessionId],
    isLoading: aiData?.currentSessionId ? !!uiState.generatingSessions[aiData.currentSessionId] : false,
    selectedModel: aiData?.selectedModelId ? aiData.models.find(m => m.id === aiData.selectedModelId) : undefined
  };
};
