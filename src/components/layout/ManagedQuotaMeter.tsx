import { useEffect } from 'react';
import { useManagedAIStore } from '@/stores/useManagedAIStore';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface ManagedQuotaMeterProps {
  className?: string;
}

export function ManagedQuotaMeter({ className }: ManagedQuotaMeterProps) {
  const { t } = useI18n();
  const budget = useManagedAIStore(s => s.budget);
  const isRefreshingBudget = useManagedAIStore(s => s.isRefreshingBudget);
  const budgetError = useManagedAIStore(s => s.budgetError);
  const refreshBudgetIfStale = useManagedAIStore(s => s.refreshBudgetIfStale);

  useEffect(() => {
    void refreshBudgetIfStale();
  }, [refreshBudgetIfStale]);

  const remainingPercent = budget ? Math.max(0, budget.remainingPercent || 0) : null;
  const progressPercent = remainingPercent == null ? 0 : Math.min(100, remainingPercent);
  const progressWidth = `${progressPercent}%`;
  const quotaLabel = remainingPercent == null ? undefined : `${remainingPercent.toFixed(0)}%`;
  const isBudgetPending = remainingPercent == null;

  return (
    <div
      className={cn('group/quota mt-1 flex items-center gap-2', className)}
      aria-label={quotaLabel
        ? t('billing.managedQuotaRemaining', { quota: quotaLabel })
        : t('billing.managedQuotaLoading')}
    >
      <div className="min-w-0 flex-1">
        <div className="h-1.5 overflow-hidden rounded-full bg-[#e9e6df]">
          {isBudgetPending ? (
            <div
              className={cn(
                'h-full w-2/5 animate-pulse rounded-full',
                budgetError && !isRefreshingBudget
                  ? 'bg-[var(--vlaina-border)]'
                  : 'bg-gradient-to-r from-[#bbf7d0] via-[#4ade80] to-[#bbf7d0]'
              )}
              data-testid="managed-quota-loading-bar"
            />
          ) : (
            <div
              className={cn(
                'h-full rounded-full transition-all',
                budgetError ? 'bg-[var(--vlaina-border)]' : 'bg-[#4ade80]'
              )}
              style={{ width: progressWidth }}
            />
          )}
        </div>
      </div>
      {quotaLabel ? (
        <span
          className="w-0 shrink-0 overflow-hidden whitespace-nowrap text-[11px] text-[var(--vlaina-text-tertiary)] opacity-0 transition-[width,opacity] group-hover/quota:w-9 group-hover/quota:opacity-100 group-focus-within/quota:w-9 group-focus-within/quota:opacity-100"
          aria-hidden="true"
        >
          {quotaLabel}
        </span>
      ) : null}
    </div>
  );
}
