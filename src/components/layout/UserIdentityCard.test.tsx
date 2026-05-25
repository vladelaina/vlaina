import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useManagedAIStore } from '@/stores/useManagedAIStore';
import { useAccountSessionStore } from '@/stores/accountSession';
import { initialAccountSessionState } from '@/stores/accountSession/state';
import { openExternalHref } from '@/lib/navigation/externalLinks';
import { UserIdentityCard } from './UserIdentityCard';

const originalManagedState = useManagedAIStore.getState();

vi.mock('@/lib/navigation/externalLinks', () => ({
  openExternalHref: vi.fn().mockResolvedValue(undefined),
}));

afterEach(() => {
  act(() => {
    useAccountSessionStore.setState(initialAccountSessionState);
    useManagedAIStore.setState(originalManagedState, true);
  });
});

describe('UserIdentityCard', () => {
  it('does not render a membership badge for local signed-out usage', () => {
    render(<UserIdentityCard onLogout={vi.fn()} onSwitchAccount={vi.fn()} />);

    expect(screen.getByText('vlaina')).toBeInTheDocument();
    expect(screen.queryByText('LOCAL')).not.toBeInTheDocument();
  });

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

  it('does not render free membership as a user-card badge or more-menu upgrade option', () => {
    act(() => {
      useAccountSessionStore.setState({
        ...initialAccountSessionState,
        isConnected: true,
        isLoading: false,
        provider: 'google',
        username: 'alice',
        primaryEmail: 'alice@example.com',
        membershipTier: 'free',
        membershipName: 'Free',
      });
    });

    render(<UserIdentityCard onLogout={vi.fn()} onSwitchAccount={vi.fn()} />);

    expect(screen.queryByText('Upgrade ໒꒱')).not.toBeInTheDocument();
    expect(screen.queryByText('Free')).not.toBeInTheDocument();

    act(() => {
      screen.getAllByRole('button')[0]?.click();
    });

    expect(screen.queryByText('Upgrade ໒꒱')).not.toBeInTheDocument();
  });

  it('opens the account plan page when the membership badge is activated', async () => {
    act(() => {
      useAccountSessionStore.setState({
        ...initialAccountSessionState,
        isConnected: true,
        isLoading: false,
        provider: 'google',
        username: 'alice',
        primaryEmail: 'alice@example.com',
        membershipTier: 'pro',
        membershipName: 'Pro',
      });
    });

    render(<UserIdentityCard onLogout={vi.fn()} onSwitchAccount={vi.fn()} />);

    await screen.getByText('Pro').click();

    expect(openExternalHref).toHaveBeenCalledWith('https://vlaina.com/r/account_plan');
  });

  it('renders ultra membership as a loaded membership state', () => {
    act(() => {
      useAccountSessionStore.setState({
        ...initialAccountSessionState,
        isConnected: true,
        provider: 'google',
        username: 'alice',
        primaryEmail: 'alice@example.com',
        membershipTier: 'ultra',
        membershipName: 'Ultra',
      });
    });

    render(<UserIdentityCard onLogout={vi.fn()} onSwitchAccount={vi.fn()} />);

    expect(screen.getByText('Ultra')).toBeInTheDocument();
  });
});
