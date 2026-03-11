import { describe, expect, it } from 'vitest';
import { useGithubSyncStore } from './store';
import { GITHUB_AUTH_INVALIDATED_EVENT } from '@/lib/tauri/webGithubSession';

describe('githubSync store', () => {
  it('clears in-memory auth state when the web session is invalidated', () => {
    useGithubSyncStore.setState({
      isConnected: true,
      username: 'octocat',
      avatarUrl: 'https://example.com/avatar.png',
      localAvatarUrl: 'local-avatar',
      configRepoReady: true,
      isConnecting: true,
      isSyncing: true,
      lastSyncTime: 123,
      syncError: 'oops',
      hasRemoteData: true,
      remoteModifiedTime: '2026-03-11T00:00:00Z',
      isLoading: true,
      syncStatus: 'error',
    });

    window.dispatchEvent(new Event(GITHUB_AUTH_INVALIDATED_EVENT));

    const state = useGithubSyncStore.getState();
    expect(state.isConnected).toBe(false);
    expect(state.username).toBeNull();
    expect(state.avatarUrl).toBeNull();
    expect(state.localAvatarUrl).toBeNull();
    expect(state.configRepoReady).toBe(false);
    expect(state.isConnecting).toBe(false);
    expect(state.isSyncing).toBe(false);
    expect(state.lastSyncTime).toBeNull();
    expect(state.syncError).toBeNull();
    expect(state.hasRemoteData).toBe(false);
    expect(state.remoteModifiedTime).toBeNull();
    expect(state.isLoading).toBe(false);
    expect(state.syncStatus).toBe('idle');
  });
});
