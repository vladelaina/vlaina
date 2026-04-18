import { useEffect, useRef } from 'react'
import { useUnifiedStore } from './unified/useUnifiedStore'
import { useAccountSessionStore } from './accountSession'
import { useManagedAIStore } from './useManagedAIStore'
import type { Provider, AIModel, ProviderBenchmarkRecord } from '@/lib/ai/types'
import { generateId } from '@/lib/id'
import { buildScopedModelId, generateModelName, generateModelGroup } from '@/lib/ai/utils'
import {
  MANAGED_PROVIDER_ID,
  createManagedProvider,
  fetchManagedModels,
  isManagedServiceRecoverableError,
  isManagedProviderId,
} from '@/lib/ai/managedService'
import {
  isTemporarySession,
  isTemporarySessionId,
} from '@/lib/ai/temporaryChat';
import { createChatActions } from './ai/chatActions'
import { useAIUIStore } from './ai/chatState'
import { readWindowLaunchContext } from '@/lib/tauri/windowLaunchContext'

export { createAIChatSession } from './ai/chatState'

export function useAIStoreRuntimeEffects(): void {
  const aiData = useUnifiedStore(s => s.data.ai);
  const loaded = useUnifiedStore(s => s.loaded);
  const load = useUnifiedStore(s => s.load);
  const uiState = useAIUIStore();
  const accountConnected = useAccountSessionStore((s) => s.isConnected);
  const launchContextRef = useRef(readWindowLaunchContext());
  const suppressStartupAIPersistRef = useRef((() => {
    const launchContext = launchContextRef.current;
    return launchContext.isNewWindow && launchContext.viewMode === 'chat';
  })());

  useEffect(() => {
    if (!loaded || uiState.selectionInitialized) {
      return;
    }

    const launchContext = launchContextRef.current;
    if (launchContext.isNewWindow && launchContext.viewMode === 'chat') {
      uiState.initializeSelection({ currentSessionId: null, temporaryChatEnabled: false });
      return;
    }

    uiState.initializeSelection({
      currentSessionId: aiData?.currentSessionId ?? null,
      temporaryChatEnabled: !!aiData?.temporaryChatEnabled,
    });
  }, [
    aiData?.currentSessionId,
    aiData?.temporaryChatEnabled,
    loaded,
    uiState,
  ]);

  useEffect(() => {
    if (!loaded || !uiState.selectionInitialized || !uiState.temporaryChatEnabled) {
      return;
    }

    const currentSessionId = uiState.currentSessionId;
    const currentSession = currentSessionId
      ? aiData?.sessions.find((session) => session.id === currentSessionId)
      : null;
    const hasActiveTemporarySession =
      isTemporarySessionId(currentSessionId) || isTemporarySession(currentSession);

    if (hasActiveTemporarySession) {
      return;
    }

    uiState.setTemporaryChatEnabled(false);
  }, [
    aiData?.sessions,
    loaded,
    uiState,
  ]);

  useEffect(() => {
    if (!loaded || !uiState.selectionInitialized) {
      return;
    }

    const currentSessionId = uiState.currentSessionId;
    if (!currentSessionId || isTemporarySessionId(currentSessionId)) {
      return;
    }

    if (aiData?.sessions.some((session) => session.id === currentSessionId)) {
      return;
    }

    uiState.setCurrentSessionId(null);
  }, [aiData?.sessions, loaded, uiState]);

  useEffect(() => {
    if (!loaded || !uiState.selectionInitialized) {
      return;
    }

    const currentSessionId = uiState.currentSessionId;
    if (!currentSessionId) {
      return;
    }

    if (!(aiData?.unreadSessionIds || []).includes(currentSessionId)) {
      return;
    }

    uiState.markSessionRead(currentSessionId);
  }, [aiData?.unreadSessionIds, loaded, uiState]);

  useEffect(() => {
    if (!loaded) {
      load();
    }
  }, [loaded, load]);

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
      store.updateAIData({ providers: nextProviders }, suppressStartupAIPersistRef.current);
    }
  }, [loaded]);

  useEffect(() => {
    if (!loaded || !accountConnected) {
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const models = await fetchManagedModels();
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

        const providersChanged = !areProvidersEqual(ai.providers, nextProviders);
        const modelsChanged = !areModelsEqual(ai.models, nextModels);
        const selectedModelChanged = ai.selectedModelId !== selectedModelId;

        if (!providersChanged && !modelsChanged && !selectedModelChanged) {
          void useManagedAIStore.getState().refreshBudget();
          return;
        }

        store.updateAIData({
          providers: nextProviders,
          models: nextModels,
          selectedModelId,
        }, suppressStartupAIPersistRef.current);
        void useManagedAIStore.getState().refreshBudget();
      } catch (error) {
        if (!isManagedServiceRecoverableError(error)) {
          console.error('Failed to sync managed AI models from Worker', error);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loaded, accountConnected]);

  useEffect(() => {
    if (!loaded || accountConnected) {
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
    }, suppressStartupAIPersistRef.current);
    useManagedAIStore.getState().clearBudget();
  }, [loaded, accountConnected]);
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
  const nextManaged = managed ?? createManagedProvider(now)
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
  const existingModels = new Map(
    allModels
      .filter((model) => model.providerId === providerId)
      .map((model) => [model.id, model] as const)
  )

  return [
    ...otherModels,
    ...nextModels.map((model) => {
      const existing = existingModels.get(model.id)
      if (!existing) {
        return model
      }

      if (
        existing.apiModelId === model.apiModelId &&
        existing.name === model.name &&
        existing.providerId === model.providerId &&
        existing.group === model.group
      ) {
        return existing
      }

      return {
        ...model,
        createdAt: existing.createdAt,
        enabled: existing.enabled,
        pinned: existing.pinned,
      }
    }),
  ]
}

function areProvidersEqual(left: Provider[], right: Provider[]): boolean {
  if (left.length !== right.length) {
    return false
  }

  return left.every((provider, index) => {
    const other = right[index]
    return !!other && (
      provider.id === other.id &&
      provider.name === other.name &&
      provider.icon === other.icon &&
      provider.type === other.type &&
      provider.apiHost === other.apiHost &&
      provider.apiKey === other.apiKey &&
      provider.enabled === other.enabled &&
      provider.createdAt === other.createdAt &&
      provider.updatedAt === other.updatedAt
    )
  })
}

function areModelsEqual(left: AIModel[], right: AIModel[]): boolean {
  if (left.length !== right.length) {
    return false
  }

  return left.every((model, index) => {
    const other = right[index]
    return !!other && (
      model.id === other.id &&
      model.apiModelId === other.apiModelId &&
      model.name === other.name &&
      model.providerId === other.providerId &&
      model.group === other.group &&
      model.enabled === other.enabled &&
      model.pinned === other.pinned &&
      model.createdAt === other.createdAt
    )
  })
}

function filterModelsByEnabledProviders(models: AIModel[], providers: Provider[]): AIModel[] {
  const enabledProviderIds = new Set(
    providers.filter((provider) => provider.enabled !== false).map((provider) => provider.id)
  )
  return models.filter((model) => enabledProviderIds.has(model.providerId))
}

export const actions = {
  addProvider: (provider: Omit<Provider, 'id' | 'createdAt' | 'updatedAt'>) => {
    const id = generateId('provider-')
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
    const ai = state.data.ai!;
    const providers = state.data.ai?.providers || [];
    const nextProviders = providers.map((p) =>
      p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p
    );
    const enabledModels = filterModelsByEnabledProviders(ai.models, nextProviders)
    state.updateAIData({
      providers: nextProviders,
      selectedModelId: chooseFallbackSelectedModelId(ai.selectedModelId, enabledModels)
    })
  },

  deleteProvider: (id: string) => {
    if (isManagedProviderId(id)) {
      return
    }
    const state = useUnifiedStore.getState();
    const ai = state.data.ai!;
    const remainingModels = ai.models.filter((m) => m.providerId !== id)
    const nextBenchmarkResults = { ...(ai.benchmarkResults || {}) }
    const nextFetchedModels = { ...(ai.fetchedModels || {}) }
    delete nextBenchmarkResults[id]
    delete nextFetchedModels[id]
    state.updateAIData({
      providers: ai.providers.filter((p) => p.id !== id),
      models: remainingModels,
      benchmarkResults: nextBenchmarkResults,
      fetchedModels: nextFetchedModels,
      selectedModelId: chooseFallbackSelectedModelId(
        ai.selectedModelId && ai.models.find(m => m.id === ai.selectedModelId)?.providerId === id ? null : ai.selectedModelId,
        remainingModels
      )
    })
  },

  addModel: (model: Omit<AIModel, 'createdAt'>) => {
    const state = useUnifiedStore.getState();
    const ai = state.data.ai!;
    if (!model.apiModelId.trim()) return
    const newModel: AIModel = {
      ...model,
      id: buildScopedModelId(model.providerId, model.apiModelId),
      name: model.name || generateModelName(model.apiModelId),
      group: model.group || generateModelGroup(model.apiModelId),
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
    const newModels: AIModel[] = models
      .filter((model) => model.apiModelId.trim().length > 0)
      .map((model) => ({
        ...model,
        id: buildScopedModelId(model.providerId, model.apiModelId),
        name: model.name || generateModelName(model.apiModelId),
        group: model.group || generateModelGroup(model.apiModelId),
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
    const model = ai.models.find((item) => item.id === id)
    const nextBenchmarkResults = { ...(ai.benchmarkResults || {}) }
    if (model) {
      const currentProviderResults = nextBenchmarkResults[model.providerId]
      if (currentProviderResults?.items[id]) {
        const nextItems = { ...currentProviderResults.items }
        delete nextItems[id]
        nextBenchmarkResults[model.providerId] = {
          ...currentProviderResults,
          items: nextItems,
          updatedAt: Date.now(),
        }
      }
    }
    state.updateAIData({
      models: ai.models.filter((m) => m.id !== id),
      benchmarkResults: nextBenchmarkResults,
      selectedModelId: ai.selectedModelId === id ? null : ai.selectedModelId
    })
  },

  setProviderBenchmarkResults: (providerId: string, record: ProviderBenchmarkRecord) => {
    const state = useUnifiedStore.getState();
    const ai = state.data.ai!;
    state.updateAIData({
      benchmarkResults: {
        ...(ai.benchmarkResults || {}),
        [providerId]: record,
      }
    });
  },

  clearProviderBenchmarkResults: (providerId: string) => {
    const state = useUnifiedStore.getState();
    const ai = state.data.ai!;
    if (!ai.benchmarkResults?.[providerId]) {
      return;
    }
    const nextBenchmarkResults = { ...ai.benchmarkResults };
    delete nextBenchmarkResults[providerId];
    state.updateAIData({ benchmarkResults: nextBenchmarkResults });
  },

  setProviderFetchedModels: (providerId: string, modelIds: string[]) => {
    const state = useUnifiedStore.getState();
    const ai = state.data.ai!;
    state.updateAIData({
      fetchedModels: {
        ...(ai.fetchedModels || {}),
        [providerId]: [...new Set(modelIds)],
      }
    });
  },

  clearProviderFetchedModels: (providerId: string) => {
    const state = useUnifiedStore.getState();
    const ai = state.data.ai!;
    if (!ai.fetchedModels?.[providerId]) {
      return;
    }
    const nextFetchedModels = { ...ai.fetchedModels };
    delete nextFetchedModels[providerId];
    state.updateAIData({ fetchedModels: nextFetchedModels });
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
    const models = await fetchManagedModels()
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
  ...createChatActions(),
};

export const useAIStore = () => {
  const aiData = useUnifiedStore(s => s.data.ai);
  const uiState = useAIUIStore();

  return {
    providers: aiData?.providers || [],
    models: aiData?.models || [],
    benchmarkResults: aiData?.benchmarkResults || {},
    fetchedModels: aiData?.fetchedModels || {},
    sessions: aiData?.sessions || [],
    messages: aiData?.messages || {},
    selectedModelId: aiData?.selectedModelId || null,
    customSystemPrompt: aiData?.customSystemPrompt || '',
    includeTimeContext: aiData?.includeTimeContext !== false,
    
    ...uiState,
    ...actions,

    getProvider: (id: string) => aiData?.providers.find(p => p.id === id),
    getModel: (id: string) => aiData?.models.find(m => m.id === id),
    getSelectedModel: () => {
      if (!aiData?.selectedModelId) return undefined
      const selectedModel = aiData.models.find(m => m.id === aiData.selectedModelId)
      if (!selectedModel) return undefined
      const provider = aiData.providers.find((item) => item.id === selectedModel.providerId)
      return provider?.enabled === false ? undefined : selectedModel
    },
    getModelsByProvider: (pid: string) => {
      const provider = aiData?.providers.find((item) => item.id === pid)
      if (provider?.enabled === false) return []
      return aiData?.models.filter(m => m.providerId === pid && m.enabled) || []
    },
    isTemporarySession: (sessionId: string) => {
      const session = aiData?.sessions.find((item) => item.id === sessionId);
      return isTemporarySessionId(sessionId) || isTemporarySession(session);
    },
    
    isSessionLoading: (sessionId: string) => !!uiState.generatingSessions[sessionId],
    isSessionUnread: (sessionId: string) => !!aiData?.unreadSessionIds?.includes(sessionId),
    isLoading: uiState.currentSessionId ? !!uiState.generatingSessions[uiState.currentSessionId] : false,
    selectedModel: aiData?.selectedModelId
      ? (() => {
          const model = aiData.models.find(m => m.id === aiData.selectedModelId)
          if (!model) return undefined
          const provider = aiData.providers.find((item) => item.id === model.providerId)
          return provider?.enabled === false ? undefined : model
        })()
      : undefined
  };
};
