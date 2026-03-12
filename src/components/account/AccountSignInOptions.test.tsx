import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hasBackendCommands } from '@/lib/tauri/invoke';
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
    expect(screen.getByRole('button', { name: /continue with github/i })).toBeTruthy();
    expect(screen.getByText(/sign in with email code/i)).toBeTruthy();
  });

  it('shows OAuth buttons on desktop and keeps email sign-in available', () => {
    mockedHasBackendCommands.mockReturnValue(true);

    render(<AccountSignInOptions {...buildProps()} />);

    expect(screen.getByRole('button', { name: /continue with google/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /continue with github/i })).toBeTruthy();
    expect(screen.getByText(/sign in with email code/i)).toBeTruthy();
    expect(
      screen.getByText(/desktop sign-in now uses a secure browser redirect back to the app/i)
    ).toBeTruthy();
  });
});
