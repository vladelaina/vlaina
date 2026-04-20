import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { webAccountCommands } from './webCommands';

function mockLocation(url: string) {
  vi.spyOn(window, 'location', 'get').mockReturnValue(new URL(url) as unknown as Location);
}

describe('webAccountCommands', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockLocation('https://app.vlaina.com/');
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('treats cached metadata as disconnected until the cookie session is probed', () => {
    sessionStorage.setItem(
      'vlaina_account_session',
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
      'vlaina_account_session',
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
    expect(fetchMock).toHaveBeenCalledWith('https://api.vlaina.com/auth/session', {
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
      'vlaina_account_session',
      JSON.stringify({ provider: 'github', username: 'octocat', avatarUrl: 'https://example.com/avatar.png' })
    );
    localStorage.setItem(
      'vlaina_account_identity',
      JSON.stringify({ isConnected: true, username: 'octocat', avatarUrl: 'https://example.com/avatar.png' })
    );

    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 401 });
    vi.stubGlobal('fetch', fetchMock);

    const status = await webAccountCommands.probeStatus();

    expect(status.connected).toBe(false);
    expect(sessionStorage.getItem('vlaina_account_session')).toBeNull();
    expect(localStorage.getItem('vlaina_account_identity')).toBeNull();
  });

  it('skips probing the hosted session API on local development origins', async () => {
    mockLocation('http://127.0.0.1:3000/');
    sessionStorage.setItem(
      'vlaina_account_session',
      JSON.stringify({
        provider: 'github',
        username: 'octocat',
        primaryEmail: 'octocat@example.com',
        avatarUrl: 'https://example.com/avatar.png',
      })
    );

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const status = await webAccountCommands.probeStatus();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(status.connected).toBe(false);
    expect(status.provider).toBe('github');
    expect(status.username).toBe('octocat');
  });

  it('rejects OAuth sign-in on local development origins before any network request', async () => {
    mockLocation('http://127.0.0.1:3000/');

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(webAccountCommands.startAuth('google')).rejects.toThrow(
      'Web sign-in is unavailable on local development origins. Use app.vlaina.com or the desktop app.'
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects email sign-in on local development origins before any network request', async () => {
    mockLocation('http://127.0.0.1:3000/');

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(webAccountCommands.requestEmailCode('octocat@example.com')).rejects.toThrow(
      'Web sign-in is unavailable on local development origins. Use app.vlaina.com or the desktop app.'
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('revokes the cookie session before clearing client metadata', async () => {
    sessionStorage.setItem(
      'vlaina_account_session',
      JSON.stringify({ provider: 'github', username: 'octocat', avatarUrl: 'https://example.com/avatar.png' })
    );

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);

    await webAccountCommands.disconnect();

    expect(fetchMock).toHaveBeenCalledWith('https://api.vlaina.com/auth/session/revoke', {
      method: 'POST',
      cache: 'no-store',
      credentials: 'include',
    });
    expect(sessionStorage.getItem('vlaina_account_session')).toBeNull();
  });

  it('preserves metadata when revoke fails so logout can be retried', async () => {
    sessionStorage.setItem(
      'vlaina_account_session',
      JSON.stringify({ provider: 'github', username: 'octocat', avatarUrl: 'https://example.com/avatar.png' })
    );

    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal('fetch', fetchMock);

    await expect(webAccountCommands.disconnect()).rejects.toThrow('Failed to revoke session: HTTP 500');
    expect(sessionStorage.getItem('vlaina_account_session')).not.toBeNull();
  });
});
