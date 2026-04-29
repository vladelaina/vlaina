import { useEffect, useMemo, useState } from 'react';
import { useAIStore } from '@/stores/useAIStore';
import { useAccountSessionStore } from '@/stores/accountSession';
import { Provider } from '@/lib/ai/types';
import { writeTextToClipboard } from '@/lib/clipboard';
import { MANAGED_PROVIDER_ID } from '@/lib/ai/managedService';
import { ManagedProviderPanel } from './provider-detail/ManagedProviderPanel';
import { ProviderModelsPanel } from './provider-detail/ProviderModelsPanel';
import { ProviderConnectionFields } from './provider-detail/ProviderConnectionFields';
import { useProviderBenchmark } from './provider-detail/useProviderBenchmark';
import { useProviderModelActions } from './provider-detail/useProviderModelActions';
import { useProviderModelFilters } from './provider-detail/useProviderModelFilters';
import type { OauthAccountProvider } from '@/lib/account/provider';

const EMPTY_FETCHED_MODELS: string[] = [];

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
  const {
    isConnected,
    isConnecting,
    error: authError,
    signIn,
    requestEmailCode,
    verifyEmailCode,
    signOut,
  } = useAccountSessionStore();

  const [name, setName] = useState(initialProvider?.name || '');
  const [apiKey, setApiKey] = useState(initialProvider?.apiKey || '');
  const [apiHost, setApiHost] = useState(initialProvider?.apiHost || '');
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyCopied, setApiKeyCopied] = useState(false);
  const [modelQuery, setModelQuery] = useState('');
  const [quickAddModelId, setQuickAddModelId] = useState('');
  const [quickAddError, setQuickAddError] = useState('');
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);

  const providerId = initialProvider?.id;
  const providerModels = initialProvider ? models.filter((m) => m.providerId === initialProvider.id) : [];
  const providerModelIdSet = useMemo(() => new Set(providerModels.map((m) => m.apiModelId.toLowerCase())), [providerModels]);
  const isManagedProvider = initialProvider?.id === MANAGED_PROVIDER_ID;
  const enabled = initialProvider?.enabled ?? true;
  const canUseConnectionActions = Boolean(initialProvider && apiHost.trim() && apiKey.trim());
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
    setModelQuery('');
    setShowApiKey(false);
    setApiKeyCopied(false);
    onDraftClear?.();
  }, [providerId]);

  useEffect(() => {
    setFetchedModels(persistedProviderFetchedModels);
  }, [persistedProviderFetchedModels]);

  useEffect(() => {
    if (!initialProvider) return;

    const sameName = name === initialProvider.name;
    const sameApiHost = apiHost === (initialProvider.apiHost || '');
    const sameApiKey = apiKey === (initialProvider.apiKey || '');
    if (sameName && sameApiHost && sameApiKey) return;

    const timer = setTimeout(() => {
      updateProvider(initialProvider.id, { name, apiKey, apiHost, updatedAt: Date.now() });
    }, 240);

    return () => clearTimeout(timer);
  }, [initialProvider, name, apiHost, apiKey, updateProvider]);

  const {
    sortedFetchedModels,
    filteredProviderModels,
    filteredFetchedModels,
    availableFetchedModels,
  } = useProviderModelFilters({
    providerModels,
    fetchedModels,
    providerModelIdSet,
    modelQuery,
  });

  const benchmark = useProviderBenchmark({
    provider: initialProvider,
    providerModels,
    availableFetchedModels,
    canUseConnectionActions,
    draft: { name, apiHost, apiKey, enabled },
    benchmarkResults,
    setProviderBenchmarkResults,
  });

  const modelActions = useProviderModelActions({
    provider: initialProvider,
    providerModels,
    canUseConnectionActions,
    draft: { name, apiHost, apiKey, enabled },
    addModel,
    addModels,
    deleteModel,
    setFetchedModels,
    setProviderFetchedModels,
    resetBenchmarkState: benchmark.resetBenchmarkState,
  });

  const handleManagedConnect = async (provider: OauthAccountProvider) => {
    await signIn(provider);
  };

  const handleManagedRefresh = async () => {
    await refreshManagedProvider();
  };

  const handleCopyApiKey = async () => {
    if (!apiKey) return;
    try {
      const didCopy = await writeTextToClipboard(apiKey);
      if (didCopy) {
        setApiKeyCopied(true);
        setTimeout(() => setApiKeyCopied(false), 1500);
      }
    } catch {}
  };

  if (!initialProvider) return null;

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
      <ProviderConnectionFields
        providerId={initialProvider.id}
        name={name}
        apiHost={apiHost}
        apiKey={apiKey}
        showApiKey={showApiKey}
        apiKeyCopied={apiKeyCopied}
        onNameChange={(nextName) => {
          setName(nextName);
          onDraftChange?.({ name: nextName });
        }}
        onApiHostChange={(nextApiHost) => {
          setApiHost(nextApiHost);
          onDraftChange?.({ apiHost: nextApiHost });
          modelActions.setFetchError('');
        }}
        onApiKeyChange={(nextApiKey) => {
          setApiKey(nextApiKey);
          modelActions.setFetchError('');
        }}
        onToggleApiKey={() => setShowApiKey((prev) => !prev)}
        onCopyApiKey={handleCopyApiKey}
      />

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
        fetchError={modelActions.fetchError}
        isFetchingModels={modelActions.isFetchingModels}
        canUseConnectionActions={canUseConnectionActions}
        canBenchmark={benchmark.canBenchmarkAll}
        canBenchmarkSelected={benchmark.canBenchmarkSelected}
        canBenchmarkAvailable={benchmark.canBenchmarkAvailable}
        isHealthChecking={benchmark.isHealthChecking}
        benchmarkAllActive={benchmark.benchmarkAllActive}
        selectedBenchmarkActive={benchmark.selectedBenchmarkActive}
        availableBenchmarkActive={benchmark.availableBenchmarkActive}
        healthCheckOverall={benchmark.healthCheckOverall}
        healthStatus={benchmark.healthStatus}
        onQuickAddModelIdChange={setQuickAddModelId}
        onModelQueryChange={setModelQuery}
        onFetchModels={modelActions.handleFetchModels}
        onBenchmark={benchmark.handleBenchmarkAllModels}
        onBenchmarkSelected={benchmark.handleBenchmarkModels}
        onBenchmarkAvailable={benchmark.handleBenchmarkAvailableModels}
        onClearAllModels={modelActions.handleClearAllModels}
        onDeleteModel={deleteModel}
        onAddModel={modelActions.handleAddModel}
        onAddAllVisible={modelActions.handleBatchAdd}
        onSetQuickAddError={setQuickAddError}
      />
    </div>
  );
}
