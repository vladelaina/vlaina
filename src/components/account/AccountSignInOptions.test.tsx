import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hasBackendCommands } from '@/lib/tauri/invoke';
import { AccountEmailCodeCard } from './AccountEmailCodeCard';
import { AccountSignInOptions } from './AccountSignInOptions';

vi.mock('@/lib/tauri/invoke', () => ({
  hasBackendCommands: vi.fn(),
}));

const mockedHasBackendCommands = vi.mocked(hasBackendCommands);

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
    mockedHasBackendCommands.mockReset();
    mockedHasBackendCommands.mockReturnValue(false);
  });

  it('shows OAuth buttons on web', () => {
    render(<AccountSignInOptions {...buildProps()} />);

    expect(screen.getByRole('button', { name: /continue with google/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /continue with github/i })).toBeNull();
    expect(screen.getByRole('button', { name: /continue with email/i })).toBeTruthy();
  });

  it('shows OAuth buttons on desktop and keeps email sign-in available', () => {
    mockedHasBackendCommands.mockReturnValue(true);

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

    const codeInput = await screen.findByRole('textbox');
    await waitFor(() => {
      expect(document.activeElement).toBe(codeInput);
    });
  });
});
