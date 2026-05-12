import { describe, expect, it } from 'vitest';
import { useAccountSessionStore } from '../accountSession/store';
import { ACCOUNT_USER_PERSIST_KEY } from '../accountSession/state';
import { ACCOUNT_AUTH_INVALIDATED_EVENT } from '@/lib/account/sessionEvent';

describe('accountSession store', () => {
  it('clears in-memory auth state when the web session is invalidated', () => {
    useAccountSessionStore.setState({
      isConnected: true,
      provider: 'github',
      username: 'octocat',
      primaryEmail: null,
      avatarUrl: 'https://example.com/avatar.png',
      localAvatarUrl: 'local-avatar',
      isConnecting: true,
      isLoading: true,
      error: 'oops',
    });

    window.dispatchEvent(new Event(ACCOUNT_AUTH_INVALIDATED_EVENT));

    const state = useAccountSessionStore.getState();
    expect(state.isConnected).toBe(false);
    expect(state.provider).toBeNull();
    expect(state.username).toBeNull();
    expect(state.avatarUrl).toBeNull();
    expect(state.localAvatarUrl).toBeNull();
    expect(state.isConnecting).toBe(false);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('reloads persisted account identity after a cross-window storage update', () => {
    useAccountSessionStore.setState({
      isConnected: false,
      provider: null,
      username: null,
      primaryEmail: null,
      avatarUrl: null,
      localAvatarUrl: null,
      membershipTier: null,
      membershipName: null,
      isConnecting: false,
      isLoading: false,
      error: null,
    });

    const nextIdentity = JSON.stringify({
      isConnected: true,
      provider: 'google',
      username: 'alice',
      primaryEmail: 'alice@example.com',
      avatarUrl: null,
      membershipTier: 'pro',
      membershipName: 'Pro',
    });

    localStorage.setItem(ACCOUNT_USER_PERSIST_KEY, nextIdentity);

    window.dispatchEvent(new StorageEvent('storage', {
      key: ACCOUNT_USER_PERSIST_KEY,
      newValue: nextIdentity,
    }));

    const state = useAccountSessionStore.getState();
    expect(state.isConnected).toBe(true);
    expect(state.provider).toBe('google');
    expect(state.username).toBe('alice');
    expect(state.primaryEmail).toBe('alice@example.com');
    expect(state.membershipTier).toBe('pro');
    expect(state.membershipName).toBe('Pro');
    expect(typeof state.checkStatus).toBe('function');
    expect(typeof state.signOut).toBe('function');
  });
});
