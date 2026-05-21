import { useEffect, useRef } from 'react'
import { useUnifiedStore } from './unified/useUnifiedStore'
import { useAccountSessionStore } from './accountSession'
import { useManagedAIStore } from './useManagedAIStore'
import {
  isManagedServiceRecoverableError,
} from '@/lib/ai/managedService'
import {
  isTemporarySession,
  isTemporarySessionId,
} from '@/lib/ai/temporaryChat';
import { useAIUIStore } from './ai/chatState'
import { readWindowLaunchContext } from '@/lib/desktop/launchContext'
import { actions, managedProviderSync } from './ai/providerActions'
import {
  ensureManagedProvider,
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
      const requestedSessionId = launchContext.chatSessionId;
      const currentSessionId = requestedSessionId && aiData?.sessions.some((session) => session.id === requestedSessionId)
        ? requestedSessionId
        : null;
      uiState.initializeSelection({ currentSessionId, temporaryChatEnabled: false });
      if (currentSessionId) {
        void actions.switchSession(currentSessionId);
      }
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
    if (!loaded) {
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        await managedProviderSync.syncFromStartup({
          refreshBudget: false,
          suppressPersist: suppressStartupAIPersistRef.current,
        });
        if (cancelled) return;

        if (!accountConnected) {
          useManagedAIStore.getState().clearBudget();
        }
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
    useManagedAIStore.getState().clearBudget();
  }, [loaded, accountConnected]);
}

let didStartAIStoreRuntimeEffects = false;

export function startAIStoreRuntimeEffects(): void {
  if (didStartAIStoreRuntimeEffects) return;
  didStartAIStoreRuntimeEffects = true;

  const launchContext = readWindowLaunchContext();
  const suppressStartupAIPersist = launchContext.isNewWindow && launchContext.viewMode === 'chat';

  const ensureLoaded = () => {
    const store = useUnifiedStore.getState();
    if (!store.loaded) {
      void store.load();
    }
  };

  const syncSelection = () => {
    const store = useUnifiedStore.getState();
    const aiData = store.data.ai;
    const uiState = useAIUIStore.getState();

    if (!store.loaded || uiState.selectionInitialized) {
      return;
    }

    if (launchContext.isNewWindow && launchContext.viewMode === 'chat') {
      const requestedSessionId = launchContext.chatSessionId;
      const currentSessionId = requestedSessionId && aiData?.sessions.some((session) => session.id === requestedSessionId)
        ? requestedSessionId
        : null;
      uiState.initializeSelection({ currentSessionId, temporaryChatEnabled: false });
      if (currentSessionId) {
        void actions.switchSession(currentSessionId);
      }
      return;
    }

    uiState.initializeSelection({
      currentSessionId: aiData?.currentSessionId ?? null,
      temporaryChatEnabled: !!aiData?.temporaryChatEnabled,
    });
  };

  const syncIntegrity = () => {
    const store = useUnifiedStore.getState();
    const aiData = store.data.ai;
    const uiState = useAIUIStore.getState();

    if (!store.loaded || !uiState.selectionInitialized) {
      return;
    }

    const currentSessionId = uiState.currentSessionId;
    const currentSession = currentSessionId
      ? aiData?.sessions.find((session) => session.id === currentSessionId)
      : null;
    const hasActiveTemporarySession =
      isTemporarySessionId(currentSessionId) || isTemporarySession(currentSession);

    if (uiState.temporaryChatEnabled && !hasActiveTemporarySession) {
      uiState.setTemporaryChatEnabled(false);
    }

    if (
      currentSessionId &&
      !isTemporarySessionId(currentSessionId) &&
      !aiData?.sessions.some((session) => session.id === currentSessionId)
    ) {
      uiState.setCurrentSessionId(null);
    }

    if (currentSessionId && aiData?.unreadSessionIds?.includes(currentSessionId)) {
      uiState.markSessionRead(currentSessionId);
    }
  };

  const syncManagedProvider = () => {
    const store = useUnifiedStore.getState();
    const ai = store.data.ai;
    if (!store.loaded || !ai) return;

    const nextProviders = ensureManagedProvider(ai.providers);
    const providersChanged =
      nextProviders.length !== ai.providers.length ||
      nextProviders.some((provider, index) => ai.providers[index]?.id !== provider.id);

    if (providersChanged) {
      store.updateAIData({ providers: nextProviders }, suppressStartupAIPersist);
    }
  };

  const syncManagedService = () => {
    const store = useUnifiedStore.getState();
    if (!store.loaded) return;

    const accountConnected = useAccountSessionStore.getState().isConnected;
    if (!accountConnected) {
      useManagedAIStore.getState().clearBudget();
    }

    void managedProviderSync.syncFromStartup({
      refreshBudget: false,
      suppressPersist: suppressStartupAIPersist,
    }).then(() => {
      if (!useAccountSessionStore.getState().isConnected) {
        useManagedAIStore.getState().clearBudget();
      }
    }).catch((error) => {
      if (!isManagedServiceRecoverableError(error)) {
        console.error('Failed to sync managed AI models from Worker', error);
      }
    });
  };

  ensureLoaded();
  syncSelection();
  syncIntegrity();
  syncManagedProvider();
  syncManagedService();

  useUnifiedStore.subscribe(() => {
    ensureLoaded();
    syncSelection();
    syncIntegrity();
    syncManagedProvider();
  });

  useAccountSessionStore.subscribe(() => {
    syncManagedService();
  });
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
    webSearchEnabled: aiData?.webSearchEnabled === true,
    
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
