import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { webAccountCommands } from './webAccountCommands';

describe('webAccountCommands', () => {
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
      'nekotick_account_session',
      JSON.stringify({
        provider: 'google',
        username: 'octocat',
        primaryEmail: 'octocat@example.com',
        avatarUrl: 'https://example.com/avatar.png',
      })
    );

    const status = webAccountCommands.getStatus();

    expect(status.connected).toBe(false);
    expect(status.provider).toBe('google');
    expect(status.username).toBe('octocat');
    expect(status.primaryEmail).toBe('octocat@example.com');
  });

  it('probes the cookie session before reporting a connected status', async () => {
    sessionStorage.setItem(
      'nekotick_account_session',
      JSON.stringify({
        provider: 'google',
        username: 'octocat',
        primaryEmail: 'octocat@example.com',
        avatarUrl: 'https://example.com/avatar.png',
      })
    );

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        success: true,
        connected: true,
        provider: 'google',
        username: 'octocat',
        primaryEmail: 'octocat@example.com',
        avatarUrl: 'https://example.com/avatar.png',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const status = await webAccountCommands.probeStatus();

    expect(status.connected).toBe(true);
    expect(status.provider).toBe('google');
    expect(fetchMock).toHaveBeenCalledWith('https://api.nekotick.com/auth/session', {
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
      'nekotick_account_session',
      JSON.stringify({ provider: 'github', username: 'octocat', avatarUrl: 'https://example.com/avatar.png' })
    );
    localStorage.setItem(
      'nekotick_account_identity',
      JSON.stringify({ isConnected: true, username: 'octocat', avatarUrl: 'https://example.com/avatar.png' })
    );

    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 401 });
    vi.stubGlobal('fetch', fetchMock);

    const status = await webAccountCommands.probeStatus();

    expect(status.connected).toBe(false);
    expect(sessionStorage.getItem('nekotick_account_session')).toBeNull();
    expect(localStorage.getItem('nekotick_account_identity')).toBeNull();
  });

  it('revokes the cookie session before clearing client metadata', async () => {
    sessionStorage.setItem(
      'nekotick_account_session',
      JSON.stringify({ provider: 'github', username: 'octocat', avatarUrl: 'https://example.com/avatar.png' })
    );

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);

    await webAccountCommands.disconnect();

    expect(fetchMock).toHaveBeenCalledWith('https://api.nekotick.com/auth/session/revoke', {
      method: 'POST',
      cache: 'no-store',
      credentials: 'include',
    });
    expect(sessionStorage.getItem('nekotick_account_session')).toBeNull();
  });

  it('preserves metadata when revoke fails so logout can be retried', async () => {
    sessionStorage.setItem(
      'nekotick_account_session',
      JSON.stringify({ provider: 'github', username: 'octocat', avatarUrl: 'https://example.com/avatar.png' })
    );

    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal('fetch', fetchMock);

    await expect(webAccountCommands.disconnect()).rejects.toThrow('Failed to revoke session: HTTP 500');
    expect(sessionStorage.getItem('nekotick_account_session')).not.toBeNull();
  });
});
