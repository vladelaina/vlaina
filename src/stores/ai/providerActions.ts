import type { AIModel, Provider, ProviderBenchmarkRecord } from '@/lib/ai/types'
import { generateId } from '@/lib/id'
import { buildScopedModelId, generateModelGroup, generateModelName } from '@/lib/ai/utils'
import {
  MANAGED_PROVIDER_ID,
  fetchManagedModelCatalog,
  fetchManagedModelsVersion,
  isManagedProviderId,
} from '@/lib/ai/managedService'
import { useAccountSessionStore } from '../accountSession'
import { useManagedAIStore } from '../useManagedAIStore'
import { useUnifiedStore } from '../unified/useUnifiedStore'
import { createChatActions } from './chatActions'
import {
  areModelsEqual,
  chooseFallbackSelectedModelId,
  ensureManagedProvider,
  filterModelsByEnabledProviders,
  replaceProviderModels,
} from './providerStoreUtils'

const MANAGED_MODELS_REFRESH_MIN_INTERVAL_MS = 5 * 60 * 1000;
const MANAGED_MODELS_FORCED_REFRESH_MIN_INTERVAL_MS = 15 * 1000;
let managedModelsRefreshInFlight: Promise<void> | null = null;
let managedModelsLastRefreshAttemptAt = 0;
let managedModelsLastForcedRefreshAttemptAt = 0;
let managedModelsCatalogVersion: string | null = null;
let managedModelsSyncGeneration = 0;
const locallyCreatedProviderIds = new Set<string>();

async function refreshManagedBudgetIfConnected(): Promise<void> {
  if (!useAccountSessionStore.getState().isConnected) {
    return;
  }
  await useManagedAIStore.getState().refreshBudget();
}

async function syncManagedProviderModels(options: { refreshBudget?: boolean; suppressPersist?: boolean } = {}): Promise<void> {
  const syncGeneration = managedModelsSyncGeneration + 1
  managedModelsSyncGeneration = syncGeneration
  const catalog = await fetchManagedModelCatalog()
  if (syncGeneration !== managedModelsSyncGeneration) {
    return
  }

  const models = catalog.models
  managedModelsCatalogVersion = catalog.version
  const store = useUnifiedStore.getState()
  const ai = store.data.ai!
  const nextProviders = ensureManagedProvider(ai.providers)
  const nextModels = replaceProviderModels(ai.models, MANAGED_PROVIDER_ID, models)
  const selectedModelId = chooseFallbackSelectedModelId(
    ai.selectedModelId,
    nextModels,
    MANAGED_PROVIDER_ID
  )

  const providersChanged =
    nextProviders.length !== ai.providers.length ||
    nextProviders.some((provider, index) => ai.providers[index]?.id !== provider.id)
  const modelsChanged = !areModelsEqual(ai.models, nextModels)
  const selectedModelChanged = ai.selectedModelId !== selectedModelId

  if (providersChanged || modelsChanged || selectedModelChanged) {
    store.updateAIData({
      providers: nextProviders,
      models: nextModels,
      selectedModelId,
    }, options.suppressPersist)
  }

  if (options.refreshBudget) {
    await refreshManagedBudgetIfConnected()
  }
}

function refreshManagedProviderInBackground(options: { force?: boolean } = {}): Promise<void> | null {
  const now = Date.now();
  if (
    options.force &&
    managedModelsLastForcedRefreshAttemptAt > 0 &&
    now - managedModelsLastForcedRefreshAttemptAt < MANAGED_MODELS_FORCED_REFRESH_MIN_INTERVAL_MS
  ) {
    return managedModelsRefreshInFlight;
  }

  if (
    !options.force &&
    managedModelsLastRefreshAttemptAt > 0 &&
    now - managedModelsLastRefreshAttemptAt < MANAGED_MODELS_REFRESH_MIN_INTERVAL_MS
  ) {
    return managedModelsRefreshInFlight;
  }

  if (managedModelsRefreshInFlight) {
    return managedModelsRefreshInFlight;
  }

  managedModelsLastRefreshAttemptAt = now;
  if (options.force) {
    managedModelsLastForcedRefreshAttemptAt = now;
  }
  managedModelsRefreshInFlight = (async () => {
    if (options.force && managedModelsCatalogVersion) {
      const latestVersion = await fetchManagedModelsVersion();
      if (latestVersion && latestVersion === managedModelsCatalogVersion) {
        return;
      }
    }
    await syncManagedProviderModels();
  })()
    .catch((_error) => {
      void 0
    })
    .finally(() => {
      managedModelsRefreshInFlight = null;
    });

  return managedModelsRefreshInFlight;
}

async function syncManagedProviderModelsFromStartup(
  options: { refreshBudget?: boolean; suppressPersist?: boolean } = {}
): Promise<void> {
  const now = Date.now();
  if (managedModelsRefreshInFlight) {
    await managedModelsRefreshInFlight;
    if (options.refreshBudget) {
      await refreshManagedBudgetIfConnected();
    }
    return;
  }

  if (
    managedModelsLastRefreshAttemptAt > 0 &&
    now - managedModelsLastRefreshAttemptAt < MANAGED_MODELS_REFRESH_MIN_INTERVAL_MS
  ) {
    if (options.refreshBudget) {
      await refreshManagedBudgetIfConnected();
    }
    return;
  }

  managedModelsLastRefreshAttemptAt = now;
  await syncManagedProviderModels(options);
}

function isDefaultChannelLabel(name: string): boolean {
  return /^channel\s*\d+$/i.test(name.trim());
}

function shouldDeleteIncompleteCustomProvider(provider: Provider): boolean {
  return (
    !isManagedProviderId(provider.id) &&
    isDefaultChannelLabel(provider.name) &&
    !provider.apiHost.trim() &&
    !provider.apiKey.trim()
  );
}

function areStringArraysEqual(left: readonly string[] = [], right: readonly string[] = []): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function areBenchmarkRecordsEqual(
  left: ProviderBenchmarkRecord | undefined,
  right: ProviderBenchmarkRecord
): boolean {
  if (!left) return false;
  if (left.overall !== right.overall || left.updatedAt !== right.updatedAt) return false;

  const leftItems = left.items || {};
  const rightItems = right.items || {};
  const leftKeys = Object.keys(leftItems);
  const rightKeys = Object.keys(rightItems);
  if (leftKeys.length !== rightKeys.length) return false;

  return leftKeys.every((key) => {
    const leftItem = leftItems[key];
    const rightItem = rightItems[key];
    return !!leftItem && !!rightItem &&
      leftItem.status === rightItem.status &&
      leftItem.latency === rightItem.latency &&
      leftItem.error === rightItem.error &&
      leftItem.checkedAt === rightItem.checkedAt;
  });
}

export const actions = {
  addProvider: (provider: Omit<Provider, 'id' | 'createdAt' | 'updatedAt'>) => {
    const id = generateId('provider-')
    const now = Date.now()
    const newProvider: Provider = { ...provider, id, createdAt: now, updatedAt: now }
    locallyCreatedProviderIds.add(id)
    const state = useUnifiedStore.getState();
    const currentProviders = state.data.ai?.providers || [];
    state.updateAIData({ providers: [...currentProviders, newProvider] });
    return id
  },

  updateProvider: (id: string, updates: Partial<Provider>) => {
    if (isManagedProviderId(id)) return

    const state = useUnifiedStore.getState();
    const ai = state.data.ai!;
    const providers = state.data.ai?.providers || [];
    const provider = providers.find((item) => item.id === id);
    if (!provider) return;

    const hasProviderChanges = (Object.entries(updates) as Array<[keyof Provider, Provider[keyof Provider]]>)
      .some(([key, value]) => !Object.is(provider[key], value));
    if (!hasProviderChanges) return;

    const nextProviders = providers.map((p) =>
      p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p
    );
    const enabledModels = filterModelsByEnabledProviders(ai.models, nextProviders)
    state.updateAIData({
      providers: nextProviders,
      selectedModelId: chooseFallbackSelectedModelId(ai.selectedModelId, enabledModels)
    })
  },

  reorderCustomProviders: (orderedProviderIds: string[]) => {
    const state = useUnifiedStore.getState();
    const ai = state.data.ai!;
    const providers = ai.providers || [];
    const managedProviders = providers.filter((provider) => isManagedProviderId(provider.id));
    const customProviders = providers.filter((provider) => !isManagedProviderId(provider.id));
    const customProviderById = new Map(customProviders.map((provider) => [provider.id, provider] as const));
    const usedProviderIds = new Set<string>();
    const nextCustomProviders: Provider[] = [];

    orderedProviderIds.forEach((providerId) => {
      const provider = customProviderById.get(providerId);
      if (!provider || usedProviderIds.has(providerId)) {
        return;
      }
      usedProviderIds.add(providerId);
      nextCustomProviders.push(provider);
    });

    customProviders.forEach((provider) => {
      if (!usedProviderIds.has(provider.id)) {
        nextCustomProviders.push(provider);
      }
    });

    const nextProviders = [...managedProviders, ...nextCustomProviders];
    const orderChanged = nextProviders.length !== providers.length ||
      nextProviders.some((provider, index) => providers[index]?.id !== provider.id);

    if (!orderChanged) {
      return;
    }

    state.updateAIData({ providers: nextProviders });
  },

  deleteProvider: (id: string) => {
    if (isManagedProviderId(id)) return

    const state = useUnifiedStore.getState();
    const ai = state.data.ai!;
    if (!ai.providers.some((provider) => provider.id === id)) return;

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
      deletedProviderIds: Array.from(new Set([...(ai.deletedProviderIds || []), id])),
      selectedModelId: chooseFallbackSelectedModelId(
        ai.selectedModelId && ai.models.find(m => m.id === ai.selectedModelId)?.providerId === id ? null : ai.selectedModelId,
        remainingModels
      )
    })
  },

  deleteIncompleteCustomProviders: () => {
    const state = useUnifiedStore.getState();
    const ai = state.data.ai!;
    const providerIdsToDelete = new Set(
      ai.providers
        .filter((provider) =>
          locallyCreatedProviderIds.has(provider.id) &&
          shouldDeleteIncompleteCustomProvider(provider)
        )
        .map((provider) => provider.id)
    );

    if (providerIdsToDelete.size === 0) {
      return;
    }

    const remainingModels = ai.models.filter((model) => !providerIdsToDelete.has(model.providerId));
    const nextBenchmarkResults = { ...(ai.benchmarkResults || {}) };
    const nextFetchedModels = { ...(ai.fetchedModels || {}) };
    providerIdsToDelete.forEach((providerId) => {
      delete nextBenchmarkResults[providerId];
      delete nextFetchedModels[providerId];
    });

    const selectedModelProviderId = ai.selectedModelId
      ? ai.models.find((model) => model.id === ai.selectedModelId)?.providerId
      : undefined;

    state.updateAIData({
      providers: ai.providers.filter((provider) => !providerIdsToDelete.has(provider.id)),
      models: remainingModels,
      benchmarkResults: nextBenchmarkResults,
      fetchedModels: nextFetchedModels,
      deletedProviderIds: Array.from(new Set([...(ai.deletedProviderIds || []), ...providerIdsToDelete])),
      selectedModelId: chooseFallbackSelectedModelId(
        selectedModelProviderId && providerIdsToDelete.has(selectedModelProviderId)
          ? null
          : ai.selectedModelId,
        remainingModels
      ),
    });
    providerIdsToDelete.forEach((providerId) => {
      locallyCreatedProviderIds.delete(providerId);
    });
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
    if (ai.models.some((item) => item.id.toLowerCase() === newModel.id.toLowerCase())) {
      return;
    }

    const updates: { models: AIModel[]; selectedModelId?: string } = { models: [...ai.models, newModel] };
    if (!ai.selectedModelId) {
      updates.selectedModelId = newModel.id;
    }
    state.updateAIData(updates);
  },

  addModels: (models: Array<Omit<AIModel, 'createdAt'>>) => {
    const state = useUnifiedStore.getState();
    const ai = state.data.ai!;
    const now = Date.now()
    const existingIds = new Set(ai.models.map((model) => model.id.toLowerCase()))
    const queuedIds = new Set<string>()
    const newModels: AIModel[] = models
      .filter((model) => model.apiModelId.trim().length > 0)
      .flatMap((model) => {
        const id = buildScopedModelId(model.providerId, model.apiModelId)
        const normalizedId = id.toLowerCase()
        if (existingIds.has(normalizedId) || queuedIds.has(normalizedId)) {
          return []
        }
        queuedIds.add(normalizedId)
        return [{
          ...model,
          id,
          name: model.name || generateModelName(model.apiModelId),
          group: model.group || generateModelGroup(model.apiModelId),
          createdAt: now
        }]
      })

    if (newModels.length === 0) {
      return
    }

    const updates: { models: AIModel[]; selectedModelId?: string } = { models: [...ai.models, ...newModels] };
    if (!ai.selectedModelId && newModels.length > 0) {
      updates.selectedModelId = newModels[0].id;
    }
    state.updateAIData(updates);
  },

  updateModel: (id: string, updates: Partial<AIModel>) => {
    const state = useUnifiedStore.getState();
    const ai = state.data.ai!;
    const model = ai.models.find((item) => item.id === id);
    if (!model) return;

    const hasModelChanges = (Object.entries(updates) as Array<[keyof AIModel, AIModel[keyof AIModel]]>)
      .some(([key, value]) => !Object.is(model[key], value));
    if (!hasModelChanges) return;

    state.updateAIData({
      models: ai.models.map((m) => m.id === id ? { ...m, ...updates } : m)
    })
  },

  deleteModel: (id: string) => {
    const state = useUnifiedStore.getState();
    const ai = state.data.ai!;
    const model = ai.models.find((item) => item.id === id)
    if (!model) return;

    const nextBenchmarkResults = { ...(ai.benchmarkResults || {}) }
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
    state.updateAIData({
      models: ai.models.filter((m) => m.id !== id),
      benchmarkResults: nextBenchmarkResults,
      selectedModelId: ai.selectedModelId === id ? null : ai.selectedModelId
    })
  },

  setProviderBenchmarkResults: (providerId: string, record: ProviderBenchmarkRecord) => {
    const state = useUnifiedStore.getState();
    const ai = state.data.ai!;
    if (areBenchmarkRecordsEqual(ai.benchmarkResults?.[providerId], record)) return;

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
    if (!ai.benchmarkResults?.[providerId]) return;

    const nextBenchmarkResults = { ...ai.benchmarkResults };
    delete nextBenchmarkResults[providerId];
    state.updateAIData({ benchmarkResults: nextBenchmarkResults });
  },

  setProviderFetchedModels: (providerId: string, modelIds: string[]) => {
    const state = useUnifiedStore.getState();
    const ai = state.data.ai!;
    const nextModelIds = [...new Set(modelIds)];
    if (areStringArraysEqual(ai.fetchedModels?.[providerId] || [], nextModelIds)) {
      return;
    }

    state.updateAIData({
      fetchedModels: {
        ...(ai.fetchedModels || {}),
        [providerId]: nextModelIds,
      }
    });
  },

  clearProviderFetchedModels: (providerId: string) => {
    const state = useUnifiedStore.getState();
    const ai = state.data.ai!;
    if (!ai.fetchedModels?.[providerId]) return;

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

  setWebSearchEnabled: (enabled: boolean) => {
    useUnifiedStore.getState().updateAIData({ webSearchEnabled: enabled });
  },

  refreshManagedProvider: async () => {
    managedModelsLastRefreshAttemptAt = Date.now();
    await syncManagedProviderModels({ refreshBudget: true })
  },

  refreshManagedProviderInBackground: (options: { force?: boolean } = {}) => {
    void refreshManagedProviderInBackground(options)
  },
  ...createChatActions(),
};

export const managedProviderSync = {
  syncFromStartup: syncManagedProviderModelsFromStartup,
};
