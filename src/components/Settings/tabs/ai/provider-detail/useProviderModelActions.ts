import { useState } from 'react';
import { openaiClient } from '@/lib/ai/providers/openai';
import type { AIModel, Provider } from '@/lib/ai/types';

export function useProviderModelActions({
  provider,
  providerModels,
  canUseConnectionActions,
  draft,
  addModel,
  addModels,
  deleteModel,
  setFetchedModels,
  setProviderFetchedModels,
  resetBenchmarkState,
}: {
  provider: Provider | undefined;
  providerModels: AIModel[];
  canUseConnectionActions: boolean;
  draft: { name: string; apiHost: string; apiKey: string; enabled: boolean };
  addModel: (model: { id: string; apiModelId: string; name: string; providerId: string; enabled: boolean }) => void;
  addModels: (models: Array<{ id: string; apiModelId: string; name: string; providerId: string; enabled: boolean }>) => void;
  deleteModel: (modelId: string) => void;
  setFetchedModels: (models: string[]) => void;
  setProviderFetchedModels: (providerId: string, models: string[]) => void;
  resetBenchmarkState: () => void;
}) {
  const [fetchError, setFetchError] = useState('');
  const [isFetchingModels, setIsFetchingModels] = useState(false);

  const buildTempProvider = (): Provider | null => {
    if (!provider) return null;
    return {
      ...provider,
      name: draft.name,
      apiHost: draft.apiHost,
      apiKey: draft.apiKey,
      enabled: draft.enabled,
      updatedAt: Date.now(),
    };
  };

  const handleFetchModels = async () => {
    if (!canUseConnectionActions) {
      setFetchError('Please provide Base URL and API Key first.');
      return;
    }

    if (!provider) return;

    const tempProvider = buildTempProvider();
    if (!tempProvider) return;
    const currentProviderId = provider.id;

    setIsFetchingModels(true);
    setFetchError('');

    try {
      const result = await openaiClient.getModelsWithEndpointDetection(tempProvider);
      const modelsList = result.models;
      setFetchedModels(modelsList);
      setProviderFetchedModels(currentProviderId, modelsList);
      if (modelsList.length === 0) {
        setFetchError('Connected, but no models were returned.');
      }
    } catch {
      setFetchError('Unable to fetch models from the current endpoint.');
    } finally {
      setIsFetchingModels(false);
    }
  };

  const handleAddModel = (id: string, displayName?: string): boolean => {
    if (!id.trim() || !provider) return false;

    const trimmedId = id.trim();
    const existsInProvider = providerModels.some((m) => m.apiModelId.toLowerCase() === trimmedId.toLowerCase());
    if (existsInProvider) return false;

    addModel({
      id: trimmedId,
      apiModelId: trimmedId,
      name: displayName?.trim() || trimmedId,
      providerId: provider.id,
      enabled: true,
    });

    return true;
  };

  const handleBatchAdd = (ids: string[]) => {
    if (!provider || ids.length === 0) return;

    const existingIds = new Set(providerModels.map((m) => m.apiModelId.toLowerCase()));
    const newIds = ids
      .map((id) => id.trim())
      .filter((id) => id && !existingIds.has(id.toLowerCase()));

    if (newIds.length === 0) return;

    addModels(
      newIds.map((id) => ({
        id,
        apiModelId: id,
        name: id,
        providerId: provider.id,
        enabled: true,
      }))
    );
  };

  const handleClearAllModels = () => {
    if (providerModels.length === 0 || !provider) return;
    providerModels.forEach((model) => {
      deleteModel(model.id);
    });
    resetBenchmarkState();
  };

  return {
    fetchError,
    setFetchError,
    isFetchingModels,
    handleFetchModels,
    handleAddModel,
    handleBatchAdd,
    handleClearAllModels,
  };
}
