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
  it('shows an empty meter and refreshes when budget is missing', async () => {
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

    expect(screen.getByLabelText('Managed AI quota loading')).toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    await waitFor(() => expect(refreshBudgetIfStale).toHaveBeenCalledTimes(1));
  });

  it('keeps native hover text empty and reveals the percentage from the meter on hover', () => {
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

    const meter = screen.getByLabelText('Managed AI quota remaining 42%');
    expect(meter).not.toHaveAttribute('title');
    expect(screen.getByText('42%')).toHaveAttribute('aria-hidden', 'true');
  });

  it('keeps the previous budget visible while a refresh is in flight', () => {
    const refreshBudgetIfStale = vi.fn().mockResolvedValue(undefined);
    act(() => {
      useManagedAIStore.setState({
        ...originalState,
        budget: {
          active: true,
          usedPercent: 67,
          remainingPercent: 33,
          status: 'active',
        },
        isRefreshingBudget: true,
        budgetError: null,
        lastBudgetSyncAt: Date.now() - 120_000,
        lastBudgetAttemptAt: Date.now(),
        refreshBudgetIfStale,
      }, true);
    });

    render(<ManagedQuotaMeter />);

    expect(screen.getByLabelText('Managed AI quota remaining 33%')).not.toHaveAttribute('title');
  });
});
