import { useState, useEffect } from 'react';
import { Icon } from '@/components/ui/icons';
import { useAIStore } from '@/stores/useAIStore';
import { openaiClient } from '@/lib/ai/providers/openai';
import { checkModelHealth } from '@/lib/ai/healthCheck';
import { Provider } from '@/lib/ai/types';
import { AppIcon } from '@/components/common/AppIcon';
import { ModelListItem, HealthStatus } from './components/ModelListItem';
import { AddModelModal } from './components/AddModelModal';
import { HealthCheckButton } from './components/HealthCheckButton';
import { generateModelGroup } from '@/lib/ai/utils';
import { IconSelector } from '@/components/common/IconSelector';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';

interface ProviderDetailProps {
  provider: Provider | undefined;
}

export function ProviderDetail({ provider: initialProvider }: ProviderDetailProps) {
  const {
    updateProvider,
    deleteProvider,
    models,
    addModel,
    addModels,
    deleteModel
  } = useAIStore();

  const [name, setName] = useState(initialProvider?.name || '');
  const [apiKey, setApiKey] = useState(initialProvider?.apiKey || '');
  const [apiHost, setApiHost] = useState(initialProvider?.apiHost || '');

  const [isAddingModel, setIsAddingModel] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);
  const [modelQuery, setModelQuery] = useState('');

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const [previewIcon, setPreviewIcon] = useState<string | null>(null);

  const [healthStatus, setHealthStatus] = useState<Record<string, HealthStatus>>({});
  const [isHealthChecking, setIsHealthChecking] = useState(false);
  const [healthCheckOverall, setHealthCheckOverall] = useState<'idle' | 'success' | 'error'>('idle');

  const providerModels = initialProvider
    ? models.filter(m => m.providerId === initialProvider.id)
    : [];

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
    setFetchedModels([]);
    setCollapsedGroups(new Set());
    setIsAddingModel(false);
    setIsDeleting(false);
    setPreviewIcon(null);
    setModelQuery('');
    setHealthStatus({});
    setHealthCheckOverall('idle');
  }, [initialProvider]);

  const handleSave = () => {
    if (!initialProvider) return;
    updateProvider(initialProvider.id, { name, apiKey, apiHost, updatedAt: Date.now() });
  };

  const handleBatchHealthCheck = async () => {
    if (!initialProvider || !apiKey) return;

    setIsHealthChecking(true);
    setHealthCheckOverall('idle');

    const initialStatus: Record<string, HealthStatus> = {};
    providerModels.forEach(m => {
      initialStatus[m.id] = { status: 'loading' };
    });
    setHealthStatus(initialStatus);

    const tempProvider = { ...initialProvider, apiKey, apiHost };

    try {
      if (providerModels.length === 0) {
        const success = await openaiClient.testConnection(tempProvider);
        setHealthCheckOverall(success ? 'success' : 'error');
      } else {
        const results = await Promise.all(providerModels.map(async (model) => {
          try {
            const res = await checkModelHealth(tempProvider, model);
            return { id: model.id, ...res };
          } catch (e: any) {
            return { id: model.id, status: 'error', error: e.message };
          }
        }));

        const newStatus: Record<string, HealthStatus> = {};
        let hasError = false;

        results.forEach((res: any) => {
          newStatus[res.id] = {
            status: res.status,
            latency: res.latency,
            error: res.error
          };
          if (res.status === 'error') hasError = true;
        });

        setHealthStatus(newStatus);
        setHealthCheckOverall(hasError ? 'error' : 'success');
      }
    } catch {
      setHealthCheckOverall('error');
    } finally {
      setIsHealthChecking(false);
      setTimeout(() => setHealthCheckOverall('idle'), 3000);
    }
  };

  const handleFetchModels = async () => {
    if (!apiKey.trim()) return;

    setIsFetchingModels(true);
    setFetchedModels([]);

    try {
      const tempProvider: Provider = {
        id: initialProvider?.id || 'temp',
        name,
        type: 'newapi',
        apiHost,
        apiKey,
        enabled: true,
        createdAt: 0,
        updatedAt: 0
      };
      const modelsList = await openaiClient.getModels(tempProvider);
      if (modelsList.length > 0) {
        setFetchedModels(modelsList);
      }
    } catch {
      // Intentionally no-op; UI state is enough for now.
    } finally {
      setIsFetchingModels(false);
    }
  };

  const handleAddModel = (id: string, displayName?: string): boolean => {
    if (!id.trim() || !initialProvider) return false;

    const trimmedId = id.trim();
    const exists = providerModels.some(m => m.id.toLowerCase() === trimmedId.toLowerCase());
    if (exists) return false;

    addModel({
      id: trimmedId,
      name: displayName?.trim() || trimmedId,
      providerId: initialProvider.id,
      enabled: true
    });

    return true;
  };

  const handleBatchAdd = (ids: string[]) => {
    if (!initialProvider || ids.length === 0) return;

    const existingIds = new Set(providerModels.map(m => m.id.toLowerCase()));
    const newIds = ids
      .map(id => id.trim())
      .filter(id => id && !existingIds.has(id.toLowerCase()));

    if (newIds.length === 0) return;

    addModels(newIds.map(id => ({
      id,
      name: id,
      providerId: initialProvider.id,
      enabled: true
    })));
  };

  const toggleGroup = (groupKey: string) => {
    const newSet = new Set(collapsedGroups);
    if (newSet.has(groupKey)) {
      newSet.delete(groupKey);
    } else {
      newSet.add(groupKey);
    }
    setCollapsedGroups(newSet);
  };

  const groupModelsList = (modelIds: string[]) => {
    return modelIds.reduce((acc, id) => {
      const group = generateModelGroup(id);
      if (!acc[group]) acc[group] = [];
      acc[group].push(id);
      return acc;
    }, {} as Record<string, string[]>);
  };

  const normalizedQuery = modelQuery.trim().toLowerCase();
  const filteredFetchedModels = normalizedQuery
    ? fetchedModels.filter(id => id.toLowerCase().includes(normalizedQuery))
    : fetchedModels;
  const filteredProviderModels = normalizedQuery
    ? providerModels.filter(m => `${m.id} ${m.name}`.toLowerCase().includes(normalizedQuery))
    : providerModels;

  const fetchedGroups = groupModelsList(filteredFetchedModels);
  const addedGroups = groupModelsList(filteredProviderModels.map(m => m.id));
  const providerModelIdSet = new Set(providerModels.map(m => m.id));

  return (
    <>
      <div className="h-full max-w-6xl mx-auto flex flex-col gap-5">
        {!initialProvider ? (
          <div className="h-full rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-white/5 flex items-center justify-center">
            <p className="text-sm text-gray-400">Please create or select a channel from the left sidebar.</p>
          </div>
        ) : (
          <>
            <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#202020] px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <IconSelector
                    value={initialProvider.icon || 'cube'}
                    onChange={(icon) => updateProvider(initialProvider.id, { icon })}
                    onHover={setPreviewIcon}
                    compact
                    trigger={
                      <button className="w-12 h-12 rounded-xl bg-gray-50 dark:bg-gray-800/80 flex items-center justify-center transition-all border border-gray-200 dark:border-gray-700">
                        <AppIcon icon={previewIcon || initialProvider.icon || 'cube'} size="lg" />
                      </button>
                    }
                  />

                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">Channel</p>
                    <h2 className="text-[28px] leading-8 font-bold text-gray-900 dark:text-gray-100 mt-0.5">{name || 'Untitled Channel'}</h2>
                    <p className="text-xs text-gray-500 mt-1.5">Use the left sidebar to switch channels.</p>
                  </div>
                </div>

                <button
                  onClick={() => setIsDeleting(true)}
                  className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  title="Delete Channel"
                >
                  <Icon name="common.delete" size="md" />
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#202020] px-6 py-5">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Connection</h3>
                <button
                  onClick={handleSave}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-black text-white dark:bg-white dark:text-black hover:opacity-85 transition-opacity"
                >
                  Save
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[11px] font-medium text-gray-500">Channel Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={handleSave}
                    placeholder="New Channel"
                    className="w-full h-10 px-3 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-700 text-sm outline-none focus:ring-2 focus:ring-gray-500/20"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-gray-500">Base URL</label>
                  <input
                    type="text"
                    value={apiHost}
                    onChange={(e) => setApiHost(e.target.value)}
                    onBlur={handleSave}
                    placeholder="https://api.example.com"
                    className="w-full h-10 px-3 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-700 text-sm outline-none focus:ring-2 focus:ring-gray-500/20"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-gray-500">API Key</label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    onBlur={handleSave}
                    placeholder="sk-..."
                    className="w-full h-10 px-3 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-700 text-sm font-mono outline-none focus:ring-2 focus:ring-gray-500/20"
                  />
                </div>
              </div>
            </section>

            <section className="flex-1 min-h-0 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#202020] flex flex-col">
              <div className="px-6 pt-5 pb-4 border-b border-gray-200 dark:border-gray-800">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Models</h3>
                    <span className="text-xs text-gray-400">({providerModels.length})</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <HealthCheckButton
                      onCheck={handleBatchHealthCheck}
                      isChecking={isHealthChecking}
                      overallStatus={healthCheckOverall}
                      disabled={!apiKey}
                    />
                    <button
                      onClick={handleFetchModels}
                      disabled={isFetchingModels || !apiKey}
                      className="flex items-center gap-1.5 h-8 px-3 text-xs font-semibold rounded-lg bg-black text-white dark:bg-white dark:text-black disabled:opacity-50 hover:opacity-85 transition-opacity"
                    >
                      {isFetchingModels ? <div className="size-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Icon name="common.download" size="sm" />}
                      Fetch Models
                    </button>
                    <button
                      onClick={() => setIsAddingModel(true)}
                      className="flex items-center gap-1.5 h-8 px-3 text-xs font-semibold rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                    >
                      <Icon name="common.add" size="sm" />
                      Add Manual
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <Icon name="common.search" className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={modelQuery}
                    onChange={(e) => setModelQuery(e.target.value)}
                    placeholder="Filter models by name or ID..."
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

              <div className="flex-1 min-h-0 overflow-y-auto p-5">
                <div className={`grid gap-4 ${fetchedModels.length > 0 ? 'xl:grid-cols-2' : 'grid-cols-1'}`}>
                  <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-white/[0.02] min-h-[280px] flex flex-col">
                    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">Configured</p>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 space-y-3">
                      {providerModels.length === 0 ? (
                        <div className="text-center py-12 text-gray-400 bg-white/60 dark:bg-black/10 rounded-lg border border-dashed border-gray-200 dark:border-gray-800">
                          <p className="text-sm">No models configured.</p>
                        </div>
                      ) : filteredProviderModels.length === 0 ? (
                        <div className="text-center py-12 text-gray-400 bg-white/60 dark:bg-black/10 rounded-lg border border-dashed border-gray-200 dark:border-gray-800">
                          <p className="text-sm">No configured models match your filter.</p>
                        </div>
                      ) : (
                        Object.entries(addedGroups).sort().map(([group, groupModels]) => {
                          const isCollapsed = collapsedGroups.has(`added-${group}`);

                          return (
                            <div key={group} className="space-y-2">
                              <button
                                onClick={() => toggleGroup(`added-${group}`)}
                                className="w-full flex items-center gap-2 px-1 text-left"
                              >
                                {isCollapsed ? <Icon name="nav.chevronRight" size="sm" className="text-gray-400" /> : <Icon name="nav.chevronDown" size="sm" className="text-gray-400" />}
                                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{group}</span>
                                <span className="text-[10px] text-gray-400">({groupModels.length})</span>
                              </button>

                              {!isCollapsed && (
                                <div className="space-y-1.5 pl-1">
                                  {groupModels.map((id) => (
                                    <ModelListItem
                                      key={id}
                                      modelId={id}
                                      isAdded={true}
                                      onRemove={() => deleteModel(id)}
                                      health={healthStatus[id]}
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {fetchedModels.length > 0 && (
                    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-white/[0.02] min-h-[280px] flex flex-col">
                      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between gap-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">Discovered</p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleBatchAdd(filteredFetchedModels)}
                            className="text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
                          >
                            Add All
                          </button>
                          <button
                            onClick={() => setFetchedModels([])}
                            className="text-xs font-medium text-gray-400 hover:text-gray-600"
                          >
                            Hide
                          </button>
                        </div>
                      </div>

                      <div className="flex-1 overflow-y-auto p-3 space-y-3">
                        {Object.entries(fetchedGroups).length === 0 ? (
                          <div className="text-center py-12 text-xs text-gray-400">
                            No discovered models match your filter.
                          </div>
                        ) : (
                          Object.entries(fetchedGroups).sort().map(([group, groupModels]) => {
                            const isCollapsed = collapsedGroups.has(`fetched-${group}`);
                            const allAdded = groupModels.every((id) => providerModelIdSet.has(id));

                            return (
                              <div key={group} className="space-y-2">
                                <div className="w-full flex items-center justify-between px-1">
                                  <button onClick={() => toggleGroup(`fetched-${group}`)} className="flex items-center gap-2 flex-1 text-left">
                                    {isCollapsed ? <Icon name="nav.chevronRight" size="sm" className="text-gray-400" /> : <Icon name="nav.chevronDown" size="sm" className="text-gray-400" />}
                                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{group}</span>
                                    <span className="text-[10px] text-gray-400">({groupModels.length})</span>
                                  </button>

                                  {!allAdded && (
                                    <button
                                      onClick={() => handleBatchAdd(groupModels)}
                                      className="text-[10px] font-semibold text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                                    >
                                      Add Group
                                    </button>
                                  )}
                                </div>

                                {!isCollapsed && (
                                  <div className="space-y-1.5 pl-1">
                                    {groupModels.map((id) => (
                                      <ModelListItem
                                        key={id}
                                        modelId={id}
                                        isAdded={providerModelIdSet.has(id)}
                                        onAdd={() => handleAddModel(id)}
                                      />
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </>
        )}
      </div>

      <AddModelModal
        isOpen={isAddingModel}
        onClose={() => setIsAddingModel(false)}
        existingModelIds={providerModels.map(m => m.id)}
        onAdd={(id, displayName) => handleAddModel(id, displayName)}
      />

      <ConfirmDialog
        isOpen={isDeleting}
        onClose={() => setIsDeleting(false)}
        onConfirm={() => {
          if (initialProvider) deleteProvider(initialProvider.id);
        }}
        title="Delete Channel"
        description="Are you sure you want to delete this channel? All configuration and models will be lost."
        confirmText="Delete"
        variant="danger"
      />
    </>
  );
}
