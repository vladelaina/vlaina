import {
  buildCachedDesktopStatus,
  buildDisconnectedDesktopStatus,
  isDesktopSessionWithinGracePeriod,
  resolveDesktopSessionProbe,
} from './accountSessionStatus.mjs';
import {
  buildDesktopSessionHeaders,
  desktopLegacySessionHeader,
} from './accountSessionAuth.mjs';
import { normalizeDesktopAccountProvider } from './accountCredentialStore.mjs';
import { createDesktopAccountJsonClient } from './accountJsonClient.mjs';
import {
  normalizeDesktopAccountAvatarUrl,
  normalizeDesktopAccountEmail,
  normalizeDesktopAccountMembershipName,
  normalizeDesktopAccountUsername,
} from './accountIdentityNormalization.mjs';

const desktopSessionRetryDelaysMs = [250, 500, 1000, 2000, 3000, 5000];
const desktopSessionActivationGracePeriodMs = 60_000;

function createAbortError() {
  return new DOMException('Aborted', 'AbortError');
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

export function createDesktopAccountSessionClient({
  apiBaseUrl,
  readStoredAccountCredentials,
  clearStoredAccountCredentials,
  rotateStoredSessionToken,
  writeStoredAccountCredentials,
}) {
  const { fetchDesktopJson, fetchJson, readJsonResponse } = createDesktopAccountJsonClient();

  function shouldGraceDesktopSession(credentials) {
    return isDesktopSessionWithinGracePeriod(
      credentials,
      Date.now(),
      desktopSessionActivationGracePeriodMs,
    );
  }

  async function performStoredSessionRequest(credentials, url, init = {}) {
    throwIfAborted(init.signal);
    const response = await raceWithAbort(fetch(url, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...buildDesktopSessionHeaders(credentials.appSessionToken),
        ...(init.headers ?? {}),
      },
    }), init.signal);
    throwIfAborted(init.signal);

    return response;
  }

  async function fetchWithStoredSession(url, init = {}) {
    throwIfAborted(init.signal);
    let credentials = await readStoredAccountCredentials();
    throwIfAborted(init.signal);
    if (!credentials) {
      throw new Error('vlaina sign-in required');
    }

    let response = await performStoredSessionRequest(credentials, url, init);

    for (let attempt = 0; attempt < desktopSessionRetryDelaysMs.length; attempt += 1) {
      if (response.status !== 401) {
        break;
      }
      if (!shouldGraceDesktopSession(credentials)) {
        break;
      }

      const delayMs = desktopSessionRetryDelaysMs[attempt];
      await delay(delayMs, init.signal);

      credentials = (await readStoredAccountCredentials()) ?? credentials;
      throwIfAborted(init.signal);
      response = await performStoredSessionRequest(credentials, url, init);
    }

    if (response.status === 401) {
      if (shouldGraceDesktopSession(credentials)) {
        throw new Error('vlaina session is still activating');
      }
      throw new Error('vlaina session is temporarily unavailable');
    }

    throwIfAborted(init.signal);
    await rotateStoredSessionToken(response.headers);
    throwIfAborted(init.signal);
    return response;
  }

  async function fetchWithOptionalStoredSession(url, init = {}) {
    throwIfAborted(init.signal);
    const credentials = await readStoredAccountCredentials();
    throwIfAborted(init.signal);
    if (credentials) {
      return await fetchWithStoredSession(url, init);
    }

    const response = await raceWithAbort(fetch(url, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers ?? {}),
      },
    }), init.signal);
    throwIfAborted(init.signal);

    return response;
  }

  async function probeDesktopSession(appSessionToken, eventPrefix = 'session_status:http', options = {}) {
    const sessionUrl = options.includeBudget
      ? `${apiBaseUrl}/auth/session?include_budget=1`
      : `${apiBaseUrl}/auth/session`;
    return await fetchJson(sessionUrl, {
      method: 'GET',
      cache: 'no-store',
      headers: buildDesktopSessionHeaders(appSessionToken, {
        Accept: 'application/json',
      }),
    }, eventPrefix);
  }

  async function probeDesktopSessionWithRetry(
    appSessionToken,
    eventPrefix = 'session_status:http',
    { retryUnauthorized = true, includeBudget = false } = {},
  ) {
    let lastResult = await probeDesktopSession(appSessionToken, eventPrefix, { includeBudget });

    for (let attempt = 0; attempt < desktopSessionRetryDelaysMs.length; attempt += 1) {
      if (lastResult.response.status !== 401 && lastResult.response.status !== 403) {
        return lastResult;
      }
      if (!retryUnauthorized) {
        return lastResult;
      }

      const delayMs = desktopSessionRetryDelaysMs[attempt];
      await delay(delayMs);

      lastResult = await probeDesktopSession(
        appSessionToken,
        `${eventPrefix}:retry_${attempt + 1}`,
        { includeBudget },
      );
    }

    return lastResult;
  }

  async function getDesktopAccountSessionStatus() {
    const credentials = await readStoredAccountCredentials();
    if (!credentials) {
      return buildDisconnectedDesktopStatus({ sessionInvalidated: true });
    }

    try {
      const { response, payload, text } = await probeDesktopSessionWithRetry(
        credentials.appSessionToken,
        'session_status:http',
        { retryUnauthorized: shouldGraceDesktopSession(credentials), includeBudget: true },
      );

      if (response.status === 401 || response.status === 403) {
        if (shouldGraceDesktopSession(credentials)) {
          return buildCachedDesktopStatus(credentials);
        }

        const resolved = resolveDesktopSessionProbe(credentials, { kind: 'unauthorized' });
        if (resolved.clearStoredCredentials) {
          await clearStoredAccountCredentials?.();
        }
        return resolved.status;
      }

      if (!response.ok) {
        return resolveDesktopSessionProbe(credentials, { kind: 'non_ok' }).status;
      }

      await rotateStoredSessionToken(response.headers);
      const rotatedAppSessionToken =
        (await readStoredAccountCredentials())?.appSessionToken ?? credentials.appSessionToken;
      const resolved = resolveDesktopSessionProbe(credentials, {
        kind: 'ok',
        payload,
        rotatedAppSessionToken,
      });
      if (resolved.clearStoredCredentials) {
        await clearStoredAccountCredentials?.();
      }
      if (resolved.nextCredentials) {
        await writeStoredAccountCredentials(resolved.nextCredentials);
      }

      return resolved.status;
    } catch (error) {
      return resolveDesktopSessionProbe(credentials, { kind: 'error' }).status;
    }
  }

  async function readDesktopSessionIdentity(appSessionToken) {
    const { response, payload, text } = await probeDesktopSessionWithRetry(
      appSessionToken,
      'session_identity:http',
      { includeBudget: true },
    );

    if (response.status === 401 || response.status === 403) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Failed to verify desktop session: HTTP ${response.status}`);
    }

    if (payload?.connected !== true) {
      return null;
    }

    const identity = {
      provider: normalizeDesktopAccountProvider(payload.provider),
      username: normalizeDesktopAccountUsername(payload.username),
      primaryEmail: normalizeDesktopAccountEmail(payload.primaryEmail),
      avatarUrl: normalizeDesktopAccountAvatarUrl(payload.avatarUrl),
      membershipTier:
        payload.membershipTier === 'free' ||
        payload.membershipTier === 'plus' ||
        payload.membershipTier === 'pro' ||
        payload.membershipTier === 'max' ||
        payload.membershipTier === 'ultra'
          ? payload.membershipTier
          : null,
      membershipName: normalizeDesktopAccountMembershipName(payload.membershipName),
    };
    return identity;
  }

  return {
    fetchDesktopJson,
    fetchWithOptionalStoredSession,
    fetchWithStoredSession,
    getDesktopAccountSessionStatus,
    readDesktopSessionIdentity,
    readJsonResponse,
  };
}
