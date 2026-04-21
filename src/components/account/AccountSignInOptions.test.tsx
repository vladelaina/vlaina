import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hasElectronDesktopBridge } from '@/lib/desktop/backend';
import { AccountEmailCodeCard } from './AccountEmailCodeCard';
import { AccountSignInOptions } from './AccountSignInOptions';

vi.mock('@/lib/desktop/backend', () => ({
  hasElectronDesktopBridge: vi.fn(),
}));

const mockedHasElectronDesktopBridge = vi.mocked(hasElectronDesktopBridge);

function buildProps() {
  return {
    isConnecting: false,
    error: null,
    onOauthSignIn: vi.fn(),
    onEmailCodeRequest: vi.fn().mockResolvedValue(true),
    onEmailCodeVerify: vi.fn().mockResolvedValue(true),
  };
}

describe('AccountSignInOptions', () => {
  beforeEach(() => {
    mockedHasElectronDesktopBridge.mockReset();
    mockedHasElectronDesktopBridge.mockReturnValue(false);
  });

  it('shows OAuth buttons on web', () => {
    render(<AccountSignInOptions {...buildProps()} />);

    expect(screen.getByRole('button', { name: /continue with google/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /continue with github/i })).toBeNull();
    expect(screen.getByRole('button', { name: /continue with email/i })).toBeTruthy();
  });

  it('shows OAuth buttons on desktop and keeps email sign-in available', () => {
    mockedHasElectronDesktopBridge.mockReturnValue(true);

    render(<AccountSignInOptions {...buildProps()} />);

    expect(screen.getByRole('button', { name: /continue with google/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /continue with github/i })).toBeNull();
    expect(screen.getByRole('button', { name: /continue with email/i })).toBeTruthy();
  });

  it('focuses the code input after requesting an email code', async () => {
    const onEmailCodeRequest = vi.fn().mockResolvedValue(true);

    render(
      <AccountEmailCodeCard
        onEmailCodeRequest={onEmailCodeRequest}
        onEmailCodeVerify={vi.fn().mockResolvedValue(true)}
      />
    );

    fireEvent.change(screen.getByPlaceholderText(/email address/i), {
      target: { value: 'user@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /continue with email/i }));

    await waitFor(() => {
      const codeInput = document.querySelector('input[autocomplete="one-time-code"]');
      expect(codeInput).toBeTruthy();
      expect(document.activeElement).toBe(codeInput);
    });
  });
});
