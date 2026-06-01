import { useEffect } from 'react';
import { useManagedAIStore } from '@/stores/useManagedAIStore';
import { useAccountSessionStore } from '@/stores/accountSession';
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
  const accountIsConnected = useAccountSessionStore(s => s.isConnected);
  const accountIsLoading = useAccountSessionStore(s => s.isLoading);
  const accountHasCheckedStatus = useAccountSessionStore(s => s.hasCheckedStatus);

  useEffect(() => {
    if (!accountIsConnected || accountIsLoading || !accountHasCheckedStatus) {
      return;
    }
    void refreshBudgetIfStale();
  }, [accountHasCheckedStatus, accountIsConnected, accountIsLoading, budget, budgetError, isRefreshingBudget, refreshBudgetIfStale]);

  const rawRemainingPercent = budget ? Number(budget.remainingPercent) : Number.NaN;
  const remainingPercent = Number.isFinite(rawRemainingPercent) ? Math.max(0, rawRemainingPercent) : null;
  const progressPercent = remainingPercent == null ? 0 : Math.min(100, remainingPercent);
  const progressWidth = `${progressPercent}%`;

  if (remainingPercent == null) {
    return null;
  }

  const quotaLabel = `${remainingPercent.toFixed(0)}%`;

  return (
    <div
      className={cn('group/quota mt-1 flex items-center gap-2', className)}
      aria-label={t('billing.managedQuotaRemaining', { quota: quotaLabel })}
    >
      <div className="min-w-0 flex-1">
        <div className="h-1.5 overflow-hidden rounded-full bg-[var(--vlaina-color-quota-track)]">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              budgetError && !isRefreshingBudget ? 'bg-[var(--vlaina-border)]' : 'bg-[var(--vlaina-color-success)]'
            )}
            style={{ width: progressWidth }}
          />
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
