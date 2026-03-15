import { useEffect, useRef, useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import type { AIModel } from '@/lib/ai/types';
import { Icon } from '@/components/ui/icons';
import { SettingsTextInput } from '@/components/Settings/components/SettingsFields';
import { cn } from '@/lib/utils';
import { buildScopedModelId } from '@/lib/ai/utils';
import type { HealthStatus } from '../components/ModelListItem';

const SLOW_BENCHMARK_LATENCY_MS = 3000;
const QUICK_ADD_SPLIT_PATTERN = /[,\uFF0C]+/;

function compareHealthStatus(left?: HealthStatus, right?: HealthStatus) {
  const score = (health?: HealthStatus) => {
    if (!health) {
      return 3;
    }
    if (health.status === 'success') {
      return 0;
    }
    if (health.status === 'loading') {
      return 1;
    }
    return 2;
  };

  const leftScore = score(left);
  const rightScore = score(right);
  if (leftScore !== rightScore) {
    return leftScore - rightScore;
  }

  if (left?.status === 'success' && right?.status === 'success') {
    return (left.latency || Number.MAX_SAFE_INTEGER) - (right.latency || Number.MAX_SAFE_INTEGER);
  }

  return 0;
}

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

function ActionButton({
  label,
  icon,
  muted = false,
  compact = false,
  disabled = false,
  busy = false,
  onClick,
}: {
  label: string;
  icon?: ComponentProps<typeof Icon>['name'];
  muted?: boolean;
  compact?: boolean;
  disabled?: boolean;
  busy?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-full border text-[12px] font-medium transition-colors',
        compact ? 'h-8 px-3' : 'h-9 px-3.5',
        muted
          ? 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50'
          : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50'
      )}
    >
      {busy ? (
        <div className="h-3 w-3 rounded-full border-2 border-zinc-300 border-t-emerald-500 animate-spin" />
      ) : icon ? (
        <Icon name={icon} size="xs" />
      ) : null}
      {label}
    </button>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
      {children}
    </div>
  );
}

function SectionHeader({
  label,
  disabled,
  busy,
  onBenchmark,
}: {
  label: string;
  disabled: boolean;
  busy: boolean;
  onBenchmark: () => void | Promise<void>;
}) {
  return (
    <div className="flex items-center gap-2">
      <SectionLabel>{label}</SectionLabel>
      <button
        type="button"
        disabled={disabled && !busy}
        onClick={() => {
          void onBenchmark();
        }}
        className="flex h-5 w-5 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-35"
      >
        {busy ? (
          <div className="h-3 w-3 rounded-full border-2 border-zinc-300 border-t-emerald-500 animate-spin" />
        ) : (
          <Icon name="misc.activity" size="xs" />
        )}
      </button>
    </div>
  );
}

function HealthBadge({ health }: { health?: HealthStatus }) {
  if (!health) {
    return null;
  }

  if (health.status === 'loading') {
    return <div className="h-3.5 w-3.5 rounded-full border-2 border-zinc-300 border-t-emerald-500 animate-spin" />;
  }

  if (health.status === 'success') {
    const isSlow = typeof health.latency === 'number' && health.latency >= SLOW_BENCHMARK_LATENCY_MS;
    return (
      <span
        className={cn(
          'rounded-full px-2 py-1 text-[10px] font-medium',
          isSlow ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
        )}
      >
        {health.latency}ms
      </span>
    );
  }

  return (
    <span
      className="rounded-full bg-red-100 px-2 py-1 text-[10px] font-medium text-red-700"
      title={health.error}
    >
      Failed
    </span>
  );
}

function getHealthTone(health?: HealthStatus): 'neutral' | 'success' | 'warning' | 'error' | 'loading' {
  if (!health) {
    return 'neutral';
  }

  if (health.status === 'loading') {
    return 'loading';
  }

  if (health.status === 'error') {
    return 'error';
  }

  return typeof health.latency === 'number' && health.latency >= SLOW_BENCHMARK_LATENCY_MS
    ? 'warning'
    : 'success';
}

function parseQuickAddModelIds(value: string) {
  return value
    .split(QUICK_ADD_SPLIT_PATTERN)
    .map((item) => item.trim())
    .filter(Boolean);
}

function replaceTrailingQuickAddSegment(value: string, nextSegment: string) {
  const parts = value.split(/[,\uFF0C]/);
  if (parts.length <= 1) {
    return nextSegment;
  }

  const prefix = parts
    .slice(0, -1)
    .map((part) => part.trim())
    .filter(Boolean);

  return [...prefix, nextSegment].join(', ');
}

function ModelRow({
  model,
  trailing,
  selected = false,
  health,
  onClick,
  decorativeTrailing = false,
}: {
  model: string;
  trailing: ReactNode;
  selected?: boolean;
  health?: HealthStatus;
  onClick?: () => void;
  decorativeTrailing?: boolean;
}) {
  const tone = getHealthTone(health);
  const className = cn(
    'flex items-center gap-3 rounded-[18px] border px-3.5 py-3 text-left',
    selected && tone === 'neutral' && 'border-zinc-200 bg-zinc-50/90 text-zinc-900',
    selected && tone === 'success' && 'border-emerald-300 bg-emerald-100 text-zinc-900',
    selected && tone === 'warning' && 'border-amber-300 bg-amber-100 text-zinc-900',
    selected && tone === 'error' && 'border-red-300 bg-red-100 text-zinc-900',
    selected && tone === 'loading' && 'border-zinc-200 bg-zinc-50/90 text-zinc-900',
    !selected && tone === 'neutral' && 'border-zinc-200/80 bg-white text-zinc-900',
    !selected && tone === 'success' && 'border-emerald-300 bg-emerald-100/75 text-zinc-900',
    !selected && tone === 'warning' && 'border-amber-300 bg-amber-100/75 text-zinc-900',
    !selected && tone === 'error' && 'border-red-300 bg-red-100/75 text-zinc-900',
    !selected && tone === 'loading' && 'border-zinc-200/80 bg-white text-zinc-900',
    onClick && 'cursor-pointer'
  );

  const content = (
    <>
      <div className="min-w-0 flex-1 truncate text-[13px] font-medium">{model}</div>
      <HealthBadge health={health} />
      <div className={cn('shrink-0', decorativeTrailing && 'pointer-events-none')}>{trailing}</div>
    </>
  );

  if (onClick) {
    return (
      <div role="button" tabIndex={0} onClick={onClick} onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }} className={className}>
        {content}
      </div>
    );
  }

  return <div className={className}>{content}</div>;
}

export function ProviderModelsPanel(props: ProviderModelsPanelProps) {
  const [isQuickAddFocused, setIsQuickAddFocused] = useState(false);
  const [highlightedQuickAddIndex, setHighlightedQuickAddIndex] = useState(0);
  const quickAddItemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const hasFetchedModels = props.sortedFetchedModels.length > 0;
  const quickAddIds = parseQuickAddModelIds(props.quickAddModelId);
  const quickAddQuery = props.quickAddModelId.split(/[,\uFF0C]/).at(-1)?.trim() ?? '';
  const queuedQuickAddIds = new Set(quickAddIds.slice(0, -1).map((id) => id.toLowerCase()));
  const selectedModelsSource = props.filteredProviderModels.length > 0
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
  const discoveredModels =
    props.filteredFetchedModels.length > 0 ? props.filteredFetchedModels : props.sortedFetchedModels;
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
  const quickAddSuggestions = quickAddQuery
    ? props.sortedFetchedModels.filter((modelId) => {
        const normalizedModelId = modelId.toLowerCase();
        return (
          !props.providerModelIdSet.has(normalizedModelId) &&
          !queuedQuickAddIds.has(normalizedModelId) &&
          normalizedModelId.includes(quickAddQuery.toLowerCase())
        );
      })
    : [];
  const showQuickAddSuggestions = isQuickAddFocused && quickAddSuggestions.length > 0;

  useEffect(() => {
    if (quickAddSuggestions.length === 0) {
      setHighlightedQuickAddIndex(0);
      return;
    }

    setHighlightedQuickAddIndex((current) => Math.min(current, quickAddSuggestions.length - 1));
  }, [quickAddSuggestions]);

  useEffect(() => {
    if (!showQuickAddSuggestions) {
      return;
    }

    quickAddItemRefs.current[highlightedQuickAddIndex]?.scrollIntoView({ block: 'nearest' });
  }, [highlightedQuickAddIndex, showQuickAddSuggestions]);

  const handleSelectQuickAddSuggestion = (modelId: string) => {
    props.onQuickAddModelIdChange(replaceTrailingQuickAddSegment(props.quickAddModelId, modelId));
    if (props.quickAddError) {
      props.onSetQuickAddError('');
    }
  };

  const handleSubmitQuickAdd = (modelId?: string) => {
    const nextValue = modelId
      ? replaceTrailingQuickAddSegment(props.quickAddModelId, modelId)
      : props.quickAddModelId;
    const nextModelIds = parseQuickAddModelIds(nextValue);
    const dedupedModelIds = nextModelIds.filter((id, index) => {
      const normalizedId = id.toLowerCase();
      return nextModelIds.findIndex((item) => item.toLowerCase() === normalizedId) === index;
    });

    if (dedupedModelIds.length === 0) {
      return;
    }

    const addableModelIds = dedupedModelIds.filter(
      (id) => !props.providerModelIdSet.has(id.toLowerCase())
    );
    if (addableModelIds.length === 0) {
      props.onSetQuickAddError('');
      props.onQuickAddModelIdChange('');
      setHighlightedQuickAddIndex(0);
      setIsQuickAddFocused(false);
      return;
    }

    props.onAddAllVisible(addableModelIds);
    props.onSetQuickAddError('');
    props.onQuickAddModelIdChange('');
    setHighlightedQuickAddIndex(0);
    setIsQuickAddFocused(false);
  };

  return (
    <section className="p-1">
      <div className="overflow-hidden rounded-[28px] border border-zinc-200/85 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.04)]">
        <div className="space-y-4 px-5 py-5">
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
            <div className="flex items-center justify-between gap-3 rounded-[22px] border border-zinc-200/80 bg-white px-4 py-3">
              <div className="min-w-0 text-[14px] font-medium text-zinc-800">Models</div>
              <button
                type="button"
                disabled={!props.canUseConnectionActions || props.isFetchingModels}
                onClick={() => {
                  void props.onFetchModels();
                }}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 text-[12px] font-medium text-emerald-700 shadow-[0_8px_18px_rgba(16,185,129,0.08)] transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {props.isFetchingModels ? (
                  <span className="h-3 w-3 rounded-full border-2 border-zinc-300 border-t-emerald-500 animate-spin" />
                ) : (
                  <Icon name="common.download" size="xs" />
                )}
                {props.isFetchingModels ? 'Fetching...' : 'Fetch'}
              </button>
            </div>
          )}

          {hasFetchedModels ? (
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
              <div className="relative">
                <SettingsTextInput
                  type="text"
                  value={props.quickAddModelId}
                  onFocus={() => {
                    setIsQuickAddFocused(true);
                  }}
                  onBlur={() => setIsQuickAddFocused(false)}
                  onChange={(e) => {
                    setIsQuickAddFocused(true);
                    props.onQuickAddModelIdChange(e.target.value);
                    setHighlightedQuickAddIndex(0);
                    if (props.quickAddError) {
                      props.onSetQuickAddError('');
                    }
                  }}
                onKeyDown={(e) => {
                    if (showQuickAddSuggestions && e.key === 'ArrowDown') {
                      e.preventDefault();
                      setHighlightedQuickAddIndex((current) =>
                        Math.min(current + 1, quickAddSuggestions.length - 1)
                      );
                      return;
                    }

                    if (showQuickAddSuggestions && e.key === 'ArrowUp') {
                      e.preventDefault();
                      setHighlightedQuickAddIndex((current) => Math.max(current - 1, 0));
                      return;
                    }

                    if (showQuickAddSuggestions && e.key === 'Escape') {
                      e.preventDefault();
                      setIsQuickAddFocused(false);
                      return;
                    }

                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (showQuickAddSuggestions) {
                        handleSubmitQuickAdd(quickAddSuggestions[highlightedQuickAddIndex]);
                        return;
                      }
                      handleSubmitQuickAdd();
                  }
                }}
                placeholder="Add a model ID"
              />
                {showQuickAddSuggestions ? (
                  <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 overflow-hidden rounded-[22px] border border-zinc-200/90 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
                    <div className="max-h-64 overflow-y-auto p-1.5">
                      {quickAddSuggestions.map((modelId, index) => (
                        <button
                          key={modelId}
                          ref={(node) => {
                            quickAddItemRefs.current[index] = node;
                          }}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                          }}
                          onClick={() => handleSelectQuickAddSuggestion(modelId)}
                          onMouseEnter={() => setHighlightedQuickAddIndex(index)}
                          className={cn(
                            'flex w-full items-center rounded-[16px] px-3.5 py-2.5 text-left text-[13px] font-medium transition-colors',
                            index === highlightedQuickAddIndex
                              ? 'bg-zinc-100 text-zinc-950'
                              : 'text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950'
                          )}
                        >
                          <span className="truncate">{modelId}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <button
                type="button"
                aria-label="Add models"
                onClick={() => handleSubmitQuickAdd()}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-transparent bg-transparent text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800"
              >
                <Icon name="common.add" size="md" />
              </button>
            </div>
          ) : null}

          {props.quickAddError ? (
            <div className="text-[12px] text-red-500">{props.quickAddError}</div>
          ) : null}
          {props.fetchError ? (
            <div className="text-[12px] text-red-500">{props.fetchError}</div>
          ) : null}

          {hasFetchedModels ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <SectionHeader
                  label="Selected"
                  disabled={!props.canBenchmarkSelected}
                  busy={props.selectedBenchmarkActive}
                  onBenchmark={props.onBenchmarkSelected}
                />
                {selectedModels.length > 0 ? (
                  selectedModels.map((model) => (
                    <ModelRow
                      key={model.id}
                      model={model.apiModelId}
                      selected
                      health={props.healthStatus[model.id]}
                      onClick={() => props.onDeleteModel(model.id)}
                      trailing={null}
                    />
                  ))
                ) : (
                  <div className="rounded-[18px] border border-zinc-200/80 bg-zinc-50/60 px-3.5 py-3 text-[13px] text-zinc-500">
                    No models added yet.
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <SectionHeader
                  label="Available"
                  disabled={!props.canBenchmarkAvailable}
                  busy={props.availableBenchmarkActive}
                  onBenchmark={props.onBenchmarkAvailable}
                />
                {availableModels.length > 0 ? (
                  availableModels.map((modelId) => (
                    <ModelRow
                      key={modelId}
                      model={modelId}
                      health={props.healthStatus[buildScopedModelId(props.providerId, modelId)]}
                      onClick={() => {
                        props.onAddModel(modelId);
                      }}
                      trailing={null}
                    />
                  ))
                ) : (
                  <div className="rounded-[18px] border border-zinc-200/80 bg-zinc-50/60 px-3.5 py-3 text-[13px] text-zinc-500">
                    All fetched models are already selected.
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
