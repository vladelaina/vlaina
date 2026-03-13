import { useManagedAIStore } from '@/stores/useManagedAIStore';
import { cn } from '@/lib/utils';

interface ManagedQuotaMeterProps {
  className?: string;
}

export function ManagedQuotaMeter({ className }: ManagedQuotaMeterProps) {
  const { budget } = useManagedAIStore();

  if (!budget) {
    return null;
  }

  const remainingPercent = Math.max(0, Math.min(100, budget.remainingPercent || 0));

  return (
    <div className={cn('mt-1 flex items-center gap-2', className)}>
      <div className="min-w-0 flex-1">
        <div className="h-1.5 overflow-hidden rounded-full bg-[#e9e6df]">
          <div
            className="h-full rounded-full bg-[#4ade80] transition-all"
            style={{ width: `${remainingPercent}%` }}
          />
        </div>
      </div>
      <span className="shrink-0 text-[11px] text-[var(--neko-text-tertiary)]">{`${remainingPercent.toFixed(0)}%`}</span>
    </div>
  );
}
