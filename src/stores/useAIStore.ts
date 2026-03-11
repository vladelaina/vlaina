import { create } from 'zustand'
import { useEffect } from 'react'
import { useUnifiedStore } from './useUnifiedStore'
import { useGithubSyncStore } from './useGithubSyncStore'
import { useManagedAIStore } from './useManagedAIStore'
import type { Provider, AIModel, ChatMessage, ChatSession, MessageVersion } from '@/lib/ai/types'
import { buildScopedModelId, generateModelName, generateModelGroup } from '@/lib/ai/utils'
import { saveSessionJson, loadSessionJson, scheduleSessionJsonSave, cancelSessionJsonSave, deleteSessionJson } from '@/lib/storage/chatStorage'
import { requestManager } from '@/lib/ai/requestManager'
import {
  MANAGED_PROVIDER_ID,
  createManagedProvider,
  fetchManagedModels,
  getManagedAccessToken,
  isManagedProviderId,
} from '@/lib/ai/managedService'
import {
  createTemporarySession,
  isTemporarySession,
  isTemporarySessionId,
  shouldPersistSession,
  stripTemporaryData
} from '@/lib/ai/temporaryChat';
import { extractMarkdownImageSources } from '@/components/Chat/common/messageClipboard';

interface AIUIState {
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

const useAIUIStore = create<AIUIState>((set) => ({
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
      const newUnread = { ...state.unreadSessions };
      delete newUnread[id];
      return { unreadSessions: newUnread };
  }),
  setError: (error: string | null) => set({ error }),
  setTemporaryReturnSessionId: (sessionId) => set({ temporaryReturnSessionId: sessionId }),
  clearSessionState: (sessionId) => set((state) => {
      const generatingSessions = { ...state.generatingSessions };
      const unreadSessions = { ...state.unreadSessions };
      delete generatingSessions[sessionId];
      delete unreadSessions[sessionId];
      return { generatingSessions, unreadSessions };
  }),
}));

function clearTemporaryUIState(sessionIds: string[]) {
  const uiState = useAIUIStore.getState();
  sessionIds.forEach((id) => uiState.clearSessionState(id));
}

function stripTemporaryForMutation(ai: {
  sessions: ChatSession[];
  messages: Record<string, ChatMessage[]>;
}) {
  const stripped = stripTemporaryData(ai);
  clearTemporaryUIState(stripped.temporarySessionIds);
  return stripped;
}

function buildTemporarySessionState(
  stripped: { sessions: ChatSession[]; messages: Record<string, ChatMessage[]> },
  modelId: string
) {
  const temporarySession = createTemporarySession(modelId);
  return {
    sessions: [temporarySession, ...stripped.sessions],
    messages: { ...stripped.messages, [temporarySession.id]: [] },
    currentSessionId: temporarySession.id
  };
}

function sortProviders(providers: Provider[]): Provider[] {
  return [...providers].sort((a, b) => {
    if (a.id === MANAGED_PROVIDER_ID) return -1
    if (b.id === MANAGED_PROVIDER_ID) return 1
    return a.createdAt - b.createdAt
  })
}

function ensureManagedProvider(providers: Provider[]): Provider[] {
  const now = Date.now()
  const managed = providers.find((provider) => provider.id === MANAGED_PROVIDER_ID)
  const nextManaged = createManagedProvider(managed?.createdAt || now)
  const nextProviders = providers.filter((provider) => provider.id !== MANAGED_PROVIDER_ID)
  nextProviders.unshift(nextManaged)
  return sortProviders(nextProviders)
}

function chooseFallbackSelectedModelId(
  currentSelectedModelId: string | null,
  models: AIModel[],
  preferredProviderId?: string | null
): string | null {
  if (currentSelectedModelId && models.some((model) => model.id === currentSelectedModelId)) {
    return currentSelectedModelId
  }

  if (preferredProviderId) {
    const preferredModel = models.find((model) => model.providerId === preferredProviderId)
    if (preferredModel) {
      return preferredModel.id
    }
  }

  return models[0]?.id || null
}

function replaceProviderModels(allModels: AIModel[], providerId: string, nextModels: AIModel[]): AIModel[] {
  const otherModels = allModels.filter((model) => model.providerId !== providerId)
  return [...otherModels, ...nextModels]
}

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
    if (isManagedProviderId(id)) {
      return
    }
    const state = useUnifiedStore.getState();
    const providers = state.data.ai?.providers || [];
    state.updateAIData({
      providers: providers.map((p) =>
        p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p
      )
    })
  },

  deleteProvider: (id: string) => {
    if (isManagedProviderId(id)) {
      return
    }
    const state = useUnifiedStore.getState();
    const ai = state.data.ai!;
    const remainingModels = ai.models.filter((m) => m.providerId !== id)
    state.updateAIData({
      providers: ai.providers.filter((p) => p.id !== id),
      models: remainingModels,
      selectedModelId: chooseFallbackSelectedModelId(
        ai.selectedModelId && ai.models.find(m => m.id === ai.selectedModelId)?.providerId === id ? null : ai.selectedModelId,
        remainingModels
      )
    })
  },

  addModel: (model: Omit<AIModel, 'createdAt'>) => {
    const state = useUnifiedStore.getState();
    const ai = state.data.ai!;
    const apiModelId = (model.apiModelId || model.id).trim()
    if (!apiModelId) return
    const newModel: AIModel = {
      ...model,
      id: buildScopedModelId(model.providerId, apiModelId),
      apiModelId,
      name: model.name || generateModelName(apiModelId),
      group: model.group || generateModelGroup(apiModelId),
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
      id: buildScopedModelId(model.providerId, (model.apiModelId || model.id).trim()),
      apiModelId: (model.apiModelId || model.id).trim(),
      name: model.name || generateModelName((model.apiModelId || model.id).trim()),
      group: model.group || generateModelGroup((model.apiModelId || model.id).trim()),
      createdAt: now
    })).filter((model) => model.apiModelId.length > 0)
    
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

  setCustomSystemPrompt: (prompt: string) => {
    useUnifiedStore.getState().updateAIData({ customSystemPrompt: prompt });
  },

  setIncludeTimeContext: (enabled: boolean) => {
    useUnifiedStore.getState().updateAIData({ includeTimeContext: enabled });
  },

  refreshManagedProvider: async () => {
    const accessToken = await getManagedAccessToken()
    if (!accessToken) {
      throw new Error('NekoTick sign-in required')
    }

    const models = await fetchManagedModels(accessToken)
    const store = useUnifiedStore.getState()
    const ai = store.data.ai!
    const nextProviders = ensureManagedProvider(ai.providers)
    const nextModels = replaceProviderModels(ai.models, MANAGED_PROVIDER_ID, models)
    const selectedModelId = chooseFallbackSelectedModelId(
      ai.selectedModelId,
      nextModels,
      MANAGED_PROVIDER_ID
    )

    store.updateAIData({
      providers: nextProviders,
      models: nextModels,
      selectedModelId,
    })
    await useManagedAIStore.getState().refreshBudget()
  },

  toggleTemporaryChat: (enabled?: boolean) => {
    const state = useUnifiedStore.getState();
    const ai = state.data.ai!;
    const uiState = useAIUIStore.getState();
    const nextEnabled = enabled ?? !ai.temporaryChatEnabled;

    if (nextEnabled === !!ai.temporaryChatEnabled) {
      return;
    }

    if (nextEnabled) {
      const returnSessionId = ai.currentSessionId && !isTemporarySessionId(ai.currentSessionId)
        ? ai.currentSessionId
        : uiState.temporaryReturnSessionId;
      const stripped = stripTemporaryForMutation(ai);
      const temporaryState = buildTemporarySessionState(stripped, ai.selectedModelId || '');

      state.updateAIData({
        temporaryChatEnabled: true,
        sessions: temporaryState.sessions,
        messages: temporaryState.messages,
        currentSessionId: temporaryState.currentSessionId
      });
      uiState.setTemporaryReturnSessionId(returnSessionId || null);
      return;
    }

    const stripped = stripTemporaryForMutation(ai);
    const restoreSessionId = uiState.temporaryReturnSessionId && stripped.sessions.some((session) => session.id === uiState.temporaryReturnSessionId)
      ? uiState.temporaryReturnSessionId
      : null;

    state.updateAIData({
      temporaryChatEnabled: false,
      sessions: stripped.sessions,
      messages: stripped.messages,
      currentSessionId: restoreSessionId
    });
    uiState.setTemporaryReturnSessionId(null);
  },

  openNewChat: () => {
      const state = useUnifiedStore.getState();
      const ai = state.data.ai!;

      if (!ai.temporaryChatEnabled) {
        state.updateAIData({ currentSessionId: null });
        return;
      }

      const uiState = useAIUIStore.getState();
      const stripped = stripTemporaryForMutation(ai);
      state.updateAIData({
        temporaryChatEnabled: false,
        sessions: stripped.sessions,
        messages: stripped.messages,
        currentSessionId: null
      });
      uiState.setTemporaryReturnSessionId(null);
  },

  promoteTemporarySession: () => {
    const state = useUnifiedStore.getState();
    const ai = state.data.ai!;
    const uiState = useAIUIStore.getState();
    const currentSessionId = ai.currentSessionId;

    if (!ai.temporaryChatEnabled || !isTemporarySessionId(currentSessionId)) {
      return null;
    }
    const temporarySessionId = currentSessionId as string;

    const temporarySession = ai.sessions.find((session) => session.id === temporarySessionId);
    if (!temporarySession || !isTemporarySession(temporarySession)) {
      return null;
    }

    const now = Date.now();
    const promotedSessionId = `session-${now}-${Math.random().toString(36).substring(2, 11)}`;
    const promotedSession: ChatSession = {
      id: promotedSessionId,
      title: 'New Chat',
      modelId: temporarySession.modelId || ai.selectedModelId || '',
      isPinned: temporarySession.isPinned,
      createdAt: temporarySession.createdAt || now,
      updatedAt: now
    };

    const sessionsWithoutOtherTemporary = ai.sessions.filter((session) => {
      if (!isTemporarySession(session)) return true;
      return session.id === temporarySessionId;
    });
    const nextSessions = sessionsWithoutOtherTemporary.map((session) =>
      session.id === temporarySessionId ? promotedSession : session
    );

    const nextMessages = Object.fromEntries(
      Object.entries(ai.messages).filter(([sessionId]) =>
        !isTemporarySessionId(sessionId) || sessionId === temporarySessionId
      )
    ) as Record<string, ChatMessage[]>;
    nextMessages[promotedSessionId] = nextMessages[temporarySessionId] || [];
    delete nextMessages[temporarySessionId];

    requestManager.abort(temporarySessionId);
    cancelSessionJsonSave(temporarySessionId);
    uiState.clearSessionState(temporarySessionId);
    uiState.setTemporaryReturnSessionId(null);

    state.updateAIData({
      temporaryChatEnabled: false,
      sessions: nextSessions,
      messages: nextMessages,
      currentSessionId: promotedSessionId
    });

    void saveSessionJson(promotedSessionId, nextMessages[promotedSessionId] || []);
    return promotedSessionId;
  },

  createSession: (title = 'New Chat') => {
    const state = useUnifiedStore.getState();
    const ai = state.data.ai!;
    const now = Date.now();

    if (ai.temporaryChatEnabled) {
      const stripped = stripTemporaryForMutation(ai);
      const temporaryState = buildTemporarySessionState(stripped, ai.selectedModelId || '');

      state.updateAIData({
        sessions: temporaryState.sessions,
        currentSessionId: temporaryState.currentSessionId,
        messages: temporaryState.messages
      });
      return temporaryState.currentSessionId;
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
    
    saveSessionJson(id, []);
    return id
  },

  switchSession: async (sessionId: string) => {
    const state = useUnifiedStore.getState();
    const ai = state.data.ai!;

    if (ai.temporaryChatEnabled && !isTemporarySessionId(sessionId)) {
      const uiState = useAIUIStore.getState();
      const stripped = stripTemporaryForMutation(ai);
      uiState.setTemporaryReturnSessionId(null);

      state.updateAIData({
        temporaryChatEnabled: false,
        sessions: stripped.sessions,
        messages: stripped.messages,
        currentSessionId: sessionId
      });
    } else {
      state.updateAIData({ currentSessionId: sessionId });
      if (isTemporarySessionId(sessionId)) {
        if (!(sessionId in ai.messages)) {
          const freshState = useUnifiedStore.getState();
          freshState.updateAIData({
            messages: {
              ...freshState.data.ai!.messages,
              [sessionId]: []
            }
          }, true);
        }
        return;
      }
    }

    const latestAI = useUnifiedStore.getState().data.ai!;
    if (!(sessionId in latestAI.messages)) {
        const loadedMessages = await loadSessionJson(sessionId);
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
    const uiState = useAIUIStore.getState();
    requestManager.abort(id);
    cancelSessionJsonSave(id);
    uiState.clearSessionState(id);

    if (isTemporarySessionId(id)) {
      const stripped = stripTemporaryForMutation(ai);

      if (ai.temporaryChatEnabled) {
        const temporaryState = buildTemporarySessionState(stripped, ai.selectedModelId || '');
        state.updateAIData({
          sessions: temporaryState.sessions,
          messages: temporaryState.messages,
          currentSessionId: temporaryState.currentSessionId
        });
      } else {
        state.updateAIData({
          sessions: stripped.sessions,
          messages: stripped.messages,
          currentSessionId: ai.currentSessionId === id ? null : ai.currentSessionId
        });
      }
      return;
    }

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
    void deleteSessionJson(id);
  },

  clearSessions: () => {
    const state = useUnifiedStore.getState();
    const ai = state.data.ai!;
    const uiState = useAIUIStore.getState();
    ai.sessions.forEach((session) => {
      requestManager.abort(session.id);
      cancelSessionJsonSave(session.id);
      uiState.clearSessionState(session.id);
      if (!isTemporarySession(session)) {
        void deleteSessionJson(session.id);
      }
    });

    if (ai.temporaryChatEnabled) {
      stripTemporaryForMutation(ai);
      const temporaryState = buildTemporarySessionState({ sessions: [], messages: {} }, ai.selectedModelId || '');
      state.updateAIData({
        sessions: temporaryState.sessions,
        messages: temporaryState.messages,
        currentSessionId: temporaryState.currentSessionId
      });
      return;
    }

    state.updateAIData({ sessions: [], messages: {}, currentSessionId: null });
  },

  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'> & { id?: string }) => {
    const state = useUnifiedStore.getState();
    const ai = state.data.ai!;
    const { currentSessionId } = ai;
    if (!currentSessionId) return;

    const newMessage: ChatMessage = {
      ...message,
      imageSources:
        message.role === 'user'
          ? (message.imageSources && message.imageSources.length > 0
              ? message.imageSources
              : extractMarkdownImageSources(message.content || ''))
          : message.imageSources,
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

    if (shouldPersistSession(ai, currentSessionId)) {
      saveSessionJson(currentSessionId, newMessages);
    }
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

    if (shouldPersistSession(ai, sessionId)) {
      scheduleSessionJsonSave(sessionId, newMessages);
    }
  },

  completeMessage: (sessionId: string, _id: string) => {
      const state = useUnifiedStore.getState();
      const ai = state.data.ai!;
      const sessionMessages = ai.messages[sessionId];
      if (sessionMessages && shouldPersistSession(ai, sessionId)) {
        void saveSessionJson(sessionId, sessionMessages);
      }
      state.updateAIData({}); 
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

      if (shouldPersistSession(ai, currentSessionId)) {
        saveSessionJson(currentSessionId, newMessages);
      }
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
          imageSources: extractMarkdownImageSources(newContent),
          versions: versions,
          currentVersionIndex: newIndex
      };

      state.updateAIData({
          messages: { ...ai.messages, [sessionId]: newMessages }
      });

      if (shouldPersistSession(ai, sessionId)) {
        saveSessionJson(sessionId, newMessages);
      }
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
          imageSources: extractMarkdownImageSources(versions[targetIndex].content),
          currentVersionIndex: targetIndex,
          versions: versions
      };
      
      const finalMessages = [...newMessages, ...restoredFuture];

      state.updateAIData({
          messages: { ...ai.messages, [sessionId]: finalMessages }
      });

      if (shouldPersistSession(ai, sessionId)) {
        saveSessionJson(sessionId, finalMessages);
      }
  },
};

export const useAIStore = () => {
  const aiData = useUnifiedStore(s => s.data.ai);
  const uiState = useAIUIStore();
  const loaded = useUnifiedStore(s => s.loaded);
  const load = useUnifiedStore(s => s.load);
  const githubConnected = useGithubSyncStore((s) => s.isConnected);

  useEffect(() => {
      if (!loaded) {
          load();
      }
  }, [loaded, load]);

  useEffect(() => {
    if (!loaded || !aiData?.temporaryChatEnabled) {
      return;
    }

    const currentSessionId = aiData.currentSessionId;
    const currentSession = currentSessionId
      ? aiData.sessions.find((session) => session.id === currentSessionId)
      : null;
    const hasActiveTemporarySession =
      isTemporarySessionId(currentSessionId) || isTemporarySession(currentSession);

    if (hasActiveTemporarySession) {
      return;
    }

    useUnifiedStore.getState().updateAIData({ temporaryChatEnabled: false });
  }, [aiData?.currentSessionId, aiData?.sessions, aiData?.temporaryChatEnabled, loaded]);

  useEffect(() => {
    if (!loaded) {
      return;
    }

    const store = useUnifiedStore.getState();
    const ai = store.data.ai;
    if (!ai) return;

    const nextProviders = ensureManagedProvider(ai.providers);
    const providersChanged =
      nextProviders.length !== ai.providers.length ||
      nextProviders.some((provider, index) => ai.providers[index]?.id !== provider.id);

    if (providersChanged) {
      store.updateAIData({ providers: nextProviders });
    }
  }, [loaded]);

  useEffect(() => {
    if (!loaded || !githubConnected) {
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const accessToken = await getManagedAccessToken();
        if (!accessToken || cancelled) return;

        const models = await fetchManagedModels(accessToken);
        if (cancelled) return;

        const store = useUnifiedStore.getState();
        const ai = store.data.ai!;
        const nextProviders = ensureManagedProvider(ai.providers);
        const nextModels = replaceProviderModels(ai.models, MANAGED_PROVIDER_ID, models);
        const selectedModelId = chooseFallbackSelectedModelId(
          ai.selectedModelId,
          nextModels,
          MANAGED_PROVIDER_ID
        );

        store.updateAIData({
          providers: nextProviders,
          models: nextModels,
          selectedModelId,
        });
        void useManagedAIStore.getState().refreshBudget();
      } catch (error) {
        console.error('Failed to sync managed AI models from Worker', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loaded, githubConnected]);

  useEffect(() => {
    if (!loaded || githubConnected) {
      return;
    }
    const store = useUnifiedStore.getState();
    const ai = store.data.ai;
    if (!ai) return;
    const nextProviders = ensureManagedProvider(ai.providers);
    const nextModels = ai.models.filter((model) => model.providerId !== MANAGED_PROVIDER_ID);
    const nextSelectedModelId = chooseFallbackSelectedModelId(
      ai.selectedModelId && ai.models.some((model) => model.id === ai.selectedModelId && model.providerId === MANAGED_PROVIDER_ID)
        ? null
        : ai.selectedModelId,
      nextModels
    );

    const modelsChanged = nextModels.length !== ai.models.length;
    const providersChanged =
      nextProviders.length !== ai.providers.length ||
      nextProviders.some((provider, index) => ai.providers[index]?.id !== provider.id);

    if (!modelsChanged && !providersChanged && nextSelectedModelId === ai.selectedModelId) {
      useManagedAIStore.getState().clearBudget();
      return;
    }

    store.updateAIData({
      providers: nextProviders,
      models: nextModels,
      selectedModelId: nextSelectedModelId,
    });
    useManagedAIStore.getState().clearBudget();
  }, [loaded, githubConnected]);

  return {
    providers: aiData?.providers || [],
    models: aiData?.models || [],
    sessions: aiData?.sessions || [],
    currentSessionId: aiData?.currentSessionId || null,
    messages: aiData?.messages || {},
    selectedModelId: aiData?.selectedModelId || null,
    temporaryChatEnabled: !!aiData?.temporaryChatEnabled,
    customSystemPrompt: aiData?.customSystemPrompt || '',
    includeTimeContext: aiData?.includeTimeContext !== false,
    
    ...uiState,
    ...actions,

    getProvider: (id: string) => aiData?.providers.find(p => p.id === id),
    getModel: (id: string) => aiData?.models.find(m => m.id === id),
    getSelectedModel: () => aiData?.selectedModelId ? aiData.models.find(m => m.id === aiData.selectedModelId) : undefined,
    getModelsByProvider: (pid: string) => aiData?.models.filter(m => m.providerId === pid && m.enabled) || [],
    isTemporarySession: (sessionId: string) => {
      const session = aiData?.sessions.find((item) => item.id === sessionId);
      return isTemporarySessionId(sessionId) || isTemporarySession(session);
    },
    
    isSessionLoading: (sessionId: string) => !!uiState.generatingSessions[sessionId],
    isSessionUnread: (sessionId: string) => !!uiState.unreadSessions[sessionId],
    isLoading: aiData?.currentSessionId ? !!uiState.generatingSessions[aiData.currentSessionId] : false,
    selectedModel: aiData?.selectedModelId ? aiData.models.find(m => m.id === aiData.selectedModelId) : undefined
  };
};
