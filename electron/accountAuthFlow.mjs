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
const accountNetworkRetryDelaysMs = [250, 750];
const accountRequestTimeoutMs = 15_000;

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

function createAbortError() {
  return new DOMException('Aborted', 'AbortError');
}

function createAccountTimeoutError() {
  return new Error('Account API request timed out.');
}

function throwIfAborted(signal) {
  if (!signal?.aborted) return;
  throw createAbortError();
}

async function raceWithAbort(promise, signal) {
  throwIfAborted(signal);
  if (!signal) {
    return await promise;
  }
  promise.catch(() => undefined);

  return await new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      signal.removeEventListener('abort', abort);
    };
    const settle = (callback) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };
    const abort = () => {
      settle(() => reject(createAbortError()));
    };

    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) {
      abort();
      return;
    }

    promise.then(
      (value) => {
        settle(() => {
          try {
            throwIfAborted(signal);
            resolve(value);
          } catch (error) {
            reject(error);
          }
        });
      },
      (error) => {
        settle(() => {
          try {
            throwIfAborted(signal);
            reject(error);
          } catch (abortError) {
            reject(abortError);
          }
        });
      },
    );
  });
}

function createAccountRequestSignal(externalSignal) {
  throwIfAborted(externalSignal);
  const timeoutController = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    timeoutController.abort();
  }, accountRequestTimeoutMs);
  let cleanupExternalAbort = () => {};
  let signal = timeoutController.signal;

  if (externalSignal) {
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.any === 'function') {
      signal = AbortSignal.any([externalSignal, timeoutController.signal]);
    } else {
      const abortFromExternal = () => {
        timeoutController.abort();
      };
      externalSignal.addEventListener('abort', abortFromExternal, { once: true });
      cleanupExternalAbort = () => {
        externalSignal.removeEventListener('abort', abortFromExternal);
      };
    }
  }

  return {
    signal,
    didTimeout: () => timedOut,
    cleanup: () => {
      clearTimeout(timeout);
      cleanupExternalAbort();
    },
  };
}

async function withAccountRequestTimeout(operation, externalSignal) {
  const request = createAccountRequestSignal(externalSignal);
  try {
    return await operation(request.signal);
  } catch (error) {
    if (externalSignal?.aborted) {
      throw createAbortError();
    }
    if (request.didTimeout() && request.signal.aborted) {
      throw createAccountTimeoutError();
    }
    throw error;
  } finally {
    request.cleanup();
  }
}

function delay(ms, signal) {
  throwIfAborted(signal);
  return new Promise((resolve, reject) => {
    let timeout = null;
    const cleanup = () => {
      if (timeout) {
        clearTimeout(timeout);
      }
      signal?.removeEventListener('abort', abort);
    };
    const abort = () => {
      cleanup();
      reject(createAbortError());
    };
    timeout = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) {
      abort();
    }
  });
}

function accountNetworkErrorResult(error) {
  return accountErrorResult(`Unable to reach vlaina API: ${getErrorMessage(error)}`);
}

function isSecureStorageUnavailableError(error) {
  return /system secure storage is unavailable/i.test(getErrorMessage(error));
}

function isTransientAccountNetworkError(error) {
  const message = getErrorMessage(error).toLowerCase();
  if (error?.name === 'AbortError') {
    return false;
  }
  return (
    error instanceof TypeError ||
    message.includes('failed to fetch') ||
    message.includes('fetch failed') ||
    message.includes('networkerror') ||
    message.includes('network request failed') ||
    message.includes('load failed') ||
    message.includes('socket hang up') ||
    message.includes('econnreset') ||
    message.includes('econnrefused') ||
    message.includes('enotfound') ||
    message.includes('etimedout')
  );
}

async function retryTransientAccountNetworkError(operation, signal) {
  let lastError;
  for (let attempt = 0; attempt <= accountNetworkRetryDelaysMs.length; attempt += 1) {
    try {
      throwIfAborted(signal);
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isTransientAccountNetworkError(error) || attempt >= accountNetworkRetryDelaysMs.length) {
        throw error;
      }
      await delay(accountNetworkRetryDelaysMs[attempt], signal);
    }
  }
  throw lastError;
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

  async function requestDesktopAuthResult(provider, state, verifier, resultToken, signal) {
    const { data } = await retryTransientAccountNetworkError(
      () =>
        withAccountRequestTimeout((requestSignal) =>
          fetchDesktopJson(buildDesktopAuthResultUrl(provider), {
            method: 'POST',
            signal: requestSignal,
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              state,
              verifier,
              resultToken,
            }),
          }), signal),
      signal,
    );
    return data;
  }

  async function waitForDesktopAuthCompletion(provider, state, verifier, resultToken, expiresInSeconds, signal) {
    const deadline = Date.now() + Math.max(300, Math.min(900, expiresInSeconds ?? 300)) * 1000;
    while (true) {
      throwIfAborted(signal);
      const result = await requestDesktopAuthResult(provider, state, verifier, resultToken, signal);
      if (result?.success === true || result?.pending !== true) {
        return result;
      }

      if (Date.now() >= deadline) {
        throw new Error('Authorization timed out');
      }

      await delay(200, signal);
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

      const { data: authStart } = await retryTransientAccountNetworkError(
        () =>
          withAccountRequestTimeout((requestSignal) =>
            fetchDesktopJson(buildDesktopAuthStartUrl(provider), {
              method: 'POST',
              signal: requestSignal,
              headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                callbackUrl: loopback.callbackUrl,
                verifier,
              }),
            }), abortController.signal),
        abortController.signal,
      );

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
        expiresInSeconds,
        abortController.signal
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
      if (isSecureStorageUnavailableError(error)) {
        return accountErrorResult(getErrorMessage(error));
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
      await retryTransientAccountNetworkError(() =>
        withAccountRequestTimeout(async (signal) => {
          const response = await raceWithAbort(fetch(`${apiBaseUrl}/auth/email/request-code`, {
            method: 'POST',
            cache: 'no-store',
            signal,
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email }),
          }), signal);

          await readJsonResponse(response, `Failed to send verification code: HTTP ${response.status}`, signal);
        })
      );
      return true;
    });

    handleIpc('desktop:account:verify-email-code', async (_event, email, code) => {
      let data;
      try {
        ({ data } = await retryTransientAccountNetworkError(() =>
          withAccountRequestTimeout((signal) =>
            fetchDesktopJson(`${apiBaseUrl}/auth/email/verify-code`, {
              method: 'POST',
              signal,
              headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                email,
                code,
                target: 'desktop',
              }),
            }))
        ));
      } catch (error) {
        return accountErrorResult(getErrorMessage(error));
      }

      if (!data?.success) {
        return accountErrorResult(data?.error || 'Email sign-in failed');
      }

      return await persistDesktopAuthResult('email', data);
    });

    handleIpc('desktop:account:disconnect', async () => {
      const credentials = await readStoredAccountCredentials();
      if (credentials?.appSessionToken) {
        try {
          await withAccountRequestTimeout((signal) =>
            raceWithAbort(fetch(`${apiBaseUrl}/auth/session/revoke`, {
              method: 'POST',
              signal,
              headers: buildDesktopSessionHeaders(credentials.appSessionToken),
            }), signal)
          );
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
