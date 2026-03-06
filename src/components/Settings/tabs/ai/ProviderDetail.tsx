import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@/components/ui/icons';
import { useAIStore } from '@/stores/useAIStore';
import { openaiClient } from '@/lib/ai/providers/openai';
import { checkModelHealth } from '@/lib/ai/healthCheck';
import { Provider } from '@/lib/ai/types';
import { ModelListItem, HealthStatus } from './components/ModelListItem';

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
  const { updateProvider, models, addModel, addModels, deleteModel } = useAIStore();

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
  const providerModelIdSet = useMemo(() => new Set(providerModels.map((m) => m.id)), [providerModels]);

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
    setHealthStatus({});
    setHealthCheckOverall('idle');
    setShowApiKey(false);
    setApiKeyCopied(false);
  }, [initialProvider]);

  const canUseConnectionActions = Boolean(initialProvider && apiHost.trim() && apiKey.trim());
  const canBenchmark = canUseConnectionActions && providerModels.length > 0;

  const sortedFetchedModels = useMemo(() => {
    return [...new Set(fetchedModels)].sort((a, b) => a.localeCompare(b));
  }, [fetchedModels]);

  const normalizedQuery = modelQuery.trim().toLowerCase();
  const filteredProviderModels = useMemo(() => {
    const base = [...providerModels].sort((a, b) => a.id.localeCompare(b.id));
    if (!normalizedQuery) return base;
    return base.filter((m) => `${m.id} ${m.name}`.toLowerCase().includes(normalizedQuery));
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

  const handleSave = () => {
    if (!initialProvider) return;
    updateProvider(initialProvider.id, { name, apiKey, apiHost, updatedAt: Date.now() });
  };

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

    setIsHealthChecking(true);
    setHealthCheckOverall('idle');

    const loadingStatus: Record<string, HealthStatus> = {};
    providerModels.forEach((m) => {
      loadingStatus[m.id] = { status: 'loading' };
    });
    setHealthStatus(loadingStatus);

    const tempProvider = buildTempProvider();
    if (!tempProvider) {
      setIsHealthChecking(false);
      return;
    }

    try {
      const results = await Promise.all(
        providerModels.map(async (model) => {
          try {
            const res = await checkModelHealth(tempProvider, model);
            return { id: model.id, ...res };
          } catch (e: any) {
            return { id: model.id, status: 'error' as const, error: e?.message || 'Unknown error' };
          }
        })
      );

      const nextStatus: Record<string, HealthStatus> = {};
      let hasError = false;

      results.forEach((res) => {
        nextStatus[res.id] = {
          status: res.status,
          latency: 'latency' in res ? res.latency : undefined,
          error: res.error,
        };
        if (res.status === 'error') hasError = true;
      });

      setHealthStatus(nextStatus);
      setHealthCheckOverall(hasError ? 'error' : 'success');
    } catch {
      setHealthCheckOverall('error');
    } finally {
      setIsHealthChecking(false);
    }
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
    const existsInProvider = providerModels.some((m) => m.id.toLowerCase() === trimmedId.toLowerCase());
    if (existsInProvider) return false;

    addModel({
      id: trimmedId,
      name: displayName?.trim() || trimmedId,
      providerId: initialProvider.id,
      enabled: true,
    });

    return true;
  };

  const handleBatchAdd = (ids: string[]) => {
    if (!initialProvider || ids.length === 0) return;

    const existingIds = new Set(providerModels.map((m) => m.id.toLowerCase()));
    const newIds = ids
      .map((id) => id.trim())
      .filter((id) => id && !existingIds.has(id.toLowerCase()));

    if (newIds.length === 0) return;

    addModels(
      newIds.map((id) => ({
        id,
        name: id,
        providerId: initialProvider.id,
        enabled: true,
      }))
    );
  };

  const handleClearAllModels = () => {
    if (providerModels.length === 0) return;
    providerModels.forEach((model) => {
      deleteModel(model.id);
    });
    setHealthStatus({});
    setHealthCheckOverall('idle');
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

  const datalistId = `provider-model-options-${initialProvider.id}`;

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-4">
        <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#202020] p-6">
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-gray-500">Base URL</label>
              <input
                type="text"
                value={apiHost}
                onChange={(e) => {
                  setApiHost(e.target.value);
                  setConnectionStatus('idle');
                  setConnectionMessage('');
                  setFetchError('');
                }}
                onBlur={handleSave}
                placeholder="https://api.example.com"
                className="w-full h-11 px-3 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-700 text-sm outline-none focus:ring-2 focus:ring-gray-500/20"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-gray-500">API Key</label>
              <div className="relative">
                <input
                  type="text"
                  value={showApiKey ? apiKey : maskApiKey(apiKey)}
                  readOnly={!showApiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    setConnectionStatus('idle');
                    setConnectionMessage('');
                    setFetchError('');
                  }}
                  onBlur={handleSave}
                  placeholder="sk-..."
                  className="w-full h-11 px-3 pr-20 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-700 text-sm font-mono outline-none focus:ring-2 focus:ring-gray-500/20"
                />
                <div className="absolute inset-y-0 right-2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowApiKey((prev) => !prev)}
                    className="h-7 w-7 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors flex items-center justify-center"
                    title={showApiKey ? 'Hide API Key' : 'Show API Key'}
                  >
                    <Icon name={showApiKey ? 'common.eyeOff' : 'common.eye'} size="sm" />
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyApiKey}
                    disabled={!apiKey}
                    className="h-7 w-7 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
                    title={apiKeyCopied ? 'Copied' : 'Copy API Key'}
                  >
                    <Icon name={apiKeyCopied ? 'common.check' : 'common.copy'} size="sm" />
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-gray-500">Channel Label (optional)</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={handleSave}
                placeholder="New Channel"
                className="w-full h-10 px-3 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-700 text-sm outline-none focus:ring-2 focus:ring-gray-500/20"
              />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button
              onClick={handleSave}
              className="h-9 px-4 text-xs font-semibold rounded-lg bg-black text-white dark:bg-white dark:text-black hover:opacity-85 transition-opacity"
            >
              Save
            </button>
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
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#202020] flex flex-col">
          <div className="px-6 pt-5 pb-4 border-b border-gray-200 dark:border-gray-800">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Models <span className="text-gray-400 font-normal">({providerModels.length})</span>
                </h3>
                <p className="mt-1 text-xs text-gray-500">Choose available models and benchmark response speed.</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleFetchModels}
                  disabled={!canUseConnectionActions || isFetchingModels}
                  className="h-8 px-3 text-xs font-semibold rounded-lg bg-black text-white dark:bg-white dark:text-black disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-85 transition-opacity flex items-center gap-1.5"
                >
                  {isFetchingModels ? (
                    <div className="size-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Icon name="common.download" size="sm" />
                  )}
                  Fetch Models
                </button>
                <button
                  onClick={handleBenchmarkModels}
                  disabled={!canBenchmark || isHealthChecking}
                  className="h-8 px-3 text-xs font-semibold rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                >
                  {isHealthChecking ? (
                    <div className="size-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Icon name="misc.activity" size="sm" />
                  )}
                  Benchmark
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-2">
              <input
                type="text"
                value={quickAddModelId}
                onChange={(e) => {
                  setQuickAddModelId(e.target.value);
                  setQuickAddError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleQuickAdd();
                  }
                }}
                list={datalistId}
                placeholder="Enter model ID or select from fetched results"
                className="h-10 px-3 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-700 text-sm outline-none focus:ring-2 focus:ring-gray-500/20"
              />
              <button
                onClick={handleQuickAdd}
                className="h-10 px-4 text-xs font-semibold rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
              >
                Add Model
              </button>
              <datalist id={datalistId}>
                {sortedFetchedModels.map((id) => (
                  <option key={id} value={id} />
                ))}
              </datalist>
            </div>

            {(quickAddError || fetchError) && (
              <p className="mt-2 text-xs text-red-600 dark:text-red-400">{quickAddError || fetchError}</p>
            )}

            <div className="mt-3 relative">
              <Icon name="common.search" className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={modelQuery}
                onChange={(e) => setModelQuery(e.target.value)}
                placeholder="Filter selected and discovered models..."
                className="w-full h-10 pl-9 pr-9 text-sm rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-700 outline-none focus:ring-2 focus:ring-gray-500/20"
              />
              {modelQuery && (
                <button
                  onClick={() => setModelQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400"
                  title="Clear"
                >
                  <Icon name="common.close" size="xs" />
                </button>
              )}
            </div>
          </div>

          <div className="p-5 space-y-4">
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-white/[0.02]">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">Selected Models</p>
                <div className="flex items-center gap-2">
                  {healthCheckOverall !== 'idle' && (
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                        healthCheckOverall === 'success'
                          ? 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20'
                          : 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20'
                      }`}
                    >
                      {healthCheckOverall === 'success' ? 'Benchmark Passed' : 'Benchmark Has Errors'}
                    </span>
                  )}
                  <button
                    onClick={handleClearAllModels}
                    disabled={providerModels.length === 0}
                    className="text-xs font-semibold text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              <div className="p-3 space-y-1.5">
                {providerModels.length === 0 ? (
                  <div className="text-center py-10 text-gray-400 bg-white/60 dark:bg-black/10 rounded-lg border border-dashed border-gray-200 dark:border-gray-800">
                    <p className="text-sm">No models selected yet.</p>
                  </div>
                ) : filteredProviderModels.length === 0 ? (
                  <div className="text-center py-10 text-gray-400 bg-white/60 dark:bg-black/10 rounded-lg border border-dashed border-gray-200 dark:border-gray-800">
                    <p className="text-sm">No selected models match your filter.</p>
                  </div>
                ) : (
                  filteredProviderModels.map((model) => (
                    <ModelListItem
                      key={model.id}
                      modelId={model.id}
                      isAdded={true}
                      onRemove={() => deleteModel(model.id)}
                      health={healthStatus[model.id]}
                    />
                  ))
                )}
              </div>
            </div>

            {sortedFetchedModels.length > 0 && (
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-white/[0.02]">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">Discovered Models</p>
                  <button
                    onClick={() => handleBatchAdd(filteredFetchedModels)}
                    className="text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
                  >
                    Add All Visible
                  </button>
                </div>

                <div className="p-3 space-y-1.5">
                  {filteredFetchedModels.length === 0 ? (
                    <div className="text-center py-10 text-gray-400 bg-white/60 dark:bg-black/10 rounded-lg border border-dashed border-gray-200 dark:border-gray-800">
                      <p className="text-sm">No discovered models match your filter.</p>
                    </div>
                  ) : (
                    filteredFetchedModels.map((id) => (
                      <ModelListItem
                        key={id}
                        modelId={id}
                        isAdded={providerModelIdSet.has(id)}
                        onAdd={() => {
                          const ok = handleAddModel(id);
                          if (!ok) {
                            setQuickAddError('Model already exists in this channel, or ID is invalid.');
                          } else {
                            setQuickAddError('');
                          }
                        }}
                      />
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
  );
}
