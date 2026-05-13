import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearWebAccountCredentials,
  getCachedWebAccountStatus,
  loadWebAccountCredentials,
  saveWebAccountCredentials,
} from './webSession';
import { ACCOUNT_AUTH_INVALIDATED_EVENT } from './sessionEvent';

describe('web account session helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('saves and reloads web account credentials from session storage', () => {
    sessionStorage.clear();

    saveWebAccountCredentials({
      provider: 'github',
      username: 'vla',
      primaryEmail: 'vla@example.com',
      avatarUrl: 'https://example.com/avatar.png',
      membershipTier: 'pro',
      membershipName: 'Pro',
    });

    expect(loadWebAccountCredentials()).toEqual({
      provider: 'github',
      username: 'vla',
      primaryEmail: 'vla@example.com',
      avatarUrl: 'https://example.com/avatar.png',
      membershipTier: 'pro',
      membershipName: 'Pro',
    });
  });

  it('ignores unavailable session storage when saving credentials', () => {
    vi.spyOn(sessionStorage, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    expect(() => saveWebAccountCredentials({
      provider: 'github',
      username: 'vla',
    })).not.toThrow();
  });

  it('clears persisted credentials and dispatches invalidation events', () => {
    sessionStorage.setItem('vlaina_account_session', JSON.stringify({
      provider: 'google',
      username: 'vla',
    }));
    localStorage.setItem('vlaina_account_identity', 'cached');
    const invalidated = vi.fn();
    window.addEventListener(ACCOUNT_AUTH_INVALIDATED_EVENT, invalidated, { once: true });

    clearWebAccountCredentials();

    expect(sessionStorage.getItem('vlaina_account_session')).toBeNull();
    expect(localStorage.getItem('vlaina_account_identity')).toBeNull();
    expect(invalidated).toHaveBeenCalledTimes(1);
  });

  it('exposes cached status as connected until explicit sign-out', () => {
    sessionStorage.setItem('vlaina_account_session', JSON.stringify({
      provider: 'email',
      username: 'vla',
      primaryEmail: 'vla@example.com',
      membershipTier: 'plus',
      membershipName: 'Plus',
    }));

    expect(getCachedWebAccountStatus()).toEqual({
      connected: true,
      provider: 'email',
      username: 'vla',
      primaryEmail: 'vla@example.com',
      avatarUrl: null,
      membershipTier: 'plus',
      membershipName: 'Plus',
    });
  });

  it('falls back to persisted identity when session storage is empty', () => {
    sessionStorage.clear();
    localStorage.setItem('vlaina_account_identity', JSON.stringify({
      isConnected: true,
      provider: 'google',
      username: 'vla',
      primaryEmail: 'vla@example.com',
      avatarUrl: 'https://example.com/avatar.png',
      membershipTier: 'pro',
      membershipName: 'Pro',
    }));

    expect(getCachedWebAccountStatus()).toEqual({
      connected: true,
      provider: 'google',
      username: 'vla',
      primaryEmail: 'vla@example.com',
      avatarUrl: 'https://example.com/avatar.png',
      membershipTier: 'pro',
      membershipName: 'Pro',
    });
  });
});
