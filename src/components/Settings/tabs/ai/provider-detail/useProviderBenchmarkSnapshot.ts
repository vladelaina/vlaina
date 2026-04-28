import { useEffect, useRef, useState } from 'react';
import { backgroundBenchmarkRunner } from '@/lib/ai/healthCheck';
import type { ProviderBenchmarkRecord } from '@/lib/ai/types';
import type { HealthStatus } from '../components/ModelListItem';
import type { BenchmarkScope } from './providerBenchmarkUtils';

export function toHealthStatusMap(record?: ProviderBenchmarkRecord): Record<string, HealthStatus> {
  if (!record) return {};

  return Object.fromEntries(
    Object.entries(record.items).map(([modelId, item]) => [
      modelId,
      {
        status: item.status,
        latency: item.latency,
        error: item.error,
      },
    ])
  );
}

export function useProviderBenchmarkSnapshot({
  providerId,
  benchmarkResults,
}: {
  providerId: string | undefined;
  benchmarkResults: Record<string, ProviderBenchmarkRecord>;
}) {
  const [healthStatus, setHealthStatus] = useState<Record<string, HealthStatus>>({});
  const [isHealthChecking, setIsHealthChecking] = useState(false);
  const [healthCheckOverall, setHealthCheckOverall] = useState<'idle' | 'success' | 'error'>('idle');
  const [benchmarkingModelIds, setBenchmarkingModelIds] = useState<string[]>([]);
  const [activeBenchmarkScopes, setActiveBenchmarkScopes] = useState<BenchmarkScope[]>([]);
  const [queuedBenchmarkScopes, setQueuedBenchmarkScopes] = useState<BenchmarkScope[]>([]);
  const activeBenchmarkScopesRef = useRef<BenchmarkScope[]>([]);
  const benchmarkResultsRef = useRef(benchmarkResults);

  useEffect(() => {
    benchmarkResultsRef.current = benchmarkResults;
  }, [benchmarkResults]);

  useEffect(() => {
    if (!providerId) {
      setHealthStatus({});
      setHealthCheckOverall('idle');
      setIsHealthChecking(false);
      setBenchmarkingModelIds([]);
      return;
    }

    const applySnapshot = () => {
      const persistedRecord = benchmarkResultsRef.current[providerId];
      const persistedStatus = toHealthStatusMap(persistedRecord);
      const snapshot = backgroundBenchmarkRunner.getSnapshot(providerId);
      if (!snapshot) {
        setHealthStatus(persistedStatus);
        setHealthCheckOverall(persistedRecord?.overall || 'idle');
        setIsHealthChecking(false);
        setBenchmarkingModelIds([]);
        setActiveBenchmarkScopes([]);
        activeBenchmarkScopesRef.current = [];
        return;
      }
      setHealthStatus({ ...persistedStatus, ...snapshot.items });
      setHealthCheckOverall(snapshot.overall);
      setIsHealthChecking(snapshot.isRunning);
      setBenchmarkingModelIds(Object.keys(snapshot.items));
    };

    applySnapshot();

    return backgroundBenchmarkRunner.subscribe(providerId, (snapshot) => {
      const persistedStatus = toHealthStatusMap(benchmarkResultsRef.current[providerId]);
      setHealthStatus({ ...persistedStatus, ...snapshot.items });
      setHealthCheckOverall(snapshot.overall);
      setIsHealthChecking(snapshot.isRunning);
      setBenchmarkingModelIds(Object.keys(snapshot.items));
    });
  }, [providerId]);

  return {
    healthStatus,
    setHealthStatus,
    isHealthChecking,
    setIsHealthChecking,
    healthCheckOverall,
    setHealthCheckOverall,
    benchmarkingModelIds,
    setBenchmarkingModelIds,
    activeBenchmarkScopes,
    setActiveBenchmarkScopes,
    queuedBenchmarkScopes,
    setQueuedBenchmarkScopes,
    activeBenchmarkScopesRef,
    benchmarkResultsRef,
  };
}
