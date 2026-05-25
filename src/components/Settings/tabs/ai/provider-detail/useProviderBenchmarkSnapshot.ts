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

function getInitialHealthStatus(
  providerId: string | undefined,
  benchmarkResults: Record<string, ProviderBenchmarkRecord>
) {
  return providerId ? toHealthStatusMap(benchmarkResults[providerId]) : {};
}

function getInitialHealthOverall(
  providerId: string | undefined,
  benchmarkResults: Record<string, ProviderBenchmarkRecord>
) {
  return providerId ? benchmarkResults[providerId]?.overall || 'idle' : 'idle';
}

export function useProviderBenchmarkSnapshot({
  providerId,
  benchmarkResults,
}: {
  providerId: string | undefined;
  benchmarkResults: Record<string, ProviderBenchmarkRecord>;
}) {
  const [healthStatus, setHealthStatus] = useState<Record<string, HealthStatus>>(() =>
    getInitialHealthStatus(providerId, benchmarkResults)
  );
  const [isHealthChecking, setIsHealthChecking] = useState(false);
  const [healthCheckOverall, setHealthCheckOverall] = useState<'idle' | 'success' | 'error'>(() =>
    getInitialHealthOverall(providerId, benchmarkResults)
  );
  const [benchmarkingModelIds, setBenchmarkingModelIds] = useState<string[]>([]);
  const [activeBenchmarkScopes, setActiveBenchmarkScopes] = useState<BenchmarkScope[]>([]);
  const [queuedBenchmarkScopes, setQueuedBenchmarkScopes] = useState<BenchmarkScope[]>([]);
  const activeBenchmarkScopesRef = useRef<BenchmarkScope[]>([]);
  const benchmarkResultsRef = useRef(benchmarkResults);
  const didApplyInitialBenchmarkResultsRef = useRef(false);

  useEffect(() => {
    benchmarkResultsRef.current = benchmarkResults;
  }, [benchmarkResults]);

  useEffect(() => {
    if (!didApplyInitialBenchmarkResultsRef.current) {
      didApplyInitialBenchmarkResultsRef.current = true;
      return;
    }

    if (!providerId) return;

    const snapshot = backgroundBenchmarkRunner.getSnapshot(providerId);
    const persistedRecord = benchmarkResults[providerId];
    const persistedStatus = toHealthStatusMap(persistedRecord);

    if (snapshot?.isRunning) {
      setHealthStatus({ ...persistedStatus, ...snapshot.items });
      setHealthCheckOverall(snapshot.overall);
      setIsHealthChecking(true);
      setBenchmarkingModelIds(Object.keys(snapshot.items));
      return;
    }

    setHealthStatus(persistedStatus);
    setHealthCheckOverall(persistedRecord?.overall || 'idle');
    setIsHealthChecking(false);
    setBenchmarkingModelIds([]);
    setActiveBenchmarkScopes([]);
    activeBenchmarkScopesRef.current = [];
  }, [providerId, benchmarkResults]);

  useEffect(() => {
    if (!providerId) {
      setHealthStatus({});
      setHealthCheckOverall('idle');
      setIsHealthChecking(false);
      setBenchmarkingModelIds([]);
      return;
    }

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
