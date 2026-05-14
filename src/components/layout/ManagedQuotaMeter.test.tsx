import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useManagedAIStore } from '@/stores/useManagedAIStore';
import { ManagedQuotaMeter } from './ManagedQuotaMeter';

const originalState = useManagedAIStore.getState();

afterEach(() => {
  act(() => {
    useManagedAIStore.setState(originalState, true);
  });
});

describe('ManagedQuotaMeter', () => {
  it('shows a stable placeholder and refreshes when budget is missing', async () => {
    const refreshBudgetIfStale = vi.fn().mockResolvedValue(undefined);
    act(() => {
      useManagedAIStore.setState({
        ...originalState,
        budget: null,
        isRefreshingBudget: true,
        budgetError: null,
        lastBudgetSyncAt: null,
        lastBudgetAttemptAt: null,
        refreshBudgetIfStale,
      }, true);
    });

    render(<ManagedQuotaMeter />);

    expect(screen.getByText('--%')).toBeInTheDocument();
    await waitFor(() => expect(refreshBudgetIfStale).toHaveBeenCalledTimes(1));
  });

  it('renders the current remaining percentage when budget is known', () => {
    const refreshBudgetIfStale = vi.fn().mockResolvedValue(undefined);
    act(() => {
      useManagedAIStore.setState({
        ...originalState,
        budget: {
          active: true,
          usedPercent: 58,
          remainingPercent: 42,
          status: 'active',
        },
        isRefreshingBudget: false,
        budgetError: null,
        lastBudgetSyncAt: Date.now(),
        lastBudgetAttemptAt: Date.now(),
        refreshBudgetIfStale,
      }, true);
    });

    render(<ManagedQuotaMeter />);

    expect(screen.getByText('42%')).toBeInTheDocument();
  });
});
