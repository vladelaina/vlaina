import type { ManagedBudgetStatus } from './managedService';

export const MANAGED_QUOTA_EXHAUSTED_STATUS = 'exhausted';
export const MANAGED_QUOTA_BLOCK_MAX_AGE_MS = 60_000;

export function isManagedBudgetExhausted(budget: ManagedBudgetStatus | null | undefined): boolean {
  if (!budget) {
    return false;
  }

  const remainingPercent = typeof budget.remainingPercent === 'number'
    ? budget.remainingPercent
    : Number.NaN;
  return (
    budget.active === false ||
    budget.status === MANAGED_QUOTA_EXHAUSTED_STATUS ||
    (Number.isFinite(remainingPercent) && remainingPercent <= 0)
  );
}

export function createManagedQuotaExhaustedBudgetSnapshot(): ManagedBudgetStatus {
  return {
    active: false,
    usedPercent: 100,
    remainingPercent: 0,
    status: MANAGED_QUOTA_EXHAUSTED_STATUS,
  };
}

export function isRecentManagedBudgetExhausted(
  budget: ManagedBudgetStatus | null | undefined,
  lastBudgetSyncAt: number | null | undefined,
  now = Date.now(),
): boolean {
  if (!budget || !lastBudgetSyncAt || now - lastBudgetSyncAt > MANAGED_QUOTA_BLOCK_MAX_AGE_MS) {
    return false;
  }

  return isManagedBudgetExhausted(budget);
}
