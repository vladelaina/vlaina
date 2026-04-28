import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { AIModel, Provider, ProviderBenchmarkRecord } from '@/lib/ai/types';
import type { HealthStatus } from '../components/ModelListItem';
import {
  createBenchmarkRecord,
  normalizeBenchmarkScopes,
  toPersistedItems,
  type BenchmarkScope,
} from './providerBenchmarkUtils';

export function useProviderBenchmarkPersistence({
  provider,
  benchmarkResultsRef,
  setProviderBenchmarkResults,
  setHealthStatus,
  setHealthCheckOverall,
  resolveScopedBenchmarkModels,
}: {
  provider: Provider | undefined;
  benchmarkResultsRef: MutableRefObject<Record<string, ProviderBenchmarkRecord>>;
  setProviderBenchmarkResults: (providerId: string, record: ProviderBenchmarkRecord) => void;
  setHealthStatus: Dispatch<SetStateAction<Record<string, HealthStatus>>>;
  setHealthCheckOverall: Dispatch<SetStateAction<'idle' | 'success' | 'error'>>;
  resolveScopedBenchmarkModels: (scopes: BenchmarkScope[]) => AIModel[];
}) {
  const persistBenchmarkHealthStatus = (source: Record<string, HealthStatus>) => {
    if (!provider) return null;

    const previousItems = benchmarkResultsRef.current[provider.id]?.items || {};
    const nextItems = { ...previousItems, ...toPersistedItems(source) };
    const nextRecord = createBenchmarkRecord(nextItems);

    benchmarkResultsRef.current = {
      ...benchmarkResultsRef.current,
      [provider.id]: nextRecord,
    };
    setProviderBenchmarkResults(provider.id, nextRecord);
    return nextRecord;
  };

  const clearBenchmarkScopes = (scopes: BenchmarkScope[]) => {
    if (!provider) return;

    const normalizedScopes = normalizeBenchmarkScopes(scopes);
    const targetIds = new Set(resolveScopedBenchmarkModels(normalizedScopes).map((model) => model.id));
    const previousItems = benchmarkResultsRef.current[provider.id]?.items || {};
    const nextItems = Object.fromEntries(
      Object.entries(previousItems).filter(([modelId]) => !targetIds.has(modelId))
    );
    const nextRecord = createBenchmarkRecord(nextItems);

    benchmarkResultsRef.current = {
      ...benchmarkResultsRef.current,
      [provider.id]: nextRecord,
    };
    setProviderBenchmarkResults(provider.id, nextRecord);
    setHealthStatus((prev) => Object.fromEntries(Object.entries(prev).filter(([modelId]) => !targetIds.has(modelId))));
    setHealthCheckOverall(nextRecord.overall);
  };

  return {
    persistBenchmarkHealthStatus,
    clearBenchmarkScopes,
  };
}
