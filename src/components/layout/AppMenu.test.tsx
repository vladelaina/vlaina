import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAccountSessionStore } from '@/stores/accountSession';
import { initialAccountSessionState } from '@/stores/accountSession/state';
import { openExternalHref } from '@/lib/navigation/externalLinks';
import { AppMenu } from './AppMenu';

vi.mock('@/lib/navigation/externalLinks', () => ({
  openExternalHref: vi.fn().mockResolvedValue(undefined),
}));

afterEach(() => {
  act(() => {
    useAccountSessionStore.setState(initialAccountSessionState);
  });
});

describe('AppMenu', () => {
  it('renders the free membership upgrade option above settings', () => {
    const onCloseMenu = vi.fn();

    act(() => {
      useAccountSessionStore.setState({
        ...initialAccountSessionState,
        isConnected: true,
        membershipTier: 'free',
        membershipName: 'Free',
      });
    });

    render(<AppMenu onOpenSettings={vi.fn()} onCloseMenu={onCloseMenu} />);

    const menuOptions = screen.getAllByRole('button').map((button) => button.textContent);
    const upgradeButton = screen.getByText('Upgrade ໒꒱').closest('button');

    expect(menuOptions).toEqual(['Upgrade ໒꒱', 'Settings']);
    expect(upgradeButton).toHaveClass(
      'bg-transparent',
      'text-[var(--chat-sidebar-text)]',
      'hover:bg-[var(--vlaina-accent-light)]',
      'hover:text-[var(--vlaina-accent)]'
    );

    act(() => {
      screen.getByText('Upgrade ໒꒱').click();
    });

    expect(onCloseMenu).toHaveBeenCalled();
    expect(openExternalHref).toHaveBeenCalledWith('https://vlaina.com/r/account_plan');
  });

  it('does not render upgrade for paid memberships', () => {
    act(() => {
      useAccountSessionStore.setState({
        ...initialAccountSessionState,
        isConnected: true,
        membershipTier: 'pro',
        membershipName: 'Pro',
      });
    });

    render(<AppMenu onOpenSettings={vi.fn()} onCloseMenu={vi.fn()} />);

    expect(screen.queryByText('Upgrade ໒꒱')).not.toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });
});
