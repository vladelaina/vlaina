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

const desktopSessionRetryDelaysMs = [250, 500, 1000, 2000, 3000, 5000];
const desktopSessionActivationGracePeriodMs = 60_000;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createDesktopAccountSessionClient({
  apiBaseUrl,
  readStoredAccountCredentials,
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
    const response = await fetch(url, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...buildDesktopSessionHeaders(credentials.appSessionToken),
        ...(init.headers ?? {}),
      },
    });

    return response;
  }

  async function fetchWithStoredSession(url, init = {}) {
    let credentials = await readStoredAccountCredentials();
    if (!credentials) {
      throw new Error('vlaina sign-in required');
    }

    let response = await performStoredSessionRequest(credentials, url, init);

    for (let attempt = 0; attempt < desktopSessionRetryDelaysMs.length; attempt += 1) {
      if (response.status !== 401) {
        break;
      }

      const delayMs = desktopSessionRetryDelaysMs[attempt];
      await delay(delayMs);

      credentials = (await readStoredAccountCredentials()) ?? credentials;
      response = await performStoredSessionRequest(credentials, url, init);
    }

    if (response.status === 401) {
      if (shouldGraceDesktopSession(credentials)) {
        throw new Error('vlaina session is still activating');
      }
      throw new Error('vlaina session is temporarily unavailable');
    }

    await rotateStoredSessionToken(response.headers);
    return response;
  }

  async function fetchWithOptionalStoredSession(url, init = {}) {
    const credentials = await readStoredAccountCredentials();
    if (credentials) {
      return await fetchWithStoredSession(url, init);
    }

    const response = await fetch(url, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers ?? {}),
      },
    });

    return response;
  }

  async function probeDesktopSession(appSessionToken, eventPrefix = 'session_status:http') {
    return await fetchJson(`${apiBaseUrl}/auth/session`, {
      method: 'GET',
      cache: 'no-store',
      headers: buildDesktopSessionHeaders(appSessionToken, {
        Accept: 'application/json',
      }),
    }, eventPrefix);
  }

  async function probeDesktopSessionWithRetry(appSessionToken, eventPrefix = 'session_status:http') {
    let lastResult = await probeDesktopSession(appSessionToken, eventPrefix);

    for (let attempt = 0; attempt < desktopSessionRetryDelaysMs.length; attempt += 1) {
      if (lastResult.response.status !== 401 && lastResult.response.status !== 403) {
        return lastResult;
      }

      const delayMs = desktopSessionRetryDelaysMs[attempt];
      await delay(delayMs);

      lastResult = await probeDesktopSession(appSessionToken, `${eventPrefix}:retry_${attempt + 1}`);
    }

    return lastResult;
  }

  async function getDesktopAccountSessionStatus() {
    const credentials = await readStoredAccountCredentials();
    if (!credentials) {
      return buildDisconnectedDesktopStatus();
    }

    try {
      const { response, payload, text } = await probeDesktopSessionWithRetry(
        credentials.appSessionToken,
        'session_status:http',
      );

      if (response.status === 401 || response.status === 403) {
        if (shouldGraceDesktopSession(credentials)) {
          return buildCachedDesktopStatus(credentials);
        }

        const resolved = resolveDesktopSessionProbe(credentials, { kind: 'unauthorized' });
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
      username: typeof payload.username === 'string' && payload.username.trim() ? payload.username.trim() : null,
      primaryEmail:
        typeof payload.primaryEmail === 'string' && payload.primaryEmail.trim()
          ? payload.primaryEmail.trim()
          : null,
      avatarUrl:
        typeof payload.avatarUrl === 'string' && payload.avatarUrl.trim() ? payload.avatarUrl.trim() : null,
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
