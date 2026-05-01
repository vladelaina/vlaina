import { redactToken } from './accountAuthDebug.mjs';
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

function elapsedSince(startedAt) {
  return Math.max(0, Math.round(performance.now() - startedAt));
}

export function createDesktopAccountSessionClient({
  apiBaseUrl,
  clearStoredAccountCredentials,
  logDesktopAuth,
  readStoredAccountCredentials,
  rotateStoredSessionToken,
  writeStoredAccountCredentials,
}) {
  const { fetchDesktopJson, fetchJsonWithDebug, readJsonResponse } = createDesktopAccountJsonClient({
    logDesktopAuth,
  });

  function shouldGraceDesktopSession(credentials) {
    return isDesktopSessionWithinGracePeriod(
      credentials,
      Date.now(),
      desktopSessionActivationGracePeriodMs,
    );
  }

  async function performStoredSessionRequest(credentials, url, init = {}, eventPrefix = 'stored_session:http') {
    const startedAt = performance.now();
    logDesktopAuth(`${eventPrefix}:request`, {
      url,
      method: init.method ?? 'GET',
      body: typeof init.body === 'string' ? init.body : null,
      credentials,
    });

    const response = await fetch(url, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...buildDesktopSessionHeaders(credentials.appSessionToken),
        ...(init.headers ?? {}),
      },
    });

    logDesktopAuth(`${eventPrefix}:response`, {
      url,
      status: response.status,
      ok: response.ok,
      headers: {
        [desktopLegacySessionHeader]: redactToken(
          response.headers.get(desktopLegacySessionHeader)?.trim() ?? ''
        ),
        'content-type': response.headers.get('content-type'),
      },
      credentials,
      durationMs: elapsedSince(startedAt),
    });

    return response;
  }

  async function fetchWithStoredSession(url, init = {}) {
    const startedAt = performance.now();
    let credentials = await readStoredAccountCredentials();
    if (!credentials) {
      throw new Error('vlaina sign-in required');
    }

    let response = await performStoredSessionRequest(credentials, url, init);

    for (let attempt = 0; attempt < desktopSessionRetryDelaysMs.length; attempt += 1) {
      if (response.status !== 401 && response.status !== 403) {
        break;
      }

      const delayMs = desktopSessionRetryDelaysMs[attempt];
      logDesktopAuth('stored_session:http:retry_scheduled', {
        attempt: attempt + 1,
        delayMs,
        status: response.status,
        url,
        credentials,
      });
      await delay(delayMs);

      credentials = (await readStoredAccountCredentials()) ?? credentials;
      response = await performStoredSessionRequest(
        credentials,
        url,
        init,
        `stored_session:http:retry_${attempt + 1}`,
      );
    }

    if (response.status === 401 || response.status === 403) {
      if (shouldGraceDesktopSession(credentials)) {
        logDesktopAuth('stored_session:http:grace_period', {
          status: response.status,
          url,
          credentials,
        });
        throw new Error('vlaina session is still activating');
      }
      await clearStoredAccountCredentials();
      throw new Error('vlaina sign-in required');
    }

    await rotateStoredSessionToken(response.headers);
    logDesktopAuth('stored_session:http:done', {
      url,
      status: response.status,
      durationMs: elapsedSince(startedAt),
    });
    return response;
  }

  async function probeDesktopSession(appSessionToken, eventPrefix = 'session_status:http') {
    return await fetchJsonWithDebug(`${apiBaseUrl}/auth/session`, {
      method: 'GET',
      cache: 'no-store',
      headers: buildDesktopSessionHeaders(appSessionToken, {
        Accept: 'application/json',
      }),
    }, eventPrefix);
  }

  async function probeDesktopSessionWithRetry(appSessionToken, eventPrefix = 'session_status:http') {
    const startedAt = performance.now();
    let lastResult = await probeDesktopSession(appSessionToken, eventPrefix);

    for (let attempt = 0; attempt < desktopSessionRetryDelaysMs.length; attempt += 1) {
      if (lastResult.response.status !== 401 && lastResult.response.status !== 403) {
        logDesktopAuth(`${eventPrefix}:retry_done`, {
          status: lastResult.response.status,
          attempts: attempt + 1,
          durationMs: elapsedSince(startedAt),
        });
        return lastResult;
      }

      const delayMs = desktopSessionRetryDelaysMs[attempt];
      logDesktopAuth(`${eventPrefix}:retry_scheduled`, {
        attempt: attempt + 1,
        delayMs,
        status: lastResult.response.status,
        appSessionToken,
      });
      await delay(delayMs);

      lastResult = await probeDesktopSession(appSessionToken, `${eventPrefix}:retry_${attempt + 1}`);
    }

    logDesktopAuth(`${eventPrefix}:retry_done`, {
      status: lastResult.response.status,
      attempts: desktopSessionRetryDelaysMs.length + 1,
      durationMs: elapsedSince(startedAt),
    });
    return lastResult;
  }

  async function getDesktopAccountSessionStatus() {
    const startedAt = performance.now();
    const credentials = await readStoredAccountCredentials();
    logDesktopAuth('session_status:start', { credentials });
    if (!credentials) {
      logDesktopAuth('session_status:no_credentials');
      return buildDisconnectedDesktopStatus();
    }

    try {
      const { response, payload, text } = await probeDesktopSessionWithRetry(
        credentials.appSessionToken,
        'session_status:http',
      );

      if (response.status === 401 || response.status === 403) {
        if (shouldGraceDesktopSession(credentials)) {
          logDesktopAuth('session_status:unauthorized_grace', {
            status: response.status,
            credentials,
          });
          return buildCachedDesktopStatus(credentials);
        }

        logDesktopAuth('session_status:unauthorized', { status: response.status });
        const resolved = resolveDesktopSessionProbe(credentials, { kind: 'unauthorized' });
        if (resolved.clearStoredCredentials) {
          await clearStoredAccountCredentials();
        }
        return resolved.status;
      }

      if (!response.ok) {
        logDesktopAuth('session_status:non_ok_fallback', {
          status: response.status,
          text,
          payload,
          credentials,
        });
        return resolveDesktopSessionProbe(credentials, { kind: 'non_ok' }).status;
      }

      await rotateStoredSessionToken(response.headers);
      const rotatedAppSessionToken =
        (await readStoredAccountCredentials())?.appSessionToken ?? credentials.appSessionToken;
      logDesktopAuth('session_status:payload', {
        status: response.status,
        payload,
        text,
        summary: {
          connected: payload?.connected ?? null,
          provider: typeof payload?.provider === 'string' ? payload.provider : null,
          username: typeof payload?.username === 'string' ? payload.username : null,
          hasAvatarUrl: typeof payload?.avatarUrl === 'string' && payload.avatarUrl.trim().length > 0,
          error: typeof payload?.error === 'string' ? payload.error : null,
        },
        durationMs: elapsedSince(startedAt),
      });
      const resolved = resolveDesktopSessionProbe(credentials, {
        kind: 'ok',
        payload,
        rotatedAppSessionToken,
      });
      if (resolved.clearStoredCredentials) {
        logDesktopAuth('session_status:disconnected_payload', { payload });
        await clearStoredAccountCredentials();
        return resolved.status;
      }

      if (resolved.nextCredentials) {
        await writeStoredAccountCredentials(resolved.nextCredentials);
      }

      logDesktopAuth('session_status:resolved_connected', {
        nextCredentials: resolved.nextCredentials,
        membershipTier: resolved.status.membershipTier,
        membershipName: resolved.status.membershipName,
        hasAvatarUrl: typeof resolved.status.avatarUrl === 'string' && resolved.status.avatarUrl.trim().length > 0,
        durationMs: elapsedSince(startedAt),
      });

      return resolved.status;
    } catch (error) {
      logDesktopAuth('session_status:error_fallback', {
        error: error instanceof Error ? error.message : String(error),
        credentials,
        durationMs: elapsedSince(startedAt),
      });
      return resolveDesktopSessionProbe(credentials, { kind: 'error' }).status;
    }
  }

  async function readDesktopSessionIdentity(appSessionToken) {
    const startedAt = performance.now();
    logDesktopAuth('session_identity:start', { appSessionToken });
    const { response, payload, text } = await probeDesktopSessionWithRetry(
      appSessionToken,
      'session_identity:http',
    );

    if (response.status === 401 || response.status === 403) {
      logDesktopAuth('session_identity:unauthorized', { status: response.status, durationMs: elapsedSince(startedAt) });
      return null;
    }

    if (!response.ok) {
      logDesktopAuth('session_identity:non_ok', { status: response.status, text, payload, durationMs: elapsedSince(startedAt) });
      throw new Error(`Failed to verify desktop session: HTTP ${response.status}`);
    }

    logDesktopAuth('session_identity:payload', { status: response.status, payload, text, durationMs: elapsedSince(startedAt) });
    if (payload?.connected !== true) {
      logDesktopAuth('session_identity:disconnected_payload', { payload, durationMs: elapsedSince(startedAt) });
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
    logDesktopAuth('session_identity:resolved', {
      ...identity,
      hasAvatarUrl: typeof identity.avatarUrl === 'string' && identity.avatarUrl.trim().length > 0,
      durationMs: elapsedSince(startedAt),
    });
    return identity;
  }

  return {
    fetchDesktopJson,
    fetchWithStoredSession,
    getDesktopAccountSessionStatus,
    readDesktopSessionIdentity,
    readJsonResponse,
  };
}
