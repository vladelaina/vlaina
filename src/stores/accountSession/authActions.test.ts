import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  hasElectronDesktopBridge: vi.fn(),
  accountCommands: {
    getAccountSessionStatus: vi.fn(),
    accountAuth: vi.fn(),
    requestEmailAuthCode: vi.fn(),
    verifyEmailAuthCode: vi.fn(),
    accountDisconnect: vi.fn(),
    cancelAccountAuth: vi.fn(),
    getAuthDebugLog: vi.fn(),
  },
  webAccountCommands: {
    probeStatus: vi.fn(),
    startAuth: vi.fn(),
    requestEmailCode: vi.fn(),
    verifyEmailCode: vi.fn(),
    completeAuth: vi.fn(),
    disconnect: vi.fn(),
    handleAuthCallback: vi.fn(),
  },
  normalizeAccountProvider: vi.fn((value) => value ?? null),
  isOauthAccountProvider: vi.fn((value) => value === 'github' || value === 'google'),
  persistUser: vi.fn(),
  refreshAvatar: vi.fn().mockResolvedValue(undefined),
  clearAuthIntent: vi.fn(() => {
    sessionStorage.removeItem('vlaina_auth_state');
    sessionStorage.removeItem('vlaina_auth_provider');
  }),
  normalizeAuthError: vi.fn((value: string) => `normalized:${value}`),
  applyDisconnectedAccount: vi.fn(),
}));

vi.mock('@/lib/desktop/backend', () => ({
  hasElectronDesktopBridge: mocks.hasElectronDesktopBridge,
}));

vi.mock('@/lib/account/desktopCommands', () => ({
  accountCommands: mocks.accountCommands,
}));

vi.mock('@/lib/account/webCommands', () => ({
  webAccountCommands: mocks.webAccountCommands,
  handleAuthCallback: mocks.webAccountCommands.handleAuthCallback,
}));

vi.mock('@/lib/account/provider', () => ({
  normalizeAccountProvider: mocks.normalizeAccountProvider,
  isOauthAccountProvider: mocks.isOauthAccountProvider,
}));

vi.mock('./authSupport', () => ({
  AUTH_PROVIDER_STORAGE_KEY: 'vlaina_auth_provider',
  AUTH_STATE_STORAGE_KEY: 'vlaina_auth_state',
  persistUser: mocks.persistUser,
  refreshAvatar: mocks.refreshAvatar,
  clearAuthIntent: mocks.clearAuthIntent,
  normalizeAuthError: mocks.normalizeAuthError,
}));

vi.mock('./sessionState', () => ({
  applyDisconnectedAccount: mocks.applyDisconnectedAccount,
}));

import {
  createCheckStatus,
  createHandleAuthCallback,
  createRequestEmailCode,
  createCancelConnect,
  createSignIn,
  createSignOut,
  selectRelevantElectronAuthEntries,
  createVerifyEmailCode,
} from './authActions';

describe('accountSession auth actions', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    Object.values(mocks.accountCommands).forEach((fn) => fn.mockReset());
    Object.values(mocks.webAccountCommands).forEach((fn) => fn.mockReset());
    mocks.hasElectronDesktopBridge.mockReset();
    mocks.normalizeAccountProvider.mockClear();
    mocks.isOauthAccountProvider.mockClear();
    mocks.persistUser.mockClear();
    mocks.refreshAvatar.mockClear();
    mocks.refreshAvatar.mockResolvedValue(undefined);
    mocks.clearAuthIntent.mockClear();
    mocks.normalizeAuthError.mockClear();
    mocks.applyDisconnectedAccount.mockClear();
    vi.stubGlobal('console', {
      ...console,
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('checkStatus persists connected desktop identities and refreshes avatar', async () => {
    mocks.hasElectronDesktopBridge.mockReturnValue(true);
    mocks.accountCommands.getAccountSessionStatus.mockResolvedValue({
      connected: true,
      provider: 'google',
      username: 'vla',
      primaryEmail: 'vla@example.com',
      avatarUrl: 'https://example.com/avatar.png',
      membershipTier: 'pro',
      membershipName: 'Pro',
    });

    const set = vi.fn();
    const get = vi.fn(() => ({ error: 'stale error' }));

    await createCheckStatus(set as never, get as never)();

    expect(set).toHaveBeenNthCalledWith(1, { isLoading: true });
    expect(set).toHaveBeenNthCalledWith(2, {
      isConnected: true,
      provider: 'google',
      username: 'vla',
      primaryEmail: 'vla@example.com',
      avatarUrl: 'https://example.com/avatar.png',
      membershipTier: 'pro',
      membershipName: 'Pro',
      isLoading: false,
      error: null,
    });
    expect(mocks.persistUser).toHaveBeenCalledWith({
      isConnected: true,
      provider: 'google',
      username: 'vla',
      primaryEmail: 'vla@example.com',
      avatarUrl: 'https://example.com/avatar.png',
      membershipTier: 'pro',
      membershipName: 'Pro',
    });
    expect(mocks.refreshAvatar).toHaveBeenCalledWith(
      set,
      get,
      'vla',
      'https://example.com/avatar.png',
    );
  });

  it('checkStatus falls back to disconnected state when probing throws', async () => {
    mocks.hasElectronDesktopBridge.mockReturnValue(false);
    mocks.webAccountCommands.probeStatus.mockRejectedValue(new Error('boom'));

    const set = vi.fn();
    const get = vi.fn(() => ({ error: null }));

    await createCheckStatus(set as never, get as never)();

    expect(mocks.applyDisconnectedAccount).toHaveBeenCalledWith(set);
  });

  it('signIn stores web auth intent and redirects on successful web auth start', async () => {
    mocks.hasElectronDesktopBridge.mockReturnValue(false);
    mocks.webAccountCommands.startAuth.mockResolvedValue({
      authUrl: '#auth-callback-test',
      state: 'state-123',
    });

    const set = vi.fn();
    const get = vi.fn(() => ({ isConnecting: true }));
    const setTimeoutSpy = vi.spyOn(window, 'setTimeout');

    const result = await createSignIn(set as never, get as never)('google');

    expect(result).toBe(true);
    expect(sessionStorage.getItem('vlaina_auth_state')).toBe('state-123');
    expect(sessionStorage.getItem('vlaina_auth_provider')).toBe('google');
    expect(window.location.hash).toBe('#auth-callback-test');
    expect(set).toHaveBeenCalledWith({ isConnecting: true, error: null });
    expect(setTimeoutSpy).toHaveBeenCalled();
  });

  it('signIn normalizes electron auth failures without checking status', async () => {
    mocks.hasElectronDesktopBridge.mockReturnValue(true);
    mocks.accountCommands.accountAuth.mockResolvedValue({
      success: false,
      error: 'missing session token',
    });
    const checkStatus = vi.fn();
    const set = vi.fn();
    const get = vi.fn(() => ({ isConnecting: true, checkStatus }));

    const result = await createSignIn(set as never, get as never)('google');

    expect(result).toBe(false);
    expect(checkStatus).not.toHaveBeenCalled();
    expect(mocks.normalizeAuthError).toHaveBeenCalledWith('missing session token');
    expect(set).toHaveBeenLastCalledWith({
      error: 'normalized:missing session token',
      isConnecting: false,
    });
  });

  it('signIn cancels pending desktop auth when the desktop timeout expires', async () => {
    vi.useFakeTimers();
    mocks.hasElectronDesktopBridge.mockReturnValue(true);
    mocks.accountCommands.accountAuth.mockReturnValue(new Promise(() => undefined));
    mocks.accountCommands.cancelAccountAuth.mockResolvedValue(true);
    const set = vi.fn();
    const get = vi.fn(() => ({ isConnecting: true }));

    void createSignIn(set as never, get as never)('google');
    await vi.advanceTimersByTimeAsync(300000);

    expect(mocks.accountCommands.cancelAccountAuth).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenLastCalledWith({ isConnecting: false, error: null });
  });

  it('requestEmailCode rejects invalid or duplicate emails before any network call', async () => {
    mocks.hasElectronDesktopBridge.mockReturnValue(false);
    const set = vi.fn();
    const get = vi.fn(() => ({
      isConnected: true,
      primaryEmail: 'vla@example.com',
    }));

    await expect(createRequestEmailCode(set as never, get as never)('bad')).resolves.toBe(false);
    await expect(
      createRequestEmailCode(set as never, get as never)('VLA@example.com')
    ).resolves.toBe(false);

    expect(mocks.webAccountCommands.requestEmailCode).not.toHaveBeenCalled();
    expect(set).toHaveBeenNthCalledWith(1, { error: 'Invalid email address' });
    expect(set).toHaveBeenNthCalledWith(2, { error: 'You are already signed in with this email' });
  });

  it('verifyEmailCode checks status on successful desktop verification', async () => {
    mocks.hasElectronDesktopBridge.mockReturnValue(true);
    mocks.accountCommands.verifyEmailAuthCode.mockResolvedValue({ success: true });
    const checkStatus = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn();
    const get = vi.fn(() => ({ checkStatus }));

    const result = await createVerifyEmailCode(set as never, get as never)(
      'vla@example.com',
      '123456',
    );

    expect(result).toBe(true);
    expect(checkStatus).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenLastCalledWith({ isConnecting: false, error: null });
  });

  it('handleAuthCallback rejects mismatched callback state and provider', async () => {
    mocks.hasElectronDesktopBridge.mockReturnValue(false);
    sessionStorage.setItem('vlaina_auth_state', 'expected-state');
    sessionStorage.setItem('vlaina_auth_provider', 'google');
    mocks.webAccountCommands.handleAuthCallback.mockReturnValue({
      provider: 'github',
      state: 'wrong-state',
      error: null,
    });
    const set = vi.fn();
    const get = vi.fn(() => ({ checkStatus: vi.fn() }));

    const result = await createHandleAuthCallback(set as never, get as never)();

    expect(result).toBe(false);
    expect(mocks.clearAuthIntent).toHaveBeenCalledTimes(1);
    expect(mocks.webAccountCommands.completeAuth).not.toHaveBeenCalled();
    expect(set).toHaveBeenLastCalledWith({
      error: 'Account sign-in state mismatch',
      isConnecting: false,
    });
  });

  it('handleAuthCallback completes supported oauth callbacks and refreshes status', async () => {
    mocks.hasElectronDesktopBridge.mockReturnValue(false);
    sessionStorage.setItem('vlaina_auth_state', 'expected-state');
    sessionStorage.setItem('vlaina_auth_provider', 'google');
    mocks.webAccountCommands.handleAuthCallback.mockReturnValue({
      provider: 'google',
      state: 'expected-state',
      error: null,
    });
    mocks.webAccountCommands.completeAuth.mockResolvedValue({
      success: true,
      username: 'vla',
    });
    const checkStatus = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn();
    const get = vi.fn(() => ({ checkStatus }));

    const result = await createHandleAuthCallback(set as never, get as never)();

    expect(result).toBe(true);
    expect(mocks.webAccountCommands.completeAuth).toHaveBeenCalledWith('google', 'expected-state');
    expect(checkStatus).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenLastCalledWith({ isConnecting: false, error: null });
  });

  it('signOut clears pending auth timeout and applies disconnected state after desktop disconnect', async () => {
    mocks.hasElectronDesktopBridge.mockReturnValue(true);
    mocks.accountCommands.accountDisconnect.mockResolvedValue(undefined);
    const timeoutId = window.setTimeout(() => undefined, 1000);
    (window as Window & { __vlaina_auth_timeout?: number | null }).__vlaina_auth_timeout = timeoutId;
    const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');
    const set = vi.fn();

    await createSignOut(set as never, vi.fn() as never)();

    expect(clearTimeoutSpy).toHaveBeenCalledWith(timeoutId);
    expect(mocks.clearAuthIntent).toHaveBeenCalledTimes(1);
    expect(mocks.accountCommands.accountDisconnect).toHaveBeenCalledTimes(1);
    expect(mocks.applyDisconnectedAccount).toHaveBeenCalledWith(set);
  });

  it('cancelConnect clears pending desktop auth in the main process', async () => {
    mocks.hasElectronDesktopBridge.mockReturnValue(true);
    mocks.accountCommands.cancelAccountAuth.mockResolvedValue(true);
    const timeoutId = window.setTimeout(() => undefined, 1000);
    (window as Window & { __vlaina_auth_timeout?: number | null }).__vlaina_auth_timeout = timeoutId;
    sessionStorage.setItem('vlaina_auth_state', 'state');

    const set = vi.fn();
    await createCancelConnect(set as never, vi.fn() as never)();

    expect(mocks.clearAuthIntent).toHaveBeenCalledTimes(1);
    expect(mocks.accountCommands.cancelAccountAuth).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith({ isConnecting: false, error: null });
  });

  it('keeps session retry and identity diagnostics in the filtered electron auth log', () => {
    const entries = [
      { timestamp: '2026-04-22T07:40:28.035Z', event: 'ipc:start_auth', details: null },
      { timestamp: '2026-04-22T07:40:28.100Z', event: 'session_identity:start', details: null },
      { timestamp: '2026-04-22T07:40:28.200Z', event: 'session_identity:http:request', details: null },
      { timestamp: '2026-04-22T07:40:28.300Z', event: 'session_identity:http:response', details: null },
      { timestamp: '2026-04-22T07:40:28.400Z', event: 'session_status:start', details: null },
      { timestamp: '2026-04-22T07:40:28.500Z', event: 'session_status:http:request', details: null },
      { timestamp: '2026-04-22T07:40:28.600Z', event: 'session_status:http:response', details: null },
      { timestamp: '2026-04-22T07:40:28.700Z', event: 'session_status:http:retry_scheduled', details: null },
      { timestamp: '2026-04-22T07:40:28.800Z', event: 'stored_session:http:retry_1:response', details: null },
      { timestamp: '2026-04-22T07:40:28.900Z', event: 'noise:event', details: null },
    ];

    expect(selectRelevantElectronAuthEntries(entries)).toEqual([
      entries[0],
      entries[1],
      entries[2],
      entries[3],
      entries[4],
      entries[5],
      entries[6],
      entries[7],
      entries[8],
    ]);
  });
});
