import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACCOUNT_USER_PERSIST_KEY } from './state';
import {
  AUTH_PROVIDER_STORAGE_KEY,
  AUTH_STATE_STORAGE_KEY,
  clearAuthIntent,
  loadPersistedUser,
  normalizeAuthError,
  persistUser,
} from './authSupport';

describe('normalizeAuthError', () => {
  it('maps network failures to a user-facing offline message', () => {
    expect(normalizeAuthError('Unable to reach vlaina API: Failed to fetch')).toBe(
      'No internet connection. Please check your network and try again.'
    );
    expect(normalizeAuthError('NetworkError when attempting to fetch resource.')).toBe(
      'No internet connection. Please check your network and try again.'
    );
  });
});

describe('loadPersistedUser', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

  it('ignores unavailable sessionStorage when clearing auth intent', () => {
    sessionStorage.setItem(AUTH_STATE_STORAGE_KEY, 'state');
    sessionStorage.setItem(AUTH_PROVIDER_STORAGE_KEY, 'google');
    vi.spyOn(sessionStorage, 'removeItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    expect(() => clearAuthIntent()).not.toThrow();
  });
});
