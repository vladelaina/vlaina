import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { webAccountCommands } from './webCommands';

function mockLocation(url: string) {
  vi.spyOn(window, 'location', 'get').mockReturnValue(new URL(url) as unknown as Location);
}

describe('webAccountCommands', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockLocation('https://vlaina.com/pricing');
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('treats cached metadata as connected until explicit sign-out', () => {
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

    expect(status.connected).toBe(true);
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
    expect(fetchMock).toHaveBeenCalledWith('https://api.vlaina.com/auth/session?include_budget=1', {
      method: 'GET',
      cache: 'no-store',
      credentials: 'include',
      signal: expect.any(AbortSignal),
      headers: {
        Accept: 'application/json',
      },
    });
  });

  it('preserves metadata when the cookie session is unauthorized', async () => {
    sessionStorage.setItem(
      'vlaina_account_session',
      JSON.stringify({ provider: 'google', username: 'octocat', avatarUrl: 'https://example.com/avatar.png' })
    );
    localStorage.setItem(
      'vlaina_account_identity',
      JSON.stringify({ isConnected: true, username: 'octocat', avatarUrl: 'https://example.com/avatar.png' })
    );

    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 401 });
    vi.stubGlobal('fetch', fetchMock);

    const status = await webAccountCommands.probeStatus();

    expect(status.connected).toBe(true);
    expect(status.provider).toBe('google');
    expect(status.username).toBe('octocat');
    expect(sessionStorage.getItem('vlaina_account_session')).not.toBeNull();
    expect(localStorage.getItem('vlaina_account_identity')).not.toBeNull();
  });

  it('skips probing the hosted session API on local development origins', async () => {
    mockLocation('http://127.0.0.1:3000/');
    sessionStorage.setItem(
      'vlaina_account_session',
      JSON.stringify({
        provider: 'google',
        username: 'octocat',
        primaryEmail: 'octocat@example.com',
        avatarUrl: 'https://example.com/avatar.png',
      })
    );

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const status = await webAccountCommands.probeStatus();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(status.connected).toBe(true);
    expect(status.provider).toBe('google');
    expect(status.username).toBe('octocat');
  });

  it('rejects OAuth sign-in on local development origins before any network request', async () => {
    mockLocation('http://127.0.0.1:3000/');

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(webAccountCommands.startAuth('google')).rejects.toThrow(
      'Web sign-in is unavailable on local development origins. Use vlaina.com/pricing or the desktop app.'
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects email sign-in on local development origins before any network request', async () => {
    mockLocation('http://127.0.0.1:3000/');

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(webAccountCommands.requestEmailCode('octocat@example.com')).rejects.toThrow(
      'Web sign-in is unavailable on local development origins. Use vlaina.com/pricing or the desktop app.'
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('retries transient email-code network failures before surfacing an error', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);

    const request = webAccountCommands.requestEmailCode('octocat@example.com');
    await vi.advanceTimersByTimeAsync(1000);

    await expect(request).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry email-code business errors', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: vi.fn().mockResolvedValue({ error: 'Invalid email address' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(webAccountCommands.requestEmailCode('octocat@example.com')).rejects.toThrow('Invalid email address');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('revokes the cookie session before clearing client metadata', async () => {
    sessionStorage.setItem(
      'vlaina_account_session',
      JSON.stringify({ provider: 'google', username: 'octocat', avatarUrl: 'https://example.com/avatar.png' })
    );

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);

    await webAccountCommands.disconnect();

    expect(fetchMock).toHaveBeenCalledWith('https://api.vlaina.com/auth/session/revoke', {
      method: 'POST',
      cache: 'no-store',
      credentials: 'include',
      signal: expect.any(AbortSignal),
    });
    expect(sessionStorage.getItem('vlaina_account_session')).toBeNull();
  });

  it('times out account requests when fetch ignores cancellation', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(() => new Promise(() => undefined));
    vi.stubGlobal('fetch', fetchMock);

    const request = webAccountCommands.requestEmailCode('octocat@example.com');
    const expectation = expect(request).rejects.toThrow('Account API request timed out.');
    await vi.advanceTimersByTimeAsync(15_000);

    await expectation;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns cached status when session JSON parsing times out', async () => {
    vi.useFakeTimers();
    sessionStorage.setItem(
      'vlaina_account_session',
      JSON.stringify({ provider: 'google', username: 'octocat', avatarUrl: 'https://example.com/avatar.png' })
    );
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn(() => new Promise(() => undefined)),
    });
    vi.stubGlobal('fetch', fetchMock);

    const request = webAccountCommands.probeStatus();
    await vi.advanceTimersByTimeAsync(15_000);
    const status = await request;

    expect(status.connected).toBe(true);
    expect(status.username).toBe('octocat');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('preserves metadata when revoke fails so logout can be retried', async () => {
    sessionStorage.setItem(
      'vlaina_account_session',
      JSON.stringify({ provider: 'google', username: 'octocat', avatarUrl: 'https://example.com/avatar.png' })
    );

    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal('fetch', fetchMock);

    await expect(webAccountCommands.disconnect()).rejects.toThrow('Failed to revoke session: HTTP 500');
    expect(sessionStorage.getItem('vlaina_account_session')).not.toBeNull();
  });
});
