import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@/components/ui/icons';
import { useAIStore } from '@/stores/useAIStore';
import { useAccountSessionStore } from '@/stores/accountSession';
import { openaiClient } from '@/lib/ai/providers/openai';
import { backgroundBenchmarkRunner } from '@/lib/ai/healthCheck';
import { Provider } from '@/lib/ai/types';
import { type HealthStatus } from './components/ModelListItem';
import { MANAGED_PROVIDER_ID } from '@/lib/ai/managedService';
import { ManagedProviderPanel } from './provider-detail/ManagedProviderPanel';
import { ProviderModelsPanel } from './provider-detail/ProviderModelsPanel';
import type { OauthAccountProvider } from '@/lib/account/provider';
import { SettingsTextInput } from '@/components/Settings/components/SettingsFields';

interface ProviderDetailProps {
  provider: Provider | undefined;
}

type ConnectionStatus = 'idle' | 'checking' | 'success' | 'error';

function maskApiKey(value: string): string {
  if (!value) return '';
  if (value.length <= 4) {
    return '*'.repeat(value.length);
  }
  if (value.length <= 11) {
    return `${value.slice(0, 1)}${'*'.repeat(Math.max(1, value.length - 2))}${value.slice(-1)}`;
  }
  return `${value.slice(0, 7)}${'*'.repeat(value.length - 11)}${value.slice(-4)}`;
}

export function ProviderDetail({ provider: initialProvider }: ProviderDetailProps) {
  const { updateProvider, models, addModel, addModels, deleteModel, deleteProvider, refreshManagedProvider } = useAIStore();
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

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [connectionMessage, setConnectionMessage] = useState('');

  const [healthStatus, setHealthStatus] = useState<Record<string, HealthStatus>>({});
  const [isHealthChecking, setIsHealthChecking] = useState(false);
  const [healthCheckOverall, setHealthCheckOverall] = useState<'idle' | 'success' | 'error'>('idle');

  const providerModels = initialProvider ? models.filter((m) => m.providerId === initialProvider.id) : [];
  const providerModelIdSet = useMemo(() => new Set(providerModels.map((m) => m.apiModelId.toLowerCase())), [providerModels]);
  const isManagedProvider = initialProvider?.id === MANAGED_PROVIDER_ID;

  const providerId = initialProvider?.id;

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
    setFetchedModels([]);
    setConnectionStatus('idle');
    setConnectionMessage('');
    setShowApiKey(false);
    setApiKeyCopied(false);
  }, [providerId]);

  useEffect(() => {
    if (!providerId) {
      setHealthStatus({});
      setHealthCheckOverall('idle');
      setIsHealthChecking(false);
      return;
    }

    const applySnapshot = () => {
      const snapshot = backgroundBenchmarkRunner.getSnapshot(providerId);
      if (!snapshot) {
        setHealthStatus({});
        setHealthCheckOverall('idle');
        setIsHealthChecking(false);
        return;
      }
      setHealthStatus(snapshot.items);
      setHealthCheckOverall(snapshot.overall);
      setIsHealthChecking(snapshot.isRunning);
    };

    applySnapshot();

    return backgroundBenchmarkRunner.subscribe(providerId, (snapshot) => {
      setHealthStatus(snapshot.items);
      setHealthCheckOverall(snapshot.overall);
      setIsHealthChecking(snapshot.isRunning);
    });
  }, [providerId]);

  const canUseConnectionActions = Boolean(initialProvider && apiHost.trim() && apiKey.trim());
  const canBenchmark = canUseConnectionActions && providerModels.length > 0;

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

  const buildTempProvider = (): Provider | null => {
    if (!initialProvider) return null;
    return {
      ...initialProvider,
      name,
      apiHost,
      apiKey,
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
    }, 300);

    return () => clearTimeout(timer);
  }, [initialProvider, name, apiHost, apiKey, updateProvider]);

  const handleTestConnection = async () => {
    if (!canUseConnectionActions) {
      setConnectionStatus('error');
      setConnectionMessage('Base URL and API Key are required.');
      return;
    }

    const tempProvider = buildTempProvider();
    if (!tempProvider) return;

    setConnectionStatus('checking');
    setConnectionMessage('Testing connection...');

    try {
      const ok = await openaiClient.testConnection(tempProvider);
      if (ok) {
        setConnectionStatus('success');
        setConnectionMessage('Connection successful.');
      } else {
        setConnectionStatus('error');
        setConnectionMessage('Connection failed. Please verify URL and key.');
      }
    } catch {
      setConnectionStatus('error');
      setConnectionMessage('Connection failed. Please verify URL and key.');
    }
  };

  const handleBenchmarkModels = async () => {
    if (!initialProvider || !canBenchmark) return;

    const tempProvider = buildTempProvider();
    if (!tempProvider) return;
    backgroundBenchmarkRunner.start(tempProvider, providerModels);
  };

  const handleFetchModels = async () => {
    if (!canUseConnectionActions) {
      setFetchError('Please provide Base URL and API Key first.');
      return;
    }

    const tempProvider = buildTempProvider();
    if (!tempProvider) return;

    setIsFetchingModels(true);
    setFetchError('');
    setFetchedModels([]);

    try {
      const modelsList = await openaiClient.getModels(tempProvider);
      setFetchedModels(modelsList);
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
    backgroundBenchmarkRunner.clear(initialProvider.id);
  };

  const handleManagedConnect = async (provider: OauthAccountProvider) => {
    await signIn(provider);
  };

  const handleManagedRefresh = async () => {
    await refreshManagedProvider();
  };

  const handleDeleteProvider = () => {
    if (!initialProvider || isManagedProvider) return;
    if (!window.confirm('Delete this channel and all its models?')) return;
    deleteProvider(initialProvider.id);
  };

  const handleQuickAdd = () => {
    const modelId = quickAddModelId.trim();
    if (!modelId) return;

    const ok = handleAddModel(modelId);
    if (!ok) {
      setQuickAddError('Model already exists in this channel, or ID is invalid.');
      return;
    }

    setQuickAddError('');
    setQuickAddModelId('');
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
    return (
      <div className="h-full rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-white/5 flex items-center justify-center">
        <p className="text-sm text-gray-400">Please create or select a channel.</p>
      </div>
    );
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

  const datalistId = `provider-model-options-${initialProvider.id}`;

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-4">
        <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#202020] p-6">
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-gray-500">Base URL</label>
              <SettingsTextInput
                type="text"
                value={apiHost}
                onChange={(e) => {
                  setApiHost(e.target.value);
                  setConnectionStatus('idle');
                  setConnectionMessage('');
                  setFetchError('');
                }}
                placeholder="https://api.example.com"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-gray-500">API Key</label>
              <SettingsTextInput
                type="text"
                value={showApiKey ? apiKey : maskApiKey(apiKey)}
                readOnly={!showApiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setConnectionStatus('idle');
                  setConnectionMessage('');
                  setFetchError('');
                }}
                placeholder="sk-..."
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

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-gray-500">Channel Label (optional)</label>
              <SettingsTextInput
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="New Channel"
              />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button
              onClick={handleTestConnection}
              disabled={!canUseConnectionActions || connectionStatus === 'checking'}
              className="h-9 px-4 text-xs font-semibold rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {connectionStatus === 'checking' ? 'Testing...' : 'Test Connection'}
            </button>
            {connectionMessage && (
              <span
                className={`text-xs px-2.5 py-1 rounded-md border ${
                  connectionStatus === 'success'
                    ? 'text-green-700 dark:text-green-400 border-green-200 dark:border-green-900/40 bg-green-50 dark:bg-green-900/20'
                    : connectionStatus === 'error'
                    ? 'text-red-700 dark:text-red-400 border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/20'
                    : 'text-gray-500 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-white/5'
                }`}
              >
                {connectionMessage}
              </span>
            )}
            <button
              onClick={handleDeleteProvider}
              className="h-9 px-4 text-xs font-semibold rounded-lg border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
            >
              Delete Channel
            </button>
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
          canBenchmark={canBenchmark}
          isHealthChecking={isHealthChecking}
          healthCheckOverall={healthCheckOverall}
          healthStatus={healthStatus}
          datalistId={datalistId}
          onQuickAddModelIdChange={setQuickAddModelId}
          onModelQueryChange={setModelQuery}
          onQuickAdd={handleQuickAdd}
          onFetchModels={handleFetchModels}
          onBenchmark={handleBenchmarkModels}
          onClearAllModels={handleClearAllModels}
          onDeleteModel={deleteModel}
          onAddModel={handleAddModel}
          onAddAllVisible={handleBatchAdd}
          onSetQuickAddError={setQuickAddError}
        />
      </div>
  );
}
