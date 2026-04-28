import { useEffect, useRef } from 'react'
import { useUnifiedStore } from './unified/useUnifiedStore'
import { useAccountSessionStore } from './accountSession'
import { useManagedAIStore } from './useManagedAIStore'
import {
  MANAGED_PROVIDER_ID,
  fetchManagedModels,
  isManagedServiceRecoverableError,
} from '@/lib/ai/managedService'
import {
  isTemporarySession,
  isTemporarySessionId,
} from '@/lib/ai/temporaryChat';
import { useAIUIStore } from './ai/chatState'
import { readWindowLaunchContext } from '@/lib/desktop/launchContext'
import { actions } from './ai/providerActions'
import {
  areModelsEqual,
  areProvidersEqual,
  chooseFallbackSelectedModelId,
  ensureManagedProvider,
  replaceProviderModels,
} from './ai/providerStoreUtils'

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

export { actions } from './ai/providerActions'

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
