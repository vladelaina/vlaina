import { beforeEach, describe, expect, it, vi } from 'vitest';
import { refreshManagedBudgetIfNeeded } from './helpers';

const mocks = vi.hoisted(() => ({
  isConnected: false,
  refreshBudget: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/stores/accountSession', () => ({
  useAccountSessionStore: {
    getState: () => ({
      isConnected: mocks.isConnected,
    }),
  },
}));

vi.mock('@/stores/useManagedAIStore', () => ({
  useManagedAIStore: {
    getState: () => ({
      refreshBudget: mocks.refreshBudget,
    }),
  },
}));

describe('refreshManagedBudgetIfNeeded', () => {
  beforeEach(() => {
    mocks.isConnected = false;
    mocks.refreshBudget.mockClear();
  });

  it('does not refresh budget for custom providers', () => {
    mocks.isConnected = true;

    refreshManagedBudgetIfNeeded('provider-1');

    expect(mocks.refreshBudget).not.toHaveBeenCalled();
  });

  it('does not refresh budget for managed providers after sign-out', () => {
    mocks.isConnected = false;

    refreshManagedBudgetIfNeeded('vlaina-managed');

    expect(mocks.refreshBudget).not.toHaveBeenCalled();
  });

  it('refreshes budget for managed providers while signed in', () => {
    mocks.isConnected = true;

    refreshManagedBudgetIfNeeded('vlaina-managed');

    expect(mocks.refreshBudget).toHaveBeenCalledTimes(1);
  });
});
