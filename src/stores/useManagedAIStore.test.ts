import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchManagedBudget } from '@/lib/ai/managedService';
import { useManagedAIStore } from './useManagedAIStore';

vi.mock('@/lib/ai/managedService', async () => {
  const actual = await vi.importActual<typeof import('@/lib/ai/managedService')>('@/lib/ai/managedService');
  return {
    ...actual,
    fetchManagedBudget: vi.fn(),
    getManagedServiceErrorMessage: vi.fn(() => 'Refresh failed'),
  };
});

const originalState = useManagedAIStore.getState();
const fetchManagedBudgetMock = vi.mocked(fetchManagedBudget);

afterEach(() => {
  fetchManagedBudgetMock.mockReset();
  useManagedAIStore.setState(originalState, true);
});

describe('useManagedAIStore', () => {
  it('keeps the previous budget when refresh fails', async () => {
    const previousBudget = {
      active: true,
      usedPercent: 67,
      remainingPercent: 33,
      status: 'active',
    };

    fetchManagedBudgetMock.mockRejectedValueOnce(new Error('Network error'));
    useManagedAIStore.setState({
      ...originalState,
      budget: previousBudget,
      isRefreshingBudget: false,
      budgetError: null,
      lastBudgetSyncAt: 1_700_000_000_000,
      lastBudgetAttemptAt: 1_700_000_000_000,
    }, true);

    await useManagedAIStore.getState().refreshBudget();

    expect(useManagedAIStore.getState().budget).toBe(previousBudget);
    expect(useManagedAIStore.getState().budgetError).toBe('Refresh failed');
    expect(useManagedAIStore.getState().lastBudgetSyncAt).toBe(1_700_000_000_000);
  });
});
