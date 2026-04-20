import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VaultWelcome } from './VaultWelcome';

const mocks = vi.hoisted(() => ({
  vaultState: {
    initialize: vi.fn().mockResolvedValue(undefined),
    recentVaults: [
      { id: 'vault-1', name: 'Alpha Vault', path: '/vaults/alpha' },
    ],
    openVault: vi.fn().mockResolvedValue(true),
    isLoading: false,
  },
  windowState: {
    setResizable: vi.fn().mockResolvedValue(undefined),
    setSize: vi.fn().mockResolvedValue(undefined),
    center: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/stores/useVaultStore', () => ({
  useVaultStore: () => mocks.vaultState,
}));

vi.mock('@/lib/desktop/window', () => ({
  desktopWindow: mocks.windowState,
}));

vi.mock('@/components/ui/icons', () => ({
  Icon: () => <span data-testid="icon" />,
}));

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('VaultWelcome', () => {
  beforeEach(() => {
    mocks.vaultState.initialize.mockClear();
    mocks.vaultState.openVault.mockClear();
    mocks.windowState.setResizable.mockClear();
    mocks.windowState.setSize.mockClear();
    mocks.windowState.center.mockClear();
    mocks.vaultState.recentVaults = [{ id: 'vault-1', name: 'Alpha Vault', path: '/vaults/alpha' }];
    mocks.vaultState.isLoading = false;
  });

  it('initializes, locks the window, and opens a recent vault', async () => {
    render(<VaultWelcome />);

    await waitFor(() => {
      expect(mocks.vaultState.initialize).toHaveBeenCalledTimes(1);
      expect(mocks.windowState.setResizable).toHaveBeenCalledWith(false);
      expect(mocks.windowState.setSize).toHaveBeenCalledWith({ width: 980, height: 640 });
      expect(mocks.windowState.center).toHaveBeenCalledTimes(1);
    });

    const vaultButton = await screen.findByRole('button', { name: /alpha vault/i });
    fireEvent.click(vaultButton);

    await waitFor(() => {
      expect(mocks.vaultState.openVault).toHaveBeenCalledWith('/vaults/alpha');
    });
  });

  it('unlocks the window again on unmount', async () => {
    const view = render(<VaultWelcome />);

    await waitFor(() => {
      expect(mocks.windowState.setResizable).toHaveBeenCalledWith(false);
    });

    await act(async () => {
      view.unmount();
    });

    await waitFor(() => {
      expect(mocks.windowState.setResizable).toHaveBeenCalledWith(true);
      expect(mocks.windowState.setSize).toHaveBeenLastCalledWith({ width: 980, height: 640 });
      expect(mocks.windowState.center).toHaveBeenCalledTimes(2);
    });
  });
});
