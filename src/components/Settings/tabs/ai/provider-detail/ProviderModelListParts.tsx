import type { ComponentProps, ReactNode } from 'react';
import { Icon } from '@/components/ui/icons';
import { SettingsTextInput } from '@/components/Settings/components/SettingsFields';
import { cn } from '@/lib/utils';
import { formatBenchmarkLatency, type HealthStatus } from '../components/ModelListItem';
import { useI18n } from '@/lib/i18n';
import { getModelPresentationName } from '@/components/Chat/features/Input/modelFamilyRegistry';

const SLOW_BENCHMARK_LATENCY_MS = 5000;

export const QUICK_ADD_SPLIT_PATTERN = /[,\uFF0C]+/;

export function compareHealthStatus(left?: HealthStatus, right?: HealthStatus) {
  const score = (health?: HealthStatus) => {
    if (!health) return 3;
    if (health.status === 'success') return 0;
    if (health.status === 'loading') return 1;
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

export function parseQuickAddModelIds(value: string) {
  return value
    .split(QUICK_ADD_SPLIT_PATTERN)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function replaceTrailingQuickAddSegment(value: string, nextSegment: string) {
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

export function ActionButton({
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
        'inline-flex items-center justify-center gap-1.5 rounded-full border border-transparent text-[12px] font-semibold transition-all duration-200',
        compact ? 'h-8 px-3' : 'h-9 px-4',
        muted
          ? 'bg-white text-[var(--notes-sidebar-text-soft)] hover:bg-zinc-50 hover:text-[var(--notes-sidebar-text)] disabled:cursor-not-allowed disabled:opacity-50'
          : 'bg-[var(--sidebar-row-selected-bg)] text-[var(--sidebar-row-selected-text)] hover:bg-[var(--sidebar-row-selected-bg)]/80 disabled:cursor-not-allowed disabled:opacity-50'
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

export function SectionHeader({
  label,
  disabled,
  busy,
  onBenchmark,
  actionLabel,
  actionDisabled = false,
  onAction,
}: {
  label: string;
  disabled: boolean;
  busy: boolean;
  onBenchmark: () => void | Promise<void>;
  actionLabel?: string;
  actionDisabled?: boolean;
  onAction?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 px-1">
      <div className="flex items-center gap-2">
      <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--notes-sidebar-text-soft)]">
        {label}
      </div>
      <button
        type="button"
        disabled={disabled && !busy}
        onClick={() => {
          void onBenchmark();
        }}
        className="flex h-5 w-5 items-center justify-center rounded-full text-[var(--notes-sidebar-text-soft)] transition-colors hover:bg-zinc-100 hover:text-[var(--notes-sidebar-text)] disabled:cursor-not-allowed disabled:opacity-35"
      >
        {busy ? (
          <div className="h-3 w-3 rounded-full border-2 border-zinc-300 border-t-emerald-500 animate-spin" />
        ) : (
          <Icon name="misc.activity" size="xs" />
        )}
      </button>
      </div>
      {actionLabel && onAction ? (
        <button
          type="button"
          disabled={actionDisabled}
          onClick={onAction}
          className="h-6 rounded-full px-2.5 text-[11px] font-bold text-[var(--sidebar-row-selected-text)] transition-colors hover:bg-[var(--sidebar-row-selected-bg)] disabled:cursor-not-allowed disabled:opacity-35"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

export function ModelRow({
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
    'flex items-center gap-3 rounded-[20px] border border-transparent px-4 py-3 text-left transition-all duration-200',
    selected && tone === 'neutral' && 'bg-zinc-50/70 text-[var(--notes-sidebar-text)]',
    selected && tone === 'success' && 'bg-emerald-50 text-[var(--notes-sidebar-text)]',
    selected && tone === 'warning' && 'bg-amber-50 text-[var(--notes-sidebar-text)]',
    selected && tone === 'error' && 'bg-red-50 text-[var(--notes-sidebar-text)]',
    selected && tone === 'loading' && 'bg-zinc-50/70 text-[var(--notes-sidebar-text)]',
    !selected && tone === 'neutral' && 'bg-zinc-100/40 text-[var(--notes-sidebar-text)] hover:bg-zinc-100/60',
    !selected && tone === 'success' && 'bg-emerald-50/40 text-[var(--notes-sidebar-text)] hover:bg-emerald-50/60',
    !selected && tone === 'warning' && 'bg-amber-50/40 text-[var(--notes-sidebar-text)] hover:bg-amber-50/60',
    !selected && tone === 'error' && 'bg-red-50/40 text-[var(--notes-sidebar-text)] hover:bg-red-50/60',
    !selected && tone === 'loading' && 'bg-zinc-100/40 text-[var(--notes-sidebar-text)]',
    onClick && 'cursor-pointer'
  );

  const content = (
    <>
      <div className="min-w-0 flex-1 truncate text-[14px] font-semibold">{getModelPresentationName({ name: model, apiModelId: model })}</div>
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

export function ModelSearchInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useI18n();

  return (
    <SettingsTextInput
      type="text"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={t('settings.ai.filterModels')}
      leading={<Icon name="common.search" size="sm" className="text-zinc-400" />}
      trailing={value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
        >
          <Icon name="common.close" size="sm" />
        </button>
      ) : null}
    />
  );
}

function HealthBadge({ health }: { health?: HealthStatus }) {
  if (!health) return null;

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
        {formatBenchmarkLatency(health.latency)}
      </span>
    );
  }

  return (
    <span className="rounded-full bg-red-100 px-2 py-1 text-[10px] font-medium text-red-700" title={health.error}>
      Failed
    </span>
  );
}

function getHealthTone(health?: HealthStatus): 'neutral' | 'success' | 'warning' | 'error' | 'loading' {
  if (!health) return 'neutral';
  if (health.status === 'loading') return 'loading';
  if (health.status === 'error') return 'error';
  return typeof health.latency === 'number' && health.latency >= SLOW_BENCHMARK_LATENCY_MS
    ? 'warning'
    : 'success';
}
