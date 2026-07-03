import { act, fireEvent, render, screen } from '@testing-library/react';
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

  it('renders the account identity as fitted text instead of an ellipsis-truncated label', () => {
    const longEmail = 'avery.long.email.address.for.layout@example-enterprise-account.com';

    act(() => {
      useAccountSessionStore.setState({
        ...initialAccountSessionState,
        isConnected: true,
        isLoading: false,
        provider: 'email',
        username: 'alice',
        primaryEmail: longEmail,
        membershipTier: null,
        membershipName: null,
      });
    });

    render(<UserIdentityCard onLogout={vi.fn()} onSwitchAccount={vi.fn()} />);

    const identity = screen.getByText(longEmail);
    expect(identity).toHaveClass('whitespace-nowrap');
    expect(identity).not.toHaveClass('truncate');
    expect(identity.parentElement).toHaveAttribute('title', longEmail);
  });

  it('does not put the fallback logo on an avatar surface for email accounts', () => {
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
    });

    render(<UserIdentityCard onLogout={vi.fn()} onSwitchAccount={vi.fn()} />);

    const avatarShell = screen.getByRole('img', { name: 'alice' }).parentElement;
    expect(avatarShell).not.toHaveClass('bg-[var(--vlaina-color-input-surface)]');
    expect(avatarShell).not.toHaveClass('border');
  });

  it('keeps the avatar surface for Google accounts', () => {
    act(() => {
      useAccountSessionStore.setState({
        ...initialAccountSessionState,
        isConnected: true,
        isLoading: false,
        provider: 'google',
        username: 'alice',
        primaryEmail: 'alice@example.com',
        avatarUrl: 'https://lh3.googleusercontent.com/avatar',
        membershipTier: null,
        membershipName: null,
      });
    });

    render(<UserIdentityCard onLogout={vi.fn()} onSwitchAccount={vi.fn()} />);

    const avatarShell = screen.getByRole('img', { name: 'alice' }).parentElement;
    expect(avatarShell).toHaveClass('bg-[var(--vlaina-color-input-surface)]');
    expect(avatarShell).toHaveClass('border');
  });

  it('does not render free membership as a user-card badge', () => {
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

    expect(screen.queryByText('Free')).not.toBeInTheDocument();
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

  it('renders the membership badge as a compact borderless pill', () => {
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

    const badge = screen.getByRole('button', { name: 'Pro' });
    expect(badge.className).not.toMatch(/\bborder\b/);
    expect(badge.className).not.toMatch(/\bshadow/);
    expect(badge).toHaveClass('rounded-[var(--vlaina-radius-pill)]');
    expect(badge).toHaveClass('bg-[var(--vlaina-color-membership-pro-bg)]');
    expect(badge).toHaveClass('[font-size:var(--vlaina-font-10)]');
    expect(badge).toHaveClass('px-2');
    expect(badge).toHaveClass('py-[var(--vlaina-space-3px)]');
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

  it('keeps the account menu entrance snappy', () => {
    const { container } = render(<UserIdentityCard onLogout={vi.fn()} onSwitchAccount={vi.fn()} />);

    fireEvent.click(screen.getAllByRole('button')[0]);

    expect(container.querySelector('.animate-in')).toHaveClass('duration-[var(--vlaina-duration-75)]');
  });
});
