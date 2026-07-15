import { readWindowLaunchContext } from '@/lib/desktop/launchContext';
import { isManagedServiceRecoverableError } from '@/lib/ai/managedService';
import { isTemporarySession, isTemporarySessionId } from '@/lib/ai/temporaryChat';
import { useAccountSessionStore } from '../accountSession';
import { useUnifiedStore } from '../unified/useUnifiedStore';
import { clearManagedBudgetUnlessQuotaExhausted } from '../useManagedAIStore';
import { actions, managedProviderSync } from './providerActions';
import { useAIUIStore } from './chatState';
import { ensureManagedProvider } from './providerStoreUtils';
import { resolveRestoredChatSessionId } from './runtimeSelection';

let didStartAIStoreRuntimeEffects = false;

export function startAIStoreRuntimeEffects(): void {
  if (didStartAIStoreRuntimeEffects) return;
  didStartAIStoreRuntimeEffects = true;

  const launchContext = readWindowLaunchContext();
  const suppressStartupAIPersist = launchContext.isNewWindow && launchContext.viewMode === 'chat';

  const ensureLoaded = () => {
    const store = useUnifiedStore.getState();
    if (!store.loaded) {
      void store.load().catch(() => undefined);
    }
  };

  const syncSelection = () => {
    const store = useUnifiedStore.getState();
    const aiData = store.data.ai;
    const lastChatSessionId = store.data.settings.ui?.lastChatSessionId;
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
        void actions.switchSession(currentSessionId).catch(() => undefined);
      }
      return;
    }

    const currentSessionId = resolveRestoredChatSessionId(aiData, lastChatSessionId);
    uiState.initializeSelection({
      currentSessionId,
      temporaryChatEnabled: !!aiData?.temporaryChatEnabled,
    });
    if (currentSessionId && !aiData?.temporaryChatEnabled) {
      void actions.switchSession(currentSessionId).catch(() => undefined);
    }
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
      clearManagedBudgetUnlessQuotaExhausted();
    }

    void managedProviderSync.syncFromStartup({
      refreshBudget: false,
      suppressPersist: suppressStartupAIPersist,
    }).then(() => {
      if (!useAccountSessionStore.getState().isConnected) {
        clearManagedBudgetUnlessQuotaExhausted();
      }
    }).catch((error) => {
      if (!isManagedServiceRecoverableError(error)) {
      }
    });
  };

  ensureLoaded();
  syncSelection();
  syncIntegrity();
  syncManagedProvider();
  syncManagedService();

  let wasUnifiedLoaded = useUnifiedStore.getState().loaded;
  let previousModels = useUnifiedStore.getState().data.ai?.models;
  useUnifiedStore.subscribe(() => {
    const store = useUnifiedStore.getState();
    const loadedChangedToReady = !wasUnifiedLoaded && store.loaded;
    const modelsChanged = previousModels !== store.data.ai?.models;
    wasUnifiedLoaded = store.loaded;
    previousModels = store.data.ai?.models;

    ensureLoaded();
    syncSelection();
    syncIntegrity();
    syncManagedProvider();
    if (loadedChangedToReady) {
      syncManagedService();
    } else if (store.loaded && modelsChanged) {
      managedProviderSync.reconcileAfterStoreChange();
    }
  });

  useAccountSessionStore.subscribe(() => {
    syncManagedService();
  });
}
