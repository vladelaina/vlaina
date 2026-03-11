import { Icon } from '@/components/ui/icons';
import type { AIModel } from '@/lib/ai/types';
import { ModelListItem, type HealthStatus } from '../components/ModelListItem';

interface ProviderModelsPanelProps {
  providerId: string;
  providerModels: AIModel[];
  filteredProviderModels: AIModel[];
  sortedFetchedModels: string[];
  filteredFetchedModels: string[];
  providerModelIdSet: Set<string>;
  modelQuery: string;
  quickAddModelId: string;
  quickAddError: string;
  fetchError: string;
  isFetchingModels: boolean;
  canUseConnectionActions: boolean;
  canBenchmark: boolean;
  isHealthChecking: boolean;
  healthCheckOverall: 'idle' | 'success' | 'error';
  healthStatus: Record<string, HealthStatus>;
  datalistId: string;
  onQuickAddModelIdChange: (value: string) => void;
  onModelQueryChange: (value: string) => void;
  onQuickAdd: () => void;
  onFetchModels: () => void | Promise<void>;
  onBenchmark: () => void | Promise<void>;
  onClearAllModels: () => void;
  onDeleteModel: (modelId: string) => void;
  onAddModel: (modelId: string) => boolean;
  onAddAllVisible: (modelIds: string[]) => void;
  onSetQuickAddError: (message: string) => void;
}

export function ProviderModelsPanel({
  providerId,
  providerModels,
  filteredProviderModels,
  sortedFetchedModels,
  filteredFetchedModels,
  providerModelIdSet,
  modelQuery,
  quickAddModelId,
  quickAddError,
  fetchError,
  isFetchingModels,
  canUseConnectionActions,
  canBenchmark,
  isHealthChecking,
  healthCheckOverall,
  healthStatus,
  datalistId,
  onQuickAddModelIdChange,
  onModelQueryChange,
  onQuickAdd,
  onFetchModels,
  onBenchmark,
  onClearAllModels,
  onDeleteModel,
  onAddModel,
  onAddAllVisible,
  onSetQuickAddError,
}: ProviderModelsPanelProps) {
  return (
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
              onClick={() => void onFetchModels()}
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
              onClick={() => void onBenchmark()}
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
              onQuickAddModelIdChange(e.target.value);
              onSetQuickAddError('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onQuickAdd();
              }
            }}
            list={datalistId}
            placeholder="Enter model ID or select from fetched results"
            className="h-10 px-3 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-700 text-sm outline-none focus:ring-2 focus:ring-gray-500/20"
          />
          <button
            onClick={onQuickAdd}
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
            onChange={(e) => onModelQueryChange(e.target.value)}
            placeholder="Filter selected and discovered models..."
            className="w-full h-10 pl-9 pr-9 text-sm rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-700 outline-none focus:ring-2 focus:ring-gray-500/20"
          />
          {modelQuery && (
            <button
              onClick={() => onModelQueryChange('')}
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
                onClick={onClearAllModels}
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
                  modelId={model.apiModelId}
                  isAdded={true}
                  onRemove={() => onDeleteModel(model.id)}
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
                onClick={() => onAddAllVisible(filteredFetchedModels)}
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
                    key={`${providerId}-${id}`}
                    modelId={id}
                    isAdded={providerModelIdSet.has(id.toLowerCase())}
                    onAdd={() => {
                      const ok = onAddModel(id);
                      if (!ok) {
                        onSetQuickAddError('Model already exists in this channel, or ID is invalid.');
                      } else {
                        onSetQuickAddError('');
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
  );
}
