import { describe, expect, it } from 'vitest';
import { useAccountSessionStore } from '../accountSession/store';
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
});
