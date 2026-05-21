import electron from 'electron';
import { randomBytes } from 'node:crypto';
import {
  buildDesktopSessionHeaders,
  desktopLegacySessionHeader,
} from './accountSessionAuth.mjs';
import {
  createAccountCredentialStore,
  isSupportedAccountProvider,
} from './accountCredentialStore.mjs';
import { createDesktopAuthPersistence } from './accountAuthPersistence.mjs';
import { bindDesktopAuthLoopbackServer } from './accountLoopbackServer.mjs';
import { createDesktopAccountSessionClient } from './accountSessionClient.mjs';

const { shell } = electron;

function accountErrorResult(message) {
  return {
    success: false,
    provider: null,
    username: null,
    primaryEmail: null,
    avatarUrl: null,
    error: message,
  };
}

function generateDesktopVerifier() {
  return randomBytes(48).toString('base64url');
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function accountNetworkErrorResult(error) {
  return accountErrorResult(`Unable to reach vlaina API: ${getErrorMessage(error)}`);
}

export function createDesktopAccountService({ apiBaseUrl }) {
  let activeOauthFlow = null;

  const {
    readStoredAccountCredentials,
    writeStoredAccountCredentials,
    clearStoredAccountCredentials,
    rotateStoredSessionToken,
  } = createAccountCredentialStore({
    desktopLegacySessionHeader,
  });

  const sessionClient = createDesktopAccountSessionClient({
    apiBaseUrl,
    readStoredAccountCredentials,
    clearStoredAccountCredentials,
    rotateStoredSessionToken,
    writeStoredAccountCredentials,
  });
  const {
    fetchDesktopJson,
    fetchWithStoredSession,
    getDesktopAccountSessionStatus,
    readDesktopSessionIdentity,
    readJsonResponse,
  } = sessionClient;
  const { persistDesktopAuthResult } = createDesktopAuthPersistence({
    readDesktopSessionIdentity,
    writeStoredAccountCredentials,
  });

  function buildDesktopAuthStartUrl(provider) {
    return `${apiBaseUrl}/auth/${provider}/desktop/start`;
  }

  function buildDesktopAuthResultUrl(provider) {
    return `${apiBaseUrl}/auth/${provider}/desktop/result`;
  }

  async function requestDesktopAuthResult(provider, state, verifier, resultToken) {
    const { data } = await fetchDesktopJson(buildDesktopAuthResultUrl(provider), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        state,
        verifier,
        resultToken,
      }),
    });
    return data;
  }

  async function waitForDesktopAuthCompletion(provider, state, verifier, resultToken, expiresInSeconds) {
    const deadline = Date.now() + Math.max(300, Math.min(900, expiresInSeconds ?? 300)) * 1000;
    while (true) {
      const result = await requestDesktopAuthResult(provider, state, verifier, resultToken);
      if (result?.success === true || result?.pending !== true) {
        return result;
      }

      if (Date.now() >= deadline) {
        throw new Error('Authorization timed out');
      }

      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  async function performDesktopOauth(provider) {
    if (!isSupportedAccountProvider(provider) || provider === 'email') {
      return accountErrorResult('Unsupported desktop sign-in provider');
    }
    if (activeOauthFlow) {
      return accountErrorResult('Another sign-in is already in progress');
    }

    const verifier = generateDesktopVerifier();
    const abortController = new AbortController();
    const flow = {
      provider,
      cancelled: false,
      loopback: null,
      abortController,
      cancel(reason = 'Authorization cancelled') {
        this.cancelled = true;
        this.abortController.abort();
        this.loopback?.cancel(reason);
      },
    };
    activeOauthFlow = flow;
    let loopback = null;

    try {
      loopback = await bindDesktopAuthLoopbackServer({
        timeoutSeconds: 300,
      });
      flow.loopback = loopback;

      const { data: authStart } = await fetchDesktopJson(buildDesktopAuthStartUrl(provider), {
        method: 'POST',
        signal: abortController.signal,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          callbackUrl: loopback.callbackUrl,
          verifier,
        }),
      });

      const state = typeof authStart?.state === 'string' ? authStart.state.trim() : '';
      const authUrl = typeof authStart?.authUrl === 'string' ? authStart.authUrl.trim() : '';
      const expiresInSeconds =
        typeof authStart?.expiresInSeconds === 'number' ? authStart.expiresInSeconds : 300;

      if (!authStart?.success || !state || !authUrl) {
        loopback.close();
        return accountErrorResult('Sign-in start response is missing auth URL or state');
      }

      if (flow.cancelled) {
        loopback.close();
        return accountErrorResult('Authorization cancelled');
      }

      await shell.openExternal(authUrl);
      const callback = await loopback.waitForCallback();
      if (flow.cancelled) {
        return accountErrorResult('Authorization cancelled');
      }
      if (callback.state !== state) {
        return accountErrorResult('OAuth state mismatch');
      }
      const result = await waitForDesktopAuthCompletion(
        provider,
        callback.state,
        verifier,
        callback.resultToken,
        expiresInSeconds
      );
      if (flow.cancelled) {
        return accountErrorResult('Authorization cancelled');
      }

      if (!result?.success) {
        return accountErrorResult(callback.error || result?.error || 'Authorization failed');
      }

      const persisted = await persistDesktopAuthResult(provider, result);
      if (flow.cancelled) {
        return accountErrorResult('Authorization cancelled');
      }
      return persisted;
    } catch (error) {
      loopback?.close();
      if (flow.cancelled || error?.name === 'AbortError') {
        return accountErrorResult('Authorization cancelled');
      }
      return accountNetworkErrorResult(error);
    } finally {
      if (activeOauthFlow === flow) {
        activeOauthFlow = null;
      }
    }
  }

  function cancelDesktopOauth() {
    if (!activeOauthFlow) {
      return false;
    }

    activeOauthFlow.cancel('Authorization cancelled');
    return true;
  }

  function registerAccountIpc({ handleIpc }) {
    handleIpc('desktop:account:get-session-status', async () => {
      return await getDesktopAccountSessionStatus();
    });

    handleIpc('desktop:account:start-auth', async (_event, provider) => {
      return await performDesktopOauth(String(provider ?? ''));
    });

    handleIpc('desktop:account:cancel-auth', async () => {
      return cancelDesktopOauth();
    });

    handleIpc('desktop:account:request-email-code', async (_event, email) => {
      const response = await fetch(`${apiBaseUrl}/auth/email/request-code`, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      await readJsonResponse(response, `Failed to send verification code: HTTP ${response.status}`);
      return true;
    });

    handleIpc('desktop:account:verify-email-code', async (_event, email, code) => {
      const { data } = await fetchDesktopJson(`${apiBaseUrl}/auth/email/verify-code`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          code,
          target: 'desktop',
        }),
      });

      if (!data?.success) {
        return accountErrorResult(data?.error || 'Email sign-in failed');
      }

      return await persistDesktopAuthResult('email', data);
    });

    handleIpc('desktop:account:disconnect', async () => {
      const credentials = await readStoredAccountCredentials();
      if (credentials?.appSessionToken) {
        try {
          await fetch(`${apiBaseUrl}/auth/session/revoke`, {
            method: 'POST',
            headers: buildDesktopSessionHeaders(credentials.appSessionToken),
          });
        } catch {
        }
      }

      await clearStoredAccountCredentials();
    });
  }

  return {
    fetchWithStoredSession,
    readJsonResponse,
    registerAccountIpc,
  };
}
