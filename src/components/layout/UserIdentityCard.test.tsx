import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useManagedAIStore } from '@/stores/useManagedAIStore';
import { useAccountSessionStore } from '@/stores/accountSession';
import { initialAccountSessionState } from '@/stores/accountSession/state';
import { UserIdentityCard } from './UserIdentityCard';

const originalManagedState = useManagedAIStore.getState();

afterEach(() => {
  act(() => {
    useAccountSessionStore.setState(initialAccountSessionState);
    useManagedAIStore.setState(originalManagedState, true);
  });
});

describe('UserIdentityCard', () => {
  it('does not label a connected account as Free while membership is still loading', () => {
    act(() => {
      useAccountSessionStore.setState({
        ...initialAccountSessionState,
        isConnected: true,
        isLoading: true,
        provider: 'google',
        username: 'alice',
        primaryEmail: 'alice@example.com',
        membershipTier: null,
        membershipName: null,
      });
      useManagedAIStore.setState({
        ...originalManagedState,
        budget: null,
        isRefreshingBudget: true,
        budgetError: null,
        refreshBudgetIfStale: vi.fn().mockResolvedValue(undefined),
      }, true);
    });

    render(<UserIdentityCard onLogout={vi.fn()} onSwitchAccount={vi.fn()} />);

    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    expect(screen.queryByText('Free')).not.toBeInTheDocument();
  });

  it('does not label a connected account as Free after membership sync fails', () => {
    act(() => {
      useAccountSessionStore.setState({
        ...initialAccountSessionState,
        isConnected: true,
        isLoading: false,
        provider: 'email',
        username: 'alice',
        primaryEmail: 'alice@example.com',
        membershipTier: null,
        membershipName: null,
      });
      useManagedAIStore.setState({
        ...originalManagedState,
        budget: null,
        isRefreshingBudget: false,
        budgetError: 'fetch failed',
        refreshBudgetIfStale: vi.fn().mockResolvedValue(undefined),
      }, true);
    });

    render(<UserIdentityCard onLogout={vi.fn()} onSwitchAccount={vi.fn()} />);

    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    expect(screen.queryByText('Free')).not.toBeInTheDocument();
  });
});
