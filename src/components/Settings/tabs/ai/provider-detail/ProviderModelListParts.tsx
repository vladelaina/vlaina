import type { ComponentProps, ReactNode } from 'react';
import { Icon } from '@/components/ui/icons';
import { SettingsTextInput } from '@/components/Settings/components/SettingsFields';
import { cn } from '@/lib/utils';
import { formatBenchmarkLatency, type HealthStatus } from '../components/ModelListItem';

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

export function SectionHeader({
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
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
        {label}
      </div>
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

export function ModelSearchInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <SettingsTextInput
      type="text"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Filter models..."
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
