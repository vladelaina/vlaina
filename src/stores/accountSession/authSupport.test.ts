import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useUIStore } from '@/stores/uiSlice';
import { ACCOUNT_USER_PERSIST_KEY } from './state';
import {
  ACCOUNT_USER_BROADCAST_CHANNEL,
  ACCOUNT_USER_BROADCAST_TYPE,
  AUTH_PROVIDER_STORAGE_KEY,
  AUTH_STATE_STORAGE_KEY,
  ACCOUNT_STATUS_REFRESH_KEY,
  broadcastAccountStatusRefresh,
  clearAuthIntent,
  clearPersistedUser,
  loadPersistedUser,
  normalizeAuthError,
  persistUser,
} from './authSupport';

describe('normalizeAuthError', () => {
  it('maps network failures to a user-facing offline message', () => {
    useUIStore.setState({ languagePreference: 'en' });

    expect(normalizeAuthError('Unable to reach vlaina API: Failed to fetch')).toBe(
      '๑ᵒᯅᵒ๑ Network connection error'
    );
    expect(normalizeAuthError('NetworkError when attempting to fetch resource.')).toBe(
      '๑ᵒᯅᵒ๑ Network connection error'
    );
  });

  it('does not classify secure storage failures as network failures', () => {
    useUIStore.setState({ languagePreference: 'en' });

    expect(normalizeAuthError('System secure storage is unavailable')).toBe(
      '๑ᵒᯅᵒ๑ Unable to save sign-in'
    );
  });

  it('removes Electron IPC noise from email code failures', () => {
    useUIStore.setState({ languagePreference: 'en' });

    expect(
      normalizeAuthError("Error invoking remote method 'desktop:account:verify-email-code': Incorrect verification code")
    ).toBe('๑ᵒᯅᵒ๑ That code is incorrect');
  });

  it('localizes email code failures', () => {
    useUIStore.setState({ languagePreference: 'zh-CN' });

    expect(normalizeAuthError('Incorrect verification code')).toBe('๑ᵒᯅᵒ๑ 验证码错误');
  });
});

describe('loadPersistedUser', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('hydrates the last connected account identity for first paint', () => {
    localStorage.setItem(ACCOUNT_USER_PERSIST_KEY, JSON.stringify({
      isConnected: true,
      provider: 'google',
      username: 'Vlad',
      primaryEmail: 'vlad@example.com',
      avatarUrl: 'https://lh3.googleusercontent.com/avatar',
      membershipTier: 'pro',
      membershipName: 'Pro',
    }));

    expect(loadPersistedUser()).toEqual({
      isConnected: true,
      provider: 'google',
      username: 'Vlad',
      primaryEmail: 'vlad@example.com',
      avatarUrl: 'https://lh3.googleusercontent.com/avatar',
      membershipTier: 'pro',
      membershipName: 'Pro',
    });
  });

  it('ignores unavailable localStorage when persisting account identity', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });

    expect(() => persistUser({
      isConnected: true,
      provider: 'google',
      username: 'vla',
      primaryEmail: null,
      avatarUrl: null,
      membershipTier: 'free',
      membershipName: 'Free',
    })).not.toThrow();
  });

  it('broadcasts persisted account identity for other windows', () => {
    const postMessage = vi.fn();
    const close = vi.fn();
    const BroadcastChannelMock = vi.fn(function BroadcastChannel(this: { postMessage: typeof postMessage; close: typeof close }, name: string) {
      expect(name).toBe(ACCOUNT_USER_BROADCAST_CHANNEL);
      this.postMessage = postMessage;
      this.close = close;
    });
    vi.stubGlobal('BroadcastChannel', BroadcastChannelMock);

    const identity = {
      isConnected: true,
      provider: 'google' as const,
      username: 'vla',
      primaryEmail: 'vla@example.com',
      avatarUrl: null,
      membershipTier: 'pro' as const,
      membershipName: 'Pro',
    };

    persistUser(identity);

    expect(postMessage).toHaveBeenCalledWith({
      type: ACCOUNT_USER_BROADCAST_TYPE,
      identity,
    });
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('clears persisted account identity when temporary desktop auth is used', () => {
    localStorage.setItem(ACCOUNT_USER_PERSIST_KEY, JSON.stringify({
      isConnected: true,
      provider: 'google',
      username: 'vla',
    }));

    clearPersistedUser();

    expect(localStorage.getItem(ACCOUNT_USER_PERSIST_KEY)).toBeNull();
  });

  it('broadcasts account status refresh without persisting account identity', () => {
    broadcastAccountStatusRefresh();

    expect(localStorage.getItem(ACCOUNT_STATUS_REFRESH_KEY)).toBeNull();
    expect(localStorage.getItem(ACCOUNT_USER_PERSIST_KEY)).toBeNull();
  });

  it('ignores unavailable sessionStorage when clearing auth intent', () => {
    sessionStorage.setItem(AUTH_STATE_STORAGE_KEY, 'state');
    sessionStorage.setItem(AUTH_PROVIDER_STORAGE_KEY, 'google');
    vi.spyOn(sessionStorage, 'removeItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    expect(() => clearAuthIntent()).not.toThrow();
  });
});
