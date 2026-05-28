import { useDeferredValue, useMemo } from 'react';
import type { AIModel } from '@/lib/ai/types';
import { rankByFuzzySearch } from './fuzzyModelSearch';

export function useProviderModelFilters({
  providerModels,
  fetchedModels,
  providerModelIdSet,
  modelQuery,
}: {
  providerModels: AIModel[];
  fetchedModels: string[];
  providerModelIdSet: Set<string>;
  modelQuery: string;
}) {
  const sortedFetchedModels = useMemo(() => {
    return [...new Set(fetchedModels)].sort((a, b) => a.localeCompare(b));
  }, [fetchedModels]);
  const deferredModelQuery = useDeferredValue(modelQuery);
  const normalizedQuery = deferredModelQuery.trim().toLowerCase();
  const filteredProviderModels = useMemo(() => {
    const base = [...providerModels].sort((a, b) => a.apiModelId.localeCompare(b.apiModelId));
    if (!normalizedQuery) return base;
    return rankByFuzzySearch(base, normalizedQuery, (model) => `${model.apiModelId} ${model.name}`);
  }, [providerModels, normalizedQuery]);
  const filteredFetchedModels = useMemo(() => {
    if (!normalizedQuery) return sortedFetchedModels;
    return rankByFuzzySearch(sortedFetchedModels, normalizedQuery, (id) => id);
  }, [sortedFetchedModels, normalizedQuery]);
  const availableFetchedModels = useMemo(() => {
    return sortedFetchedModels.filter((id) => !providerModelIdSet.has(id.toLowerCase()));
  }, [sortedFetchedModels, providerModelIdSet]);

  return {
    sortedFetchedModels,
    filteredProviderModels,
    filteredFetchedModels,
    availableFetchedModels,
  };
}
