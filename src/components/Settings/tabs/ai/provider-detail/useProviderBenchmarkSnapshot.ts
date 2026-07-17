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

function areHealthStatusesEqual(
  left: Record<string, HealthStatus>,
  right: Record<string, HealthStatus>
) {
  const leftIds = Object.keys(left);
  const rightIds = Object.keys(right);
  return leftIds.length === rightIds.length && leftIds.every((modelId) => {
    const leftStatus = left[modelId];
    const rightStatus = right[modelId];
    return rightStatus &&
      leftStatus.status === rightStatus.status &&
      leftStatus.latency === rightStatus.latency &&
      leftStatus.error === rightStatus.error;
  });
}

function areStringArraysEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
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
  const healthStatusRef = useRef(healthStatus);
  const isHealthCheckingRef = useRef(isHealthChecking);
  const healthCheckOverallRef = useRef(healthCheckOverall);
  const benchmarkingModelIdsRef = useRef(benchmarkingModelIds);
  healthStatusRef.current = healthStatus;
  isHealthCheckingRef.current = isHealthChecking;
  healthCheckOverallRef.current = healthCheckOverall;
  benchmarkingModelIdsRef.current = benchmarkingModelIds;

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
      const nextHealthStatus = { ...persistedStatus, ...snapshot.items };
      const nextModelIds = Object.keys(snapshot.items);
      if (!areHealthStatusesEqual(healthStatusRef.current, nextHealthStatus)) setHealthStatus(nextHealthStatus);
      if (healthCheckOverallRef.current !== snapshot.overall) setHealthCheckOverall(snapshot.overall);
      if (!isHealthCheckingRef.current) setIsHealthChecking(true);
      if (!areStringArraysEqual(benchmarkingModelIdsRef.current, nextModelIds)) setBenchmarkingModelIds(nextModelIds);
      return;
    }

    const nextOverall = persistedRecord?.overall || 'idle';
    if (!areHealthStatusesEqual(healthStatusRef.current, persistedStatus)) setHealthStatus(persistedStatus);
    if (healthCheckOverallRef.current !== nextOverall) setHealthCheckOverall(nextOverall);
    if (isHealthCheckingRef.current) setIsHealthChecking(false);
    if (benchmarkingModelIdsRef.current.length > 0) setBenchmarkingModelIds([]);
    if (activeBenchmarkScopesRef.current.length > 0) setActiveBenchmarkScopes([]);
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
