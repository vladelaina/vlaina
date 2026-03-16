import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/ui/icons';
import { useAIStore } from '@/stores/useAIStore';
import { useAccountSessionStore } from '@/stores/accountSession';
import { openaiClient } from '@/lib/ai/providers/openai';
import { backgroundBenchmarkRunner } from '@/lib/ai/healthCheck';
import { AIModel, PersistedBenchmarkItem, Provider } from '@/lib/ai/types';
import { buildScopedModelId, generateModelGroup, generateModelName } from '@/lib/ai/utils';
import { type HealthStatus } from './components/ModelListItem';
import { MANAGED_PROVIDER_ID } from '@/lib/ai/managedService';
import { ManagedProviderPanel } from './provider-detail/ManagedProviderPanel';
import { ProviderModelsPanel } from './provider-detail/ProviderModelsPanel';
import type { OauthAccountProvider } from '@/lib/account/provider';
import { SettingsTextInput } from '@/components/Settings/components/SettingsFields';
import type { ProviderBenchmarkRecord } from '@/lib/ai/types';

type BenchmarkScope = 'selected' | 'available' | 'all';
const EMPTY_FETCHED_MODELS: string[] = [];

function toHealthStatusMap(record?: ProviderBenchmarkRecord): Record<string, HealthStatus> {
  if (!record) {
    return {};
  }

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

function areBenchmarkScopesEqual(left: BenchmarkScope[], right: BenchmarkScope[]) {
  return left.length === right.length && left.every((scope, index) => scope === right[index]);
}

interface ProviderDetailProps {
  provider: Provider | undefined;
  onDraftChange?: (draft: { name?: string; apiHost?: string }) => void;
  onDraftClear?: () => void;
}

export function ProviderDetail({ provider: initialProvider, onDraftChange, onDraftClear }: ProviderDetailProps) {
  const {
    updateProvider,
    models,
    benchmarkResults,
    fetchedModels: persistedFetchedModels,
    addModel,
    addModels,
    deleteModel,
    refreshManagedProvider,
    setProviderBenchmarkResults,
    setProviderFetchedModels,
  } = useAIStore();
  const { isConnected, isConnecting, error: authError, signIn, requestEmailCode, verifyEmailCode, signOut } = useAccountSessionStore();

  const [name, setName] = useState(initialProvider?.name || '');
  const [apiKey, setApiKey] = useState(initialProvider?.apiKey || '');
  const [apiHost, setApiHost] = useState(initialProvider?.apiHost || '');
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyCopied, setApiKeyCopied] = useState(false);

  const [modelQuery, setModelQuery] = useState('');
  const [quickAddModelId, setQuickAddModelId] = useState('');
  const [quickAddError, setQuickAddError] = useState('');
  const [fetchError, setFetchError] = useState('');

  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);

  const [healthStatus, setHealthStatus] = useState<Record<string, HealthStatus>>({});
  const [isHealthChecking, setIsHealthChecking] = useState(false);
  const [healthCheckOverall, setHealthCheckOverall] = useState<'idle' | 'success' | 'error'>('idle');
  const [benchmarkingModelIds, setBenchmarkingModelIds] = useState<string[]>([]);
  const [activeBenchmarkScopes, setActiveBenchmarkScopes] = useState<BenchmarkScope[]>([]);
  const [queuedBenchmarkScopes, setQueuedBenchmarkScopes] = useState<BenchmarkScope[]>([]);
  const activeBenchmarkScopesRef = useRef<BenchmarkScope[]>([]);
  const benchmarkResultsRef = useRef(benchmarkResults);

  const providerModels = initialProvider ? models.filter((m) => m.providerId === initialProvider.id) : [];
  const providerModelIdSet = useMemo(() => new Set(providerModels.map((m) => m.apiModelId.toLowerCase())), [providerModels]);
  const isManagedProvider = initialProvider?.id === MANAGED_PROVIDER_ID;
  const enabled = initialProvider?.enabled ?? true;

  const providerId = initialProvider?.id;
  const persistedProviderFetchedModels = useMemo(
    () => (providerId ? persistedFetchedModels[providerId] ?? EMPTY_FETCHED_MODELS : EMPTY_FETCHED_MODELS),
    [providerId, persistedFetchedModels]
  );

  useEffect(() => {
    if (initialProvider) {
      setName(initialProvider.name);
      setApiKey(initialProvider.apiKey || '');
      setApiHost(initialProvider.apiHost || '');
    } else {
      setName('');
      setApiKey('');
      setApiHost('');
    }

    setQuickAddModelId('');
    setQuickAddError('');
    setFetchError('');
    setModelQuery('');
    activeBenchmarkScopesRef.current = [];
    setActiveBenchmarkScopes([]);
    setQueuedBenchmarkScopes([]);
    setShowApiKey(false);
    setApiKeyCopied(false);
    onDraftClear?.();
  }, [providerId]);

  useEffect(() => {
    setFetchedModels(persistedProviderFetchedModels);
  }, [persistedProviderFetchedModels]);

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

  const canUseConnectionActions = Boolean(initialProvider && apiHost.trim() && apiKey.trim());

  const sortedFetchedModels = useMemo(() => {
    return [...new Set(fetchedModels)].sort((a, b) => a.localeCompare(b));
  }, [fetchedModels]);

  const normalizedQuery = modelQuery.trim().toLowerCase();
  const filteredProviderModels = useMemo(() => {
    const base = [...providerModels].sort((a, b) => a.apiModelId.localeCompare(b.apiModelId));
    if (!normalizedQuery) return base;
    return base.filter((m) => `${m.apiModelId} ${m.name}`.toLowerCase().includes(normalizedQuery));
  }, [providerModels, normalizedQuery]);

  const filteredFetchedModels = useMemo(() => {
    if (!normalizedQuery) return sortedFetchedModels;
    return sortedFetchedModels.filter((id) => id.toLowerCase().includes(normalizedQuery));
  }, [sortedFetchedModels, normalizedQuery]);

  const availableFetchedModels = useMemo(() => {
    return sortedFetchedModels.filter((id) => !providerModelIdSet.has(id.toLowerCase()));
  }, [sortedFetchedModels, providerModelIdSet]);
  const buildTempProvider = (): Provider | null => {
    if (!initialProvider) return null;
    return {
      ...initialProvider,
      name,
      apiHost,
      apiKey,
      enabled,
      updatedAt: Date.now(),
    };
  };

  useEffect(() => {
    if (!initialProvider) return;

    const sameName = name === initialProvider.name;
    const sameApiHost = apiHost === (initialProvider.apiHost || '');
    const sameApiKey = apiKey === (initialProvider.apiKey || '');
    if (sameName && sameApiHost && sameApiKey) {
      return;
    }

    const timer = setTimeout(() => {
      updateProvider(initialProvider.id, { name, apiKey, apiHost, updatedAt: Date.now() });
    }, 240);

    return () => clearTimeout(timer);
  }, [initialProvider, name, apiHost, apiKey, updateProvider]);

  const buildFetchedBenchmarkModels = (modelIds: string[]) => {
    if (!initialProvider) {
      return [];
    }

    const now = Date.now();
    return modelIds.map((modelId) => ({
      id: buildScopedModelId(initialProvider.id, modelId),
      apiModelId: modelId,
      name: generateModelName(modelId),
      group: generateModelGroup(modelId),
      providerId: initialProvider.id,
      enabled: true,
      createdAt: now,
    }));
  };

  const selectedBenchmarkModels = useMemo(() => providerModels, [providerModels]);
  const availableBenchmarkModels = useMemo(
    () => buildFetchedBenchmarkModels(availableFetchedModels),
    [availableFetchedModels, initialProvider]
  );

  const selectedBenchmarkActive = useMemo(
    () =>
      activeBenchmarkScopes.includes('selected') ||
      activeBenchmarkScopes.includes('all') ||
      queuedBenchmarkScopes.includes('selected') ||
      queuedBenchmarkScopes.includes('all'),
    [activeBenchmarkScopes, queuedBenchmarkScopes]
  );
  const availableBenchmarkActive = useMemo(
    () =>
      activeBenchmarkScopes.includes('available') ||
      activeBenchmarkScopes.includes('all') ||
      queuedBenchmarkScopes.includes('available') ||
      queuedBenchmarkScopes.includes('all'),
    [activeBenchmarkScopes, queuedBenchmarkScopes]
  );
  const benchmarkAllActive = useMemo(
    () =>
      activeBenchmarkScopes.includes('all') ||
      queuedBenchmarkScopes.includes('all') ||
      (selectedBenchmarkActive && availableBenchmarkActive),
    [activeBenchmarkScopes, queuedBenchmarkScopes, selectedBenchmarkActive, availableBenchmarkActive]
  );

  const normalizeBenchmarkScopes = (scopes: BenchmarkScope[]): BenchmarkScope[] => {
    if (scopes.includes('all')) {
      return ['all'];
    }
    if (scopes.includes('selected') && scopes.includes('available')) {
      return ['all'];
    }
    return scopes;
  };

  const syncActiveBenchmarkScopes = (scopes: BenchmarkScope[]) => {
    const normalizedScopes = normalizeBenchmarkScopes(scopes);
    if (areBenchmarkScopesEqual(activeBenchmarkScopesRef.current, normalizedScopes)) {
      return;
    }

    activeBenchmarkScopesRef.current = normalizedScopes;
    setActiveBenchmarkScopes(normalizedScopes);
  };

  const resolveActiveBenchmarkScopes = (modelIds: string[]): BenchmarkScope[] => {
    const runningIds = new Set(modelIds);
    return normalizeBenchmarkScopes([
      ...(selectedBenchmarkModels.some((model) => runningIds.has(model.id)) ? ['selected' as const] : []),
      ...(availableBenchmarkModels.some((model) => runningIds.has(model.id)) ? ['available' as const] : []),
    ]);
  };

  const mergeBenchmarkScopes = (
    currentScopes: BenchmarkScope[],
    nextScope: BenchmarkScope
  ): BenchmarkScope[] => {
    if (nextScope === 'all') {
      return ['all'];
    }
    if (currentScopes.includes('all') || currentScopes.includes(nextScope)) {
      return currentScopes;
    }
    return normalizeBenchmarkScopes([...currentScopes, nextScope]);
  };

  const removeBenchmarkScope = (
    scopes: BenchmarkScope[],
    scopeToRemove: Exclude<BenchmarkScope, 'all'>
  ): BenchmarkScope[] => {
    const normalizedScopes = normalizeBenchmarkScopes(scopes);
    if (normalizedScopes.includes('all')) {
      return scopeToRemove === 'selected' ? ['available'] : ['selected'];
    }
    return normalizedScopes.filter(
      (scope): scope is Exclude<BenchmarkScope, 'all'> => scope !== scopeToRemove
    );
  };

  const resolveBenchmarkModelsForScopes = (scopes: BenchmarkScope[]): AIModel[] => {
    const includeSelected = scopes.includes('all') || scopes.includes('selected');
    const includeAvailable = scopes.includes('all') || scopes.includes('available');
    const nextModels = [
      ...(includeSelected ? selectedBenchmarkModels : []),
      ...(includeAvailable ? availableBenchmarkModels : []),
    ];

    return Array.from(new Map(nextModels.map((model) => [model.id, model])).values());
  };

  const toPersistedItems = (source: Record<string, HealthStatus>) => {
    return Object.fromEntries(
      Object.entries(source).flatMap(([modelId, status]) => {
        if (status.status === 'loading') {
          return [];
        }

        const nextItem: PersistedBenchmarkItem = {
          status: status.status,
          latency: status.latency,
          error: status.error,
          checkedAt: Date.now(),
        };

        return [[modelId, nextItem]];
      })
    );
  };

  const persistBenchmarkHealthStatus = (source: Record<string, HealthStatus>) => {
    if (!initialProvider) {
      return null;
    }

    const previousItems = benchmarkResultsRef.current[initialProvider.id]?.items || {};
    const nextItems = {
      ...previousItems,
      ...toPersistedItems(source),
    };
    const nextOverall =
      Object.keys(nextItems).length === 0
        ? 'idle'
        : Object.values(nextItems).some((item) => item.status === 'error')
          ? 'error'
          : 'success';
    const nextRecord = {
      items: nextItems,
      overall: nextOverall,
      updatedAt: Date.now(),
    } satisfies ProviderBenchmarkRecord;

    benchmarkResultsRef.current = {
      ...benchmarkResultsRef.current,
      [initialProvider.id]: nextRecord,
    };
    setProviderBenchmarkResults(initialProvider.id, nextRecord);
    return nextRecord;
  };

  const clearBenchmarkScopes = (scopes: BenchmarkScope[]) => {
    if (!initialProvider) {
      return;
    }

    const normalizedScopes = normalizeBenchmarkScopes(scopes);
    const targetIds = new Set(resolveBenchmarkModelsForScopes(normalizedScopes).map((model) => model.id));
    const previousItems = benchmarkResultsRef.current[initialProvider.id]?.items || {};
    const nextItems = Object.fromEntries(
      Object.entries(previousItems).filter(([modelId]) => !targetIds.has(modelId))
    );
    const nextOverall =
      Object.keys(nextItems).length === 0
        ? 'idle'
        : Object.values(nextItems).some((item) => item.status === 'error')
          ? 'error'
          : 'success';
    const nextRecord = {
      items: nextItems,
      overall: nextOverall,
      updatedAt: Date.now(),
    } satisfies ProviderBenchmarkRecord;

    benchmarkResultsRef.current = {
      ...benchmarkResultsRef.current,
      [initialProvider.id]: nextRecord,
    };
    setProviderBenchmarkResults(initialProvider.id, nextRecord);

    setHealthStatus((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([modelId]) => !targetIds.has(modelId)))
    );
    setHealthCheckOverall(nextOverall);
  };

  const getBenchmarkableModels = (
    modelsToCheck: AIModel[],
    options?: { ignoreQueuedScopes?: BenchmarkScope[] }
  ) => {
    const ignoredQueuedScopes = normalizeBenchmarkScopes(options?.ignoreQueuedScopes || []);
    const queuedScopesToBlock = areBenchmarkScopesEqual(
      normalizeBenchmarkScopes(queuedBenchmarkScopes),
      ignoredQueuedScopes
    )
      ? []
      : queuedBenchmarkScopes;
    const blockedIds = new Set([
      ...(isHealthChecking ? benchmarkingModelIds : []),
      ...resolveBenchmarkModelsForScopes(queuedScopesToBlock).map((model) => model.id),
    ]);
    return modelsToCheck.filter((model) => !blockedIds.has(model.id));
  };

  const startBenchmarkRun = (scopes: BenchmarkScope[]) => {
    if (!initialProvider) return;

    const tempProvider = buildTempProvider();
    if (!tempProvider) return;

    const normalizedScopes = normalizeBenchmarkScopes(scopes);
    const nextModels = getBenchmarkableModels(resolveBenchmarkModelsForScopes(normalizedScopes), {
      ignoreQueuedScopes: normalizedScopes,
    });
    if (nextModels.length === 0) {
      return;
    }

    clearBenchmarkScopes(normalizedScopes);
    setBenchmarkingModelIds([]);
    syncActiveBenchmarkScopes(normalizedScopes);
    backgroundBenchmarkRunner.start(tempProvider, nextModels);
  };

  const stopBenchmarkRun = () => {
    if (!initialProvider) {
      return;
    }

    const nextRecord = persistBenchmarkHealthStatus(healthStatus);
    if (nextRecord) {
      setHealthStatus(toHealthStatusMap(nextRecord));
      setHealthCheckOverall(nextRecord.overall);
    }
    setIsHealthChecking(false);
    setBenchmarkingModelIds([]);
    setQueuedBenchmarkScopes([]);
    syncActiveBenchmarkScopes([]);
    backgroundBenchmarkRunner.stop(initialProvider.id);
  };

  const cancelBenchmarkScope = (scope: Exclude<BenchmarkScope, 'all'>) => {
    if (!initialProvider) {
      return;
    }

    const activeScopes = normalizeBenchmarkScopes(activeBenchmarkScopesRef.current);
    const queuedScopes = normalizeBenchmarkScopes(queuedBenchmarkScopes);
    const nextQueuedScopes = removeBenchmarkScope(queuedScopes, scope);
    const scopeIsRunning =
      activeScopes.includes(scope) ||
      activeScopes.includes('all');

    if (!scopeIsRunning) {
      setQueuedBenchmarkScopes(nextQueuedScopes);
      return;
    }

    const nextActiveScopes = removeBenchmarkScope(activeScopes, scope);
    const nextRecord = persistBenchmarkHealthStatus(healthStatus);
    const persistedStatus = toHealthStatusMap(nextRecord || benchmarkResultsRef.current[initialProvider.id]);
    const resumeModels = resolveBenchmarkModelsForScopes(nextActiveScopes).filter((model) => {
      const status = healthStatus[model.id];
      return !status || status.status === 'loading';
    });

    backgroundBenchmarkRunner.stop(initialProvider.id);
    setHealthStatus(persistedStatus);
    setHealthCheckOverall(nextRecord?.overall || 'idle');
    setBenchmarkingModelIds([]);
    setQueuedBenchmarkScopes(nextQueuedScopes);

    if (nextActiveScopes.length === 0 || resumeModels.length === 0) {
      setIsHealthChecking(false);
      syncActiveBenchmarkScopes([]);
      return;
    }

    const tempProvider = buildTempProvider();
    if (!tempProvider) {
      setIsHealthChecking(false);
      syncActiveBenchmarkScopes([]);
      return;
    }

    setIsHealthChecking(true);
    setBenchmarkingModelIds(resumeModels.map((model) => model.id));
    syncActiveBenchmarkScopes(nextActiveScopes);
    backgroundBenchmarkRunner.start(tempProvider, resumeModels);
  };

  const queueOrStartBenchmark = (scope: BenchmarkScope) => {
    const nextModels = getBenchmarkableModels(resolveBenchmarkModelsForScopes([scope]));
    if (nextModels.length === 0) {
      return;
    }

    if (backgroundBenchmarkRunner.getSnapshot(initialProvider?.id || '')?.isRunning) {
      setQueuedBenchmarkScopes((prev) => mergeBenchmarkScopes(prev, scope));
      return;
    }

    setQueuedBenchmarkScopes([]);
    startBenchmarkRun([scope]);
  };

  const canBenchmarkSelected =
    canUseConnectionActions && getBenchmarkableModels(selectedBenchmarkModels).length > 0;
  const canBenchmarkAvailable =
    canUseConnectionActions && getBenchmarkableModels(availableBenchmarkModels).length > 0;
  const canBenchmarkAll =
    canUseConnectionActions &&
    getBenchmarkableModels([...selectedBenchmarkModels, ...availableBenchmarkModels]).length > 0;

  const handleBenchmarkModels = async () => {
    if (selectedBenchmarkActive) {
      cancelBenchmarkScope('selected');
      return;
    }
    if (!canBenchmarkSelected) return;
    queueOrStartBenchmark('selected');
  };

  const handleBenchmarkAvailableModels = async () => {
    if (availableBenchmarkActive) {
      cancelBenchmarkScope('available');
      return;
    }
    if (!canBenchmarkAvailable) return;
    queueOrStartBenchmark('available');
  };

  const handleBenchmarkAllModels = async () => {
    if (benchmarkAllActive) {
      stopBenchmarkRun();
      return;
    }
    if (!canBenchmarkAll) return;
    queueOrStartBenchmark('all');
  };

  useEffect(() => {
    if (!initialProvider || isHealthChecking || queuedBenchmarkScopes.length === 0) {
      return;
    }

    const nextScopes = queuedBenchmarkScopes;
    setQueuedBenchmarkScopes([]);
    startBenchmarkRun(nextScopes);
  }, [initialProvider, isHealthChecking, queuedBenchmarkScopes, name, apiHost, apiKey]);

  useEffect(() => {
    if (isHealthChecking || queuedBenchmarkScopes.length > 0 || activeBenchmarkScopesRef.current.length === 0) {
      return;
    }

    setActiveBenchmarkScopes([]);
    activeBenchmarkScopesRef.current = [];
  }, [isHealthChecking, queuedBenchmarkScopes]);

  useEffect(() => {
    if (!isHealthChecking) {
      return;
    }

    syncActiveBenchmarkScopes(resolveActiveBenchmarkScopes(benchmarkingModelIds));
  }, [isHealthChecking, benchmarkingModelIds, selectedBenchmarkModels, availableBenchmarkModels]);

  useEffect(() => {
    if (!initialProvider || isHealthChecking || Object.keys(healthStatus).length === 0) {
      return;
    }

    const items = toPersistedItems(healthStatus);

    const persistedRecord = benchmarkResults[initialProvider.id];
    const sameOverall = persistedRecord?.overall === healthCheckOverall;
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

    if (sameOverall && sameItems) {
      return;
    }

    setProviderBenchmarkResults(initialProvider.id, {
      items,
      overall: healthCheckOverall,
      updatedAt: Date.now(),
    });
  }, [initialProvider, isHealthChecking, healthStatus, healthCheckOverall, benchmarkResults, setProviderBenchmarkResults]);

  const handleFetchModels = async () => {
    if (!canUseConnectionActions) {
      setFetchError('Please provide Base URL and API Key first.');
      return;
    }

    if (!initialProvider) {
      return;
    }

    const tempProvider = buildTempProvider();
    if (!tempProvider) return;
    const providerId = initialProvider.id;

    setIsFetchingModels(true);
    setFetchError('');

    try {
      const modelsList = await openaiClient.getModels(tempProvider);
      setFetchedModels(modelsList);
      setProviderFetchedModels(providerId, modelsList);
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
    if (!id.trim() || !initialProvider) return false;

    const trimmedId = id.trim();
    const existsInProvider = providerModels.some((m) => m.apiModelId.toLowerCase() === trimmedId.toLowerCase());
    if (existsInProvider) return false;

    addModel({
      id: trimmedId,
      apiModelId: trimmedId,
      name: displayName?.trim() || trimmedId,
      providerId: initialProvider.id,
      enabled: true,
    });

    return true;
  };

  const handleBatchAdd = (ids: string[]) => {
    if (!initialProvider || ids.length === 0) return;

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
        providerId: initialProvider.id,
        enabled: true,
      }))
    );
  };

  const handleClearAllModels = () => {
    if (providerModels.length === 0 || !initialProvider) return;
    providerModels.forEach((model) => {
      deleteModel(model.id);
    });
    setHealthStatus({});
    setHealthCheckOverall('idle');
    setIsHealthChecking(false);
    setQueuedBenchmarkScopes([]);
    syncActiveBenchmarkScopes([]);
    backgroundBenchmarkRunner.stop(initialProvider.id);
  };

  const handleManagedConnect = async (provider: OauthAccountProvider) => {
    await signIn(provider);
  };

  const handleManagedRefresh = async () => {
    await refreshManagedProvider();
  };

  const handleCopyApiKey = async () => {
    if (!apiKey) return;
    try {
      await navigator.clipboard.writeText(apiKey);
      setApiKeyCopied(true);
      setTimeout(() => setApiKeyCopied(false), 1500);
    } catch {}
  };

  if (!initialProvider) {
    return null;
  }

  if (isManagedProvider) {
    return (
      <ManagedProviderPanel
        isConnected={isConnected}
        isConnecting={isConnecting}
        authError={authError}
        onConnect={handleManagedConnect}
        onRequestEmailCode={requestEmailCode}
        onVerifyEmailCode={verifyEmailCode}
        onDisconnect={signOut}
        onRefresh={handleManagedRefresh}
      />
    );
  }

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-4">
        <section className="p-1">
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-gray-500">Channel Label</label>
              <SettingsTextInput
                type="text"
                value={name}
                onChange={(e) => {
                  const nextName = e.target.value;
                  setName(nextName);
                  onDraftChange?.({ name: nextName });
                }}
                placeholder="New Channel"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-gray-500">Base URL</label>
              <SettingsTextInput
                type="text"
                value={apiHost}
                onChange={(e) => {
                  const nextApiHost = e.target.value;
                  setApiHost(nextApiHost);
                  onDraftChange?.({ apiHost: nextApiHost });
                  setFetchError('');
                }}
                placeholder="https://api.openai.com"
                name={`provider-api-host-${initialProvider.id}`}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                data-lpignore="true"
                data-1p-ignore="true"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-gray-500">API Key</label>
              <SettingsTextInput
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setFetchError('');
                }}
                placeholder="sk-..."
                name={`provider-api-key-${initialProvider.id}`}
                autoComplete="new-password"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                data-lpignore="true"
                data-1p-ignore="true"
                inputClassName="font-mono"
                trailing={
                  <>
                    <button
                      type="button"
                      onClick={() => setShowApiKey((prev) => !prev)}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-gray-200"
                      title={showApiKey ? 'Hide API Key' : 'Show API Key'}
                    >
                      <Icon name={showApiKey ? 'common.eyeOff' : 'common.eye'} size="sm" />
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyApiKey}
                      disabled={!apiKey}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-white/10 dark:hover:text-gray-200"
                      title={apiKeyCopied ? 'Copied' : 'Copy API Key'}
                    >
                      <Icon name={apiKeyCopied ? 'common.check' : 'common.copy'} size="sm" />
                    </button>
                  </>
                }
              />
            </div>

          </div>
        </section>

        <ProviderModelsPanel
          providerId={initialProvider.id}
          providerModels={providerModels}
          filteredProviderModels={filteredProviderModels}
          sortedFetchedModels={sortedFetchedModels}
          filteredFetchedModels={filteredFetchedModels}
          providerModelIdSet={providerModelIdSet}
          modelQuery={modelQuery}
          quickAddModelId={quickAddModelId}
          quickAddError={quickAddError}
          fetchError={fetchError}
          isFetchingModels={isFetchingModels}
          canUseConnectionActions={canUseConnectionActions}
          canBenchmark={canBenchmarkAll}
          canBenchmarkSelected={canBenchmarkSelected}
          canBenchmarkAvailable={canBenchmarkAvailable}
          isHealthChecking={isHealthChecking}
          benchmarkAllActive={benchmarkAllActive}
          selectedBenchmarkActive={selectedBenchmarkActive}
          availableBenchmarkActive={availableBenchmarkActive}
          healthCheckOverall={healthCheckOverall}
          healthStatus={healthStatus}
          onQuickAddModelIdChange={setQuickAddModelId}
          onModelQueryChange={setModelQuery}
          onFetchModels={handleFetchModels}
          onBenchmark={handleBenchmarkAllModels}
          onBenchmarkSelected={handleBenchmarkModels}
          onBenchmarkAvailable={handleBenchmarkAvailableModels}
          onClearAllModels={handleClearAllModels}
          onDeleteModel={deleteModel}
          onAddModel={handleAddModel}
          onAddAllVisible={handleBatchAdd}
          onSetQuickAddError={setQuickAddError}
        />
      </div>
  );
}
