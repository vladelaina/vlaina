import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAccountSessionStore } from '@/stores/accountSession';
import { initialAccountSessionState } from '@/stores/accountSession/state';
import { writeCachedDesktopUpdateInfo } from '@/lib/desktop/updateStatus';
import { AppMenu } from './AppMenu';

afterEach(() => {
  act(() => {
    useAccountSessionStore.setState(initialAccountSessionState);
  });
  localStorage.clear();
});

describe('AppMenu', () => {
  it('renders only the settings option with a visible hover background', () => {
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
    const settingsButton = screen.getByText('Settings').closest('button');

    expect(menuOptions).toEqual(['Settings']);
    expect(settingsButton).toHaveClass(
      'bg-transparent',
      'text-[var(--vlaina-sidebar-chat-text)]',
      'hover:!bg-[var(--vlaina-accent-light)]',
      'hover:text-[var(--vlaina-accent)]',
      'hover:shadow-[var(--vlaina-shadow-menu-hover)]'
    );
  });

  it('opens settings and closes the menu', () => {
    const onOpenSettings = vi.fn();
    const onCloseMenu = vi.fn();

    act(() => {
      useAccountSessionStore.setState({
        ...initialAccountSessionState,
        isConnected: true,
        membershipTier: 'pro',
        membershipName: 'Pro',
      });
    });

    render(<AppMenu onOpenSettings={onOpenSettings} onCloseMenu={onCloseMenu} />);

    act(() => {
      screen.getByText('Settings').click();
    });

    expect(onOpenSettings).toHaveBeenCalledTimes(1);
    expect(onCloseMenu).toHaveBeenCalledTimes(1);
  });

  it('marks the settings option when a cached desktop update is available', () => {
    writeCachedDesktopUpdateInfo({
      currentVersion: '0.1.16',
      latestVersion: '99.99.99',
      updateAvailable: true,
      downloadUrl: 'https://github.com/vladelaina/vlaina/releases/download/v99.99.99/vlaina-99.99.99-linux-x86_64.AppImage',
      releaseUrl: 'https://github.com/vladelaina/vlaina/releases/tag/v99.99.99',
      platformAssetName: 'vlaina-99.99.99-linux-x86_64.AppImage',
      hasPlatformAsset: true,
      releaseNotes: '',
      publishedAt: '2026-06-27T00:00:00.000Z',
    });

    render(<AppMenu onOpenSettings={vi.fn()} onCloseMenu={vi.fn()} />);

    const badgeText = screen.getByText('Update');
    expect(badgeText).toBeInTheDocument();
    expect(badgeText.closest('[data-desktop-update-indicator="badge"]')).not.toBeNull();
  });
});
