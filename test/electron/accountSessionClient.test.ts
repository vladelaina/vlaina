import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  default: {
    app: {
      getPath: vi.fn(() => '/tmp/vlaina-account-session-client-test'),
    },
    safeStorage: {
      isEncryptionAvailable: vi.fn(() => false),
    },
  },
}));

import { createDesktopAccountSessionClient } from '../../electron/accountSessionClient.mjs';

const credentials = {
  appSessionToken: 'nts_example',
  provider: 'google',
  username: 'alice',
  primaryEmail: 'alice@example.com',
  avatarUrl: null,
  authenticatedAt: Date.now(),
};

function createHarness(overrides: Partial<Parameters<typeof createDesktopAccountSessionClient>[0]> = {}) {
  const options = {
    apiBaseUrl: 'https://api.example.com',
    readStoredAccountCredentials: vi.fn(async () => credentials),
    clearStoredAccountCredentials: vi.fn(async () => undefined),
    rotateStoredSessionToken: vi.fn(async () => undefined),
    writeStoredAccountCredentials: vi.fn(async () => undefined),
    ...overrides,
  };
  return {
    client: createDesktopAccountSessionClient(options),
    options,
  };
}

describe('desktop account session client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('does not start stored-session requests when already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { client, options } = createHarness();

    await expect(client.fetchWithStoredSession('https://api.example.com/managed', {
      signal: controller.signal,
    })).rejects.toMatchObject({ name: 'AbortError' });

    expect(options.readStoredAccountCredentials).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects stored-session requests promptly when fetch ignores abort', async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn(() => new Promise(() => undefined));
    vi.stubGlobal('fetch', fetchMock);
    const { client, options } = createHarness();

    const request = client.fetchWithStoredSession('https://api.example.com/managed', {
      signal: controller.signal,
    });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    controller.abort();

    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    expect(options.rotateStoredSessionToken).not.toHaveBeenCalled();
  });

  it('rejects optional public requests promptly when fetch ignores abort', async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn(() => new Promise(() => undefined));
    vi.stubGlobal('fetch', fetchMock);
    const { client } = createHarness({
      readStoredAccountCredentials: vi.fn(async () => null),
    });

    const request = client.fetchWithOptionalStoredSession('https://api.example.com/public', {
      signal: controller.signal,
    });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    controller.abort();

    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('prevents request headers from overriding stored session credentials', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { client } = createHarness({
      readStoredAccountCredentials: vi.fn(async () => ({
        ...credentials,
        appSessionToken: 'legacy_session_token',
      })),
    });

    await client.fetchWithStoredSession('https://api.example.com/managed', {
      headers: {
        Authorization: 'Bearer attacker',
        'x-app-session-token': 'attacker',
      },
    });

    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer legacy_session_token');
    expect(headers['x-app-session-token']).toBe('legacy_session_token');
  });

  it('cancels 401 activation retry delays before retrying', async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn(async () => new Response('', { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);
    const { client, options } = createHarness({
      readStoredAccountCredentials: vi.fn(async () => ({
        ...credentials,
        authenticatedAt: Date.now(),
      })),
    });

    const request = client.fetchWithStoredSession('https://api.example.com/managed', {
      signal: controller.signal,
    });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await Promise.resolve();
    controller.abort();

    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(options.rotateStoredSessionToken).not.toHaveBeenCalled();
  });

  it('does not request budget data during desktop session status probes', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      connected: true,
      provider: 'google',
      username: 'alice',
      primaryEmail: 'alice@example.com',
      avatarUrl: null,
      membershipTier: 'pro',
      membershipName: 'Pro',
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { client } = createHarness();

    await expect(client.getDesktopAccountSessionStatus()).resolves.toMatchObject({
      connected: true,
      username: 'alice',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.example.com/auth/session');
  });

  it('uses the injected Electron fetch implementation for session probes', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      connected: true,
      provider: 'google',
      username: 'alice',
      primaryEmail: 'alice@example.com',
      avatarUrl: null,
    }), { status: 200 }));
    const globalFetch = vi.fn();
    vi.stubGlobal('fetch', globalFetch);
    const { client } = createHarness({ fetchImpl });

    await expect(client.getDesktopAccountSessionStatus()).resolves.toMatchObject({
      connected: true,
      username: 'alice',
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(globalFetch).not.toHaveBeenCalled();
  });

  it('normalizes desktop session identity payloads', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      connected: true,
      provider: 'google',
      username: ' alice ',
      primaryEmail: ' alice@example.com ',
      avatarUrl: 'http://127.0.0.1/avatar.png',
      membershipTier: 'pro',
      membershipName: 'P'.repeat(129),
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { client } = createHarness();

    await expect(client.readDesktopSessionIdentity('nts_session')).resolves.toEqual({
      provider: 'google',
      username: 'alice',
      primaryEmail: 'alice@example.com',
      avatarUrl: null,
      membershipTier: 'pro',
      membershipName: null,
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.example.com/auth/session');
  });
});
