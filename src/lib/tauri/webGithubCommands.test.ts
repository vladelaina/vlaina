import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { webGithubCommands } from './webGithubCommands';

describe('webGithubCommands', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('treats cached metadata as disconnected until the cookie session is probed', () => {
    sessionStorage.setItem(
      'nekotick_github_creds',
      JSON.stringify({ username: 'octocat', avatarUrl: 'https://example.com/avatar.png' })
    );

    const status = webGithubCommands.getStatus();

    expect(status.connected).toBe(false);
    expect(status.username).toBe('octocat');
  });

  it('probes the cookie session before reporting a connected status', async () => {
    sessionStorage.setItem(
      'nekotick_github_creds',
      JSON.stringify({ username: 'octocat', avatarUrl: 'https://example.com/avatar.png' })
    );

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);

    const status = await webGithubCommands.probeStatus();

    expect(status.connected).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith('https://api.nekotick.com/v1/models', {
      method: 'GET',
      cache: 'no-store',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
    });
  });

  it('clears metadata when the cookie session is unauthorized', async () => {
    sessionStorage.setItem(
      'nekotick_github_creds',
      JSON.stringify({ username: 'octocat', avatarUrl: 'https://example.com/avatar.png' })
    );
    localStorage.setItem(
      'nekotick_github_user_identity',
      JSON.stringify({ isConnected: true, username: 'octocat', avatarUrl: 'https://example.com/avatar.png' })
    );

    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 401 });
    vi.stubGlobal('fetch', fetchMock);

    const status = await webGithubCommands.probeStatus();

    expect(status.connected).toBe(false);
    expect(sessionStorage.getItem('nekotick_github_creds')).toBeNull();
    expect(localStorage.getItem('nekotick_github_user_identity')).toBeNull();
  });

  it('revokes the cookie session before clearing client metadata', async () => {
    sessionStorage.setItem(
      'nekotick_github_creds',
      JSON.stringify({ username: 'octocat', avatarUrl: 'https://example.com/avatar.png' })
    );

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);

    await webGithubCommands.disconnect();

    expect(fetchMock).toHaveBeenCalledWith('https://api.nekotick.com/auth/session/revoke', {
      method: 'POST',
      cache: 'no-store',
      credentials: 'include',
    });
    expect(sessionStorage.getItem('nekotick_github_creds')).toBeNull();
  });

  it('preserves metadata when revoke fails so logout can be retried', async () => {
    sessionStorage.setItem(
      'nekotick_github_creds',
      JSON.stringify({ username: 'octocat', avatarUrl: 'https://example.com/avatar.png' })
    );

    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal('fetch', fetchMock);

    await expect(webGithubCommands.disconnect()).rejects.toThrow('Failed to revoke session: HTTP 500');
    expect(sessionStorage.getItem('nekotick_github_creds')).not.toBeNull();
  });
});
