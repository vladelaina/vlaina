import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const readStoredAccountCredentials = vi.fn();
  const writeStoredAccountCredentials = vi.fn();
  const clearStoredAccountCredentials = vi.fn();
  const rotateStoredSessionToken = vi.fn();
  const fetchDesktopJson = vi.fn();
  const fetchWithStoredSession = vi.fn();
  const getDesktopAccountSessionStatus = vi.fn();
  const readDesktopSessionIdentity = vi.fn();
  const readJsonResponse = vi.fn();
  const persistDesktopAuthResult = vi.fn();
  const bindDesktopAuthLoopbackServer = vi.fn();
  const openExternal = vi.fn();

  return {
    readStoredAccountCredentials,
    writeStoredAccountCredentials,
    clearStoredAccountCredentials,
    rotateStoredSessionToken,
    fetchDesktopJson,
    fetchWithStoredSession,
    getDesktopAccountSessionStatus,
    readDesktopSessionIdentity,
    readJsonResponse,
    persistDesktopAuthResult,
    bindDesktopAuthLoopbackServer,
    openExternal,
  };
});

vi.mock('electron', () => ({
  default: {
    shell: {
      openExternal: mocks.openExternal,
    },
  },
}));

vi.mock('../../electron/accountCredentialStore.mjs', () => ({
  createAccountCredentialStore: vi.fn(() => ({
    readStoredAccountCredentials: mocks.readStoredAccountCredentials,
    writeStoredAccountCredentials: mocks.writeStoredAccountCredentials,
    clearStoredAccountCredentials: mocks.clearStoredAccountCredentials,
    rotateStoredSessionToken: mocks.rotateStoredSessionToken,
  })),
  isSupportedAccountProvider: vi.fn((provider: string) => provider === 'google' || provider === 'email'),
}));

vi.mock('../../electron/accountAuthPersistence.mjs', () => ({
  createDesktopAuthPersistence: vi.fn(() => ({
    persistDesktopAuthResult: mocks.persistDesktopAuthResult,
  })),
}));

vi.mock('../../electron/accountLoopbackServer.mjs', () => ({
  bindDesktopAuthLoopbackServer: mocks.bindDesktopAuthLoopbackServer,
}));

vi.mock('../../electron/accountSessionClient.mjs', () => ({
  createDesktopAccountSessionClient: vi.fn(() => ({
    fetchDesktopJson: mocks.fetchDesktopJson,
    fetchWithStoredSession: mocks.fetchWithStoredSession,
    getDesktopAccountSessionStatus: mocks.getDesktopAccountSessionStatus,
    readDesktopSessionIdentity: mocks.readDesktopSessionIdentity,
    readJsonResponse: mocks.readJsonResponse,
  })),
}));

import { createDesktopAccountService } from '../../electron/accountAuthFlow.mjs';

function registerHarness() {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const service = createDesktopAccountService({ apiBaseUrl: 'https://api.example.com' });
  service.registerAccountIpc({
    handleIpc: (name: string, handler: (...args: unknown[]) => unknown) => {
      handlers.set(name, handler);
    },
  });
  return { handlers };
}

describe('desktop account auth flow', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    for (const mock of Object.values(mocks)) {
      mock.mockReset();
    }
    mocks.openExternal.mockResolvedValue(undefined);
    mocks.persistDesktopAuthResult.mockResolvedValue({
      success: true,
      provider: 'google',
      username: 'alice',
      primaryEmail: 'alice@example.com',
      avatarUrl: null,
      error: null,
    });
  });

  it('stops OAuth result polling when the active flow is cancelled', async () => {
    const { handlers } = registerHarness();
    let resolveCallback!: (value: { state: string; resultToken: string; error: null }) => void;
    const callbackPromise = new Promise<{ state: string; resultToken: string; error: null }>((resolve) => {
      resolveCallback = resolve;
    });
    const loopback = {
      callbackUrl: 'http://127.0.0.1:45000/oauth/callback',
      waitForCallback: vi.fn(() => callbackPromise),
      close: vi.fn(),
      cancel: vi.fn(),
    };
    mocks.bindDesktopAuthLoopbackServer.mockResolvedValue(loopback);

    let resultPolls = 0;
    mocks.fetchDesktopJson.mockImplementation(async (url: string, init: RequestInit) => {
      if (url === 'https://api.example.com/auth/google/desktop/start') {
        return {
          data: {
            success: true,
            state: 'state-1',
            authUrl: 'https://accounts.example.com/oauth',
            expiresInSeconds: 300,
          },
        };
      }

      if (url === 'https://api.example.com/auth/google/desktop/result') {
        resultPolls += 1;
        expect(init.signal).toBeInstanceOf(AbortSignal);
        return {
          data: {
            success: false,
            pending: true,
          },
        };
      }

      throw new Error(`Unexpected URL ${url}`);
    });

    const authPromise = handlers.get('desktop:account:start-auth')?.({}, 'google') as Promise<unknown>;
    await vi.waitFor(() => {
      expect(mocks.openExternal).toHaveBeenCalledWith('https://accounts.example.com/oauth');
    });

    resolveCallback({ state: 'state-1', resultToken: 'result-1', error: null });
    await vi.waitFor(() => {
      expect(resultPolls).toBe(1);
    });

    await expect(handlers.get('desktop:account:cancel-auth')?.({})).resolves.toBe(true);
    await expect(authPromise).resolves.toMatchObject({
      success: false,
      error: 'Authorization cancelled',
    });

    expect(resultPolls).toBe(1);
    expect(loopback.cancel).toHaveBeenCalledWith('Authorization cancelled');
    expect(mocks.persistDesktopAuthResult).not.toHaveBeenCalled();
  });
});
