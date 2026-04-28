import type { AIModel, PersistedBenchmarkItem, Provider, ProviderBenchmarkRecord } from '@/lib/ai/types';
import { buildScopedModelId, generateModelGroup, generateModelName } from '@/lib/ai/utils';
import type { HealthStatus } from '../components/ModelListItem';

export type BenchmarkScope = 'selected' | 'available' | 'all';

export function buildFetchedBenchmarkModels(provider: Provider | undefined, modelIds: string[]) {
  if (!provider) return [];

  const now = Date.now();
  return modelIds.map((modelId) => ({
    id: buildScopedModelId(provider.id, modelId),
    apiModelId: modelId,
    name: generateModelName(modelId),
    group: generateModelGroup(modelId),
    providerId: provider.id,
    enabled: true,
    createdAt: now,
  }));
}

export function normalizeBenchmarkScopes(scopes: BenchmarkScope[]): BenchmarkScope[] {
  if (scopes.includes('all')) return ['all'];
  if (scopes.includes('selected') && scopes.includes('available')) return ['all'];
  return scopes;
}

export function resolveBenchmarkModelsForScopes(input: {
  scopes: BenchmarkScope[];
  selectedBenchmarkModels: AIModel[];
  availableBenchmarkModels: AIModel[];
}): AIModel[] {
  const includeSelected = input.scopes.includes('all') || input.scopes.includes('selected');
  const includeAvailable = input.scopes.includes('all') || input.scopes.includes('available');
  const nextModels = [
    ...(includeSelected ? input.selectedBenchmarkModels : []),
    ...(includeAvailable ? input.availableBenchmarkModels : []),
  ];

  return Array.from(new Map(nextModels.map((model) => [model.id, model])).values());
}

export function getBenchmarkableModels(input: {
  modelsToCheck: AIModel[];
  isHealthChecking: boolean;
  benchmarkingModelIds: string[];
  queuedBenchmarkScopes: BenchmarkScope[];
  selectedBenchmarkModels: AIModel[];
  availableBenchmarkModels: AIModel[];
  ignoreQueuedScopes?: BenchmarkScope[];
}) {
  const ignoredQueuedScopes = normalizeBenchmarkScopes(input.ignoreQueuedScopes || []);
  const queuedScopesToBlock = areBenchmarkScopesEqual(
    normalizeBenchmarkScopes(input.queuedBenchmarkScopes),
    ignoredQueuedScopes
  )
    ? []
    : input.queuedBenchmarkScopes;
  const blockedIds = new Set([
    ...(input.isHealthChecking ? input.benchmarkingModelIds : []),
    ...resolveBenchmarkModelsForScopes({
      scopes: queuedScopesToBlock,
      selectedBenchmarkModels: input.selectedBenchmarkModels,
      availableBenchmarkModels: input.availableBenchmarkModels,
    }).map((model) => model.id),
  ]);
  return input.modelsToCheck.filter((model) => !blockedIds.has(model.id));
}

export function buildBenchmarkActivityFlags(input: {
  activeBenchmarkScopes: BenchmarkScope[];
  queuedBenchmarkScopes: BenchmarkScope[];
}) {
  const selectedBenchmarkActive =
    input.activeBenchmarkScopes.includes('selected') ||
    input.activeBenchmarkScopes.includes('all') ||
    input.queuedBenchmarkScopes.includes('selected') ||
    input.queuedBenchmarkScopes.includes('all');
  const availableBenchmarkActive =
    input.activeBenchmarkScopes.includes('available') ||
    input.activeBenchmarkScopes.includes('all') ||
    input.queuedBenchmarkScopes.includes('available') ||
    input.queuedBenchmarkScopes.includes('all');

  return {
    selectedBenchmarkActive,
    availableBenchmarkActive,
    benchmarkAllActive:
      input.activeBenchmarkScopes.includes('all') ||
      input.queuedBenchmarkScopes.includes('all') ||
      (selectedBenchmarkActive && availableBenchmarkActive),
  };
}

export function areBenchmarkScopesEqual(left: BenchmarkScope[], right: BenchmarkScope[]) {
  return left.length === right.length && left.every((scope, index) => scope === right[index]);
}

export function mergeBenchmarkScopes(currentScopes: BenchmarkScope[], nextScope: BenchmarkScope): BenchmarkScope[] {
  if (nextScope === 'all') return ['all'];
  if (currentScopes.includes('all') || currentScopes.includes(nextScope)) return currentScopes;
  return normalizeBenchmarkScopes([...currentScopes, nextScope]);
}

export function removeBenchmarkScope(
  scopes: BenchmarkScope[],
  scopeToRemove: Exclude<BenchmarkScope, 'all'>
): BenchmarkScope[] {
  const normalizedScopes = normalizeBenchmarkScopes(scopes);
  if (normalizedScopes.includes('all')) {
    return scopeToRemove === 'selected' ? ['available'] : ['selected'];
  }
  return normalizedScopes.filter((scope): scope is Exclude<BenchmarkScope, 'all'> => scope !== scopeToRemove);
}

export function resolveActiveBenchmarkScopes(
  modelIds: string[],
  selectedBenchmarkModels: AIModel[],
  availableBenchmarkModels: AIModel[]
): BenchmarkScope[] {
  const runningIds = new Set(modelIds);
  return normalizeBenchmarkScopes([
    ...(selectedBenchmarkModels.some((model) => runningIds.has(model.id)) ? ['selected' as const] : []),
    ...(availableBenchmarkModels.some((model) => runningIds.has(model.id)) ? ['available' as const] : []),
  ]);
}

export function toPersistedItems(source: Record<string, HealthStatus>) {
  return Object.fromEntries(
    Object.entries(source).flatMap(([modelId, status]) => {
      if (status.status === 'loading') return [];

      const nextItem: PersistedBenchmarkItem = {
        status: status.status,
        latency: status.latency,
        error: status.error,
        checkedAt: Date.now(),
      };

      return [[modelId, nextItem]];
    })
  );
}

export function createBenchmarkRecord(items: Record<string, PersistedBenchmarkItem>): ProviderBenchmarkRecord {
  return {
    items,
    overall:
      Object.keys(items).length === 0
        ? 'idle'
        : Object.values(items).some((item) => item.status === 'error')
          ? 'error'
          : 'success',
    updatedAt: Date.now(),
  };
}

export function isSameBenchmarkRecord(
  persistedRecord: ProviderBenchmarkRecord | undefined,
  items: Record<string, PersistedBenchmarkItem>,
  overall: 'idle' | 'success' | 'error'
) {
  const sameOverall = persistedRecord?.overall === overall;
  const persistedItems = persistedRecord?.items || {};
  const nextKeys = Object.keys(items);
  const persistedKeys = Object.keys(persistedItems);
  const sameItems =
    nextKeys.length === persistedKeys.length &&
    nextKeys.every((key) => {
      const nextItem = items[key];
      const prevItem = persistedItems[key];
      return (
        prevItem &&
        prevItem.status === nextItem.status &&
        prevItem.latency === nextItem.latency &&
        prevItem.error === nextItem.error
      );
    });

  return sameOverall && sameItems;
}
