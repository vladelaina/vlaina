import electron from 'electron';
import { randomBytes } from 'node:crypto';
import { createDesktopAuthLogger, summarizeAuthResultShape } from './accountAuthDebug.mjs';
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
  const { getAuthDebugLog, logDesktopAuth } = createDesktopAuthLogger();

  const {
    readStoredAccountCredentials,
    writeStoredAccountCredentials,
    clearStoredAccountCredentials,
    rotateStoredSessionToken,
  } = createAccountCredentialStore({
    desktopLegacySessionHeader,
    logDesktopAuth,
  });

  const sessionClient = createDesktopAccountSessionClient({
    apiBaseUrl,
    clearStoredAccountCredentials,
    logDesktopAuth,
    readStoredAccountCredentials,
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
    logDesktopAuth,
    readDesktopSessionIdentity,
    readStoredAccountCredentials,
    writeStoredAccountCredentials,
  });

  function buildDesktopAuthStartUrl(provider) {
    return `${apiBaseUrl}/auth/${provider}/desktop/start`;
  }

  function buildDesktopAuthResultUrl(provider) {
    return `${apiBaseUrl}/auth/${provider}/desktop/result`;
  }

  async function requestDesktopAuthResult(provider, state, verifier, resultToken) {
    logDesktopAuth('request_auth_result:start', { provider, state, verifier, resultToken });
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
    logDesktopAuth('request_auth_result:done', { provider, state, resultToken, data });
    logDesktopAuth('request_auth_result:summary', {
      provider,
      state,
      resultToken,
      result: summarizeAuthResultShape(data),
    });
    return data;
  }

  async function waitForDesktopAuthCompletion(provider, state, verifier, resultToken, expiresInSeconds) {
    const deadline = Date.now() + Math.max(300, Math.min(900, expiresInSeconds ?? 300)) * 1000;
    let attempt = 0;

    while (true) {
      attempt += 1;
      const result = await requestDesktopAuthResult(provider, state, verifier, resultToken);
      logDesktopAuth('wait_auth_completion:attempt', {
        attempt,
        provider,
        state,
        resultToken,
        result,
      });
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
    logDesktopAuth('oauth:start', { provider });
    if (!isSupportedAccountProvider(provider) || provider === 'email') {
      return accountErrorResult('Unsupported desktop sign-in provider');
    }

    const verifier = generateDesktopVerifier();
    const loopback = await bindDesktopAuthLoopbackServer({
      logDesktopAuth,
      timeoutSeconds: 300,
    });

    try {
      const { data: authStart } = await fetchDesktopJson(buildDesktopAuthStartUrl(provider), {
        method: 'POST',
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

      logDesktopAuth('oauth:start_response', {
        provider,
        authStart,
        callbackUrl: loopback.callbackUrl,
        verifier,
      });

      if (!authStart?.success || !state || !authUrl) {
        loopback.close();
        return accountErrorResult('Sign-in start response is missing auth URL or state');
      }

      await shell.openExternal(authUrl);
      logDesktopAuth('oauth:browser_opened', { provider, authUrl });
      const callback = await loopback.waitForCallback();
      logDesktopAuth('oauth:callback_resolved', { provider, callback });
      if (callback.state !== state) {
        logDesktopAuth('oauth:state_mismatch', {
          provider,
          expectedState: state,
          receivedState: callback.state,
        });
        return accountErrorResult('OAuth state mismatch');
      }
      const result = await waitForDesktopAuthCompletion(
        provider,
        callback.state,
        verifier,
        callback.resultToken,
        expiresInSeconds
      );

      if (!result?.success) {
        logDesktopAuth('oauth:result_failed', { provider, callback, result });
        return accountErrorResult(callback.error || result?.error || 'Authorization failed');
      }

      const persisted = await persistDesktopAuthResult(provider, result);
      logDesktopAuth('oauth:completed', { provider, persisted });
      return persisted;
    } catch (error) {
      loopback.close();
      logDesktopAuth('oauth:error', {
        provider,
        error: getErrorMessage(error),
      });
      return accountNetworkErrorResult(error);
    }
  }

  function registerAccountIpc({ handleIpc }) {
    handleIpc('desktop:account:get-session-status', async () => {
      logDesktopAuth('ipc:get_session_status');
      return await getDesktopAccountSessionStatus();
    });

    handleIpc('desktop:account:get-auth-debug-log', async () => {
      return getAuthDebugLog();
    });

    handleIpc('desktop:account:start-auth', async (_event, provider) => {
      logDesktopAuth('ipc:start_auth', { provider: String(provider ?? '') });
      return await performDesktopOauth(String(provider ?? ''));
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
