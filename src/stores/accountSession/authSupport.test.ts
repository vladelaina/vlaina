import { beforeEach, describe, expect, it } from 'vitest';
import { ACCOUNT_USER_PERSIST_KEY } from './state';
import { loadPersistedUser, normalizeAuthError } from './authSupport';

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
});
