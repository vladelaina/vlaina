import { describe, expect, it } from 'vitest';
import {
  createManagedQuotaExhaustedBudgetSnapshot,
  isManagedBudgetExhausted,
  isRecentManagedBudgetExhausted,
  MANAGED_QUOTA_BLOCK_MAX_AGE_MS,
} from './managedQuota';

describe('managedQuota', () => {
  it('detects exhausted managed budgets from status, active flag, or remaining percent', () => {
    expect(isManagedBudgetExhausted(createManagedQuotaExhaustedBudgetSnapshot())).toBe(true);
    expect(isManagedBudgetExhausted({
      active: true,
      usedPercent: 100,
      remainingPercent: 0,
      status: 'active',
    })).toBe(true);
    expect(isManagedBudgetExhausted({
      active: true,
      usedPercent: 40,
      remainingPercent: 60,
      status: 'active',
    })).toBe(false);
  });

  it('only treats exhausted budgets as blocking while the budget snapshot is recent', () => {
    const now = 1_700_000_000_000;
    const budget = createManagedQuotaExhaustedBudgetSnapshot();

    expect(isRecentManagedBudgetExhausted(budget, now - MANAGED_QUOTA_BLOCK_MAX_AGE_MS + 1, now)).toBe(true);
    expect(isRecentManagedBudgetExhausted(budget, now - MANAGED_QUOTA_BLOCK_MAX_AGE_MS - 1, now)).toBe(false);
    expect(isRecentManagedBudgetExhausted(null, now, now)).toBe(false);
    expect(isRecentManagedBudgetExhausted(budget, null, now)).toBe(false);
  });
});
