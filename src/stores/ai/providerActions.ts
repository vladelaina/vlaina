import type { AIModel, Provider, ProviderBenchmarkRecord } from '@/lib/ai/types'
import { generateId } from '@/lib/id'
import { buildScopedModelId, generateModelGroup, generateModelName } from '@/lib/ai/utils'
import {
  MANAGED_PROVIDER_ID,
  fetchManagedModels,
  isManagedProviderId,
} from '@/lib/ai/managedService'
import { useManagedAIStore } from '../useManagedAIStore'
import { useUnifiedStore } from '../unified/useUnifiedStore'
import { createChatActions } from './chatActions'
import {
  chooseFallbackSelectedModelId,
  ensureManagedProvider,
  filterModelsByEnabledProviders,
  replaceProviderModels,
} from './providerStoreUtils'

function isDefaultChannelLabel(name: string): boolean {
  return /^channel\s+\d+$/i.test(name.trim());
}

function shouldDeleteIncompleteCustomProvider(provider: Provider): boolean {
  return (
    !isManagedProviderId(provider.id) &&
    isDefaultChannelLabel(provider.name) &&
    !provider.apiHost.trim() &&
    !provider.apiKey.trim()
  );
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
    if (isManagedProviderId(id)) return

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
    if (isManagedProviderId(id)) return

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

  deleteIncompleteCustomProviders: () => {
    const state = useUnifiedStore.getState();
    const ai = state.data.ai!;
    const providerIdsToDelete = new Set(
      ai.providers
        .filter(shouldDeleteIncompleteCustomProvider)
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
      selectedModelId: chooseFallbackSelectedModelId(
        selectedModelProviderId && providerIdsToDelete.has(selectedModelProviderId)
          ? null
          : ai.selectedModelId,
        remainingModels
      ),
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
    const newModels: AIModel[] = models
      .filter((model) => model.apiModelId.trim().length > 0)
      .map((model) => ({
        ...model,
        id: buildScopedModelId(model.providerId, model.apiModelId),
        name: model.name || generateModelName(model.apiModelId),
        group: model.group || generateModelGroup(model.apiModelId),
        createdAt: now
      }))

    const updates: { models: AIModel[]; selectedModelId?: string } = { models: [...ai.models, ...newModels] };
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
    if (!ai.benchmarkResults?.[providerId]) return;

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
