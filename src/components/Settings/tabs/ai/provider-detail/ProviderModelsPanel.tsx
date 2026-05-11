import type { AIModel } from '@/lib/ai/types';
import { Icon } from '@/components/ui/icons';
import { buildScopedModelId } from '@/lib/ai/utils';
import type { HealthStatus } from '../components/ModelListItem';
import {
  ActionButton,
  ModelRow,
  ModelSearchInput,
  SectionHeader,
  compareHealthStatus,
} from './ProviderModelListParts';
import { ProviderQuickAdd } from './ProviderQuickAdd';
import { VirtualModelList } from './VirtualModelList';
import { chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';

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
  canBenchmarkSelected: boolean;
  canBenchmarkAvailable: boolean;
  isHealthChecking: boolean;
  benchmarkAllActive: boolean;
  selectedBenchmarkActive: boolean;
  availableBenchmarkActive: boolean;
  healthCheckOverall: 'idle' | 'success' | 'error';
  healthStatus: Record<string, HealthStatus>;
  onQuickAddModelIdChange: (value: string) => void;
  onModelQueryChange: (value: string) => void;
  onFetchModels: () => void | Promise<void>;
  onBenchmark: () => void | Promise<void>;
  onBenchmarkSelected: () => void | Promise<void>;
  onBenchmarkAvailable: () => void | Promise<void>;
  onClearAllModels: () => void;
  onDeleteModel: (modelId: string) => void;
  onAddModel: (modelId: string) => boolean;
  onAddAllVisible: (modelIds: string[]) => void;
  onSetQuickAddError: (message: string) => void;
}

export function ProviderModelsPanel(props: ProviderModelsPanelProps) {
  const { t } = useI18n();
  const hasFetchedModels = props.sortedFetchedModels.length > 0;
  const hasActiveQuery = props.modelQuery.trim().length > 0;
  const selectedModelsSource = hasActiveQuery
    ? props.filteredProviderModels
    : props.providerModels;
  const selectedModels = [...selectedModelsSource].sort((left, right) => {
    const healthCompare = compareHealthStatus(
      props.healthStatus[left.id],
      props.healthStatus[right.id]
    );
    if (healthCompare !== 0) {
      return healthCompare;
    }
    return left.apiModelId.localeCompare(right.apiModelId);
  });
  const discoveredModels = hasActiveQuery
    ? props.filteredFetchedModels
    : props.sortedFetchedModels;
  const availableModels = discoveredModels
    .filter((modelId) => !props.providerModelIdSet.has(modelId.toLowerCase()))
    .sort((left, right) => {
      const healthCompare = compareHealthStatus(
        props.healthStatus[buildScopedModelId(props.providerId, left)],
        props.healthStatus[buildScopedModelId(props.providerId, right)]
      );
      if (healthCompare !== 0) {
        return healthCompare;
      }
      return left.localeCompare(right);
    });
  const handleRemoveVisibleSelectedModels = () => {
    if (selectedModels.length === 0) return;
    if (hasActiveQuery) {
      selectedModels.forEach((model) => props.onDeleteModel(model.id));
      return;
    }
    props.onClearAllModels();
  };
  const handleAddVisibleAvailableModels = () => {
    if (availableModels.length === 0) return;
    props.onAddAllVisible(availableModels);
  };
  return (
    <section className="space-y-4">
      <div className={cn("overflow-hidden rounded-[26px] p-1", chatComposerPillSurfaceClass)}>
        <div className="space-y-5 px-6 py-6">
          {hasFetchedModels ? (
            <div className="flex flex-wrap items-center gap-2">
              <ActionButton
                label={props.isFetchingModels ? 'Fetching...' : 'Fetch'}
                icon="common.download"
                disabled={!props.canUseConnectionActions || props.isFetchingModels}
                onClick={() => {
                  void props.onFetchModels();
                }}
              />
              <ActionButton
                label={props.benchmarkAllActive ? 'Stop Benchmark' : 'Benchmark All'}
                icon="misc.activity"
                muted
                disabled={!props.canBenchmark && !props.benchmarkAllActive}
                busy={props.benchmarkAllActive}
                onClick={() => {
                  void props.onBenchmark();
                }}
              />
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 text-[14px] font-bold text-[var(--notes-sidebar-text)]">{t('settings.ai.models')}</div>
              <button
                type="button"
                disabled={!props.canUseConnectionActions || props.isFetchingModels}
                onClick={() => {
                  void props.onFetchModels();
                }}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-transparent bg-[var(--sidebar-row-selected-bg)] px-3.5 text-[12px] font-medium text-[var(--sidebar-row-selected-text)] shadow-none transition-colors hover:bg-[var(--sidebar-row-selected-bg)]/80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {props.isFetchingModels ? (
                  <span className="h-3 w-3 rounded-full border-2 border-zinc-300 border-t-[var(--sidebar-row-selected-text)] animate-spin" />
                ) : (
                  <Icon name="common.download" size="xs" />
                )}
                {props.isFetchingModels ? 'Fetching...' : 'Fetch'}
              </button>
            </div>
          )}

          {hasFetchedModels ? (
            <ModelSearchInput
              value={props.modelQuery}
              onChange={props.onModelQueryChange}
            />
          ) : null}

          {hasFetchedModels ? (
            <ProviderQuickAdd
              value={props.quickAddModelId}
              error={props.quickAddError}
              sortedFetchedModels={props.sortedFetchedModels}
              providerModelIdSet={props.providerModelIdSet}
              onValueChange={props.onQuickAddModelIdChange}
              onAddAllVisible={props.onAddAllVisible}
              onSetError={props.onSetQuickAddError}
            />
          ) : null}

          {props.quickAddError ? (
            <div className="text-[12px] text-red-500 px-1">{props.quickAddError}</div>
          ) : null}
          {props.fetchError ? (
            <div className="text-[12px] text-red-500 px-1">{props.fetchError}</div>
          ) : null}

          {hasFetchedModels ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <SectionHeader
                  label="Selected"
                  disabled={!props.canBenchmarkSelected}
                  busy={props.selectedBenchmarkActive}
                  onBenchmark={props.onBenchmarkSelected}
                  actionLabel={hasActiveQuery ? 'Remove visible' : 'Remove all'}
                  actionDisabled={selectedModels.length === 0}
                  onAction={handleRemoveVisibleSelectedModels}
                />
                <VirtualModelList
                  items={selectedModels}
                  getKey={(model) => model.id}
                  renderItem={(model) => (
                    <ModelRow
                      model={model.apiModelId}
                      selected
                      health={props.healthStatus[model.id]}
                      onClick={() => props.onDeleteModel(model.id)}
                      trailing={null}
                    />
                  )}
                  emptyState="No selected models"
                />
              </div>

              <div className="space-y-3">
                <SectionHeader
                  label="Available"
                  disabled={!props.canBenchmarkAvailable}
                  busy={props.availableBenchmarkActive}
                  onBenchmark={props.onBenchmarkAvailable}
                  actionLabel={hasActiveQuery ? 'Add visible' : 'Add all'}
                  actionDisabled={availableModels.length === 0}
                  onAction={handleAddVisibleAvailableModels}
                />
                <VirtualModelList
                  items={availableModels}
                  getKey={(modelId) => modelId}
                  renderItem={(modelId) => (
                    <ModelRow
                      model={modelId}
                      health={props.healthStatus[buildScopedModelId(props.providerId, modelId)]}
                      onClick={() => {
                        props.onAddModel(modelId);
                      }}
                      trailing={null}
                    />
                  )}
                  emptyState="No available models"
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
