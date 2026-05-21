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

function summarizeStoredCredentials(credentials) {
  if (!credentials || typeof credentials !== 'object') {
    return null;
  }

  return {
    provider: credentials.provider ?? null,
    username: credentials.username ?? null,
    primaryEmail: credentials.primaryEmail ?? null,
    avatarUrl: credentials.avatarUrl ?? null,
    membershipTier: credentials.membershipTier ?? null,
    membershipName: credentials.membershipName ?? null,
    authenticatedAt: credentials.authenticatedAt ?? null,
    hasAppSessionToken: typeof credentials.appSessionToken === 'string' && credentials.appSessionToken.trim().length > 0,
  };
}

function summarizeSessionPayload(payload, text) {
  const summary = {
    textLength: typeof text === 'string' ? text.length : 0,
    payloadType: payload === null ? 'null' : Array.isArray(payload) ? 'array' : typeof payload,
  };

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return summary;
  }

  return {
    ...summary,
    payloadKeys: Object.keys(payload).sort(),
    connected: payload.connected ?? null,
    provider: typeof payload.provider === 'string' ? payload.provider : null,
    username: typeof payload.username === 'string' ? payload.username : null,
    hasAvatarUrl: typeof payload.avatarUrl === 'string' && payload.avatarUrl.trim().length > 0,
    membershipTier: typeof payload.membershipTier === 'string' ? payload.membershipTier : null,
    hasMembershipName: typeof payload.membershipName === 'string' && payload.membershipName.trim().length > 0,
    hasBudget: Boolean(payload.budget && typeof payload.budget === 'object'),
    budgetStatus:
      payload.budget && typeof payload.budget === 'object' && typeof payload.budget.status === 'string'
        ? payload.budget.status
        : null,
    error: typeof payload.error === 'string' ? payload.error : null,
  };
}

export function createDesktopAccountSessionClient({
  apiBaseUrl,
  logDesktopAuth,
  readStoredAccountCredentials,
  clearStoredAccountCredentials,
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
      bodySummary: typeof init.body === 'string'
        ? { type: 'text', length: init.body.length }
        : null,
      credentials: summarizeStoredCredentials(credentials),
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
      credentials: summarizeStoredCredentials(credentials),
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
      if (response.status !== 401) {
        break;
      }
      if (!shouldGraceDesktopSession(credentials)) {
        break;
      }

      const delayMs = desktopSessionRetryDelaysMs[attempt];
      logDesktopAuth('stored_session:http:retry_scheduled', {
        attempt: attempt + 1,
        delayMs,
        status: response.status,
        url,
        credentials: summarizeStoredCredentials(credentials),
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

    if (response.status === 401) {
      if (shouldGraceDesktopSession(credentials)) {
        logDesktopAuth('stored_session:http:grace_period', {
          status: response.status,
          url,
          credentials: summarizeStoredCredentials(credentials),
        });
        throw new Error('vlaina session is still activating');
      }
      logDesktopAuth('stored_session:http:unauthorized_cached', {
        status: response.status,
        url,
        credentials: summarizeStoredCredentials(credentials),
      });
      throw new Error('vlaina session is temporarily unavailable');
    }

    await rotateStoredSessionToken(response.headers);
    logDesktopAuth('stored_session:http:done', {
      url,
      status: response.status,
      durationMs: elapsedSince(startedAt),
    });
    return response;
  }

  async function fetchWithOptionalStoredSession(url, init = {}) {
    const credentials = await readStoredAccountCredentials();
    if (credentials) {
      return await fetchWithStoredSession(url, init);
    }

    const startedAt = performance.now();
    logDesktopAuth('optional_session:http:request', {
      url,
      method: init.method ?? 'GET',
      bodySummary: typeof init.body === 'string'
        ? { type: 'text', length: init.body.length }
        : null,
    });

    const response = await fetch(url, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers ?? {}),
      },
    });

    logDesktopAuth('optional_session:http:response', {
      url,
      status: response.status,
      ok: response.ok,
      headers: {
        'content-type': response.headers.get('content-type'),
      },
      durationMs: elapsedSince(startedAt),
    });

    return response;
  }

  async function probeDesktopSession(appSessionToken, eventPrefix = 'session_status:http', options = {}) {
    const sessionUrl = options.includeBudget
      ? `${apiBaseUrl}/auth/session?include_budget=1`
      : `${apiBaseUrl}/auth/session`;
    return await fetchJsonWithDebug(sessionUrl, {
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
    const startedAt = performance.now();
    let lastResult = await probeDesktopSession(appSessionToken, eventPrefix, { includeBudget });

    for (let attempt = 0; attempt < desktopSessionRetryDelaysMs.length; attempt += 1) {
      if (lastResult.response.status !== 401 && lastResult.response.status !== 403) {
        logDesktopAuth(`${eventPrefix}:retry_done`, {
          status: lastResult.response.status,
          attempts: attempt + 1,
          durationMs: elapsedSince(startedAt),
        });
        return lastResult;
      }
      if (!retryUnauthorized) {
        logDesktopAuth(`${eventPrefix}:retry_skipped`, {
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

      lastResult = await probeDesktopSession(
        appSessionToken,
        `${eventPrefix}:retry_${attempt + 1}`,
        { includeBudget },
      );
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
    logDesktopAuth('session_status:start', { credentials: summarizeStoredCredentials(credentials) });
    if (!credentials) {
      logDesktopAuth('session_status:no_credentials');
      return buildDisconnectedDesktopStatus();
    }

    try {
      const { response, payload, text } = await probeDesktopSessionWithRetry(
        credentials.appSessionToken,
        'session_status:http',
        { retryUnauthorized: shouldGraceDesktopSession(credentials), includeBudget: true },
      );

      if (response.status === 401 || response.status === 403) {
        if (shouldGraceDesktopSession(credentials)) {
          logDesktopAuth('session_status:unauthorized_grace', {
          status: response.status,
          credentials: summarizeStoredCredentials(credentials),
        });
          return buildCachedDesktopStatus(credentials);
        }

        logDesktopAuth('session_status:unauthorized', { status: response.status });
        const resolved = resolveDesktopSessionProbe(credentials, { kind: 'unauthorized' });
        if (resolved.clearStoredCredentials) {
          await clearStoredAccountCredentials?.();
        }
        return resolved.status;
      }

      if (!response.ok) {
        logDesktopAuth('session_status:non_ok_fallback', {
          status: response.status,
          responseSummary: summarizeSessionPayload(payload, text),
          credentials: summarizeStoredCredentials(credentials),
        });
        return resolveDesktopSessionProbe(credentials, { kind: 'non_ok' }).status;
      }

      await rotateStoredSessionToken(response.headers);
      const rotatedAppSessionToken =
        (await readStoredAccountCredentials())?.appSessionToken ?? credentials.appSessionToken;
      logDesktopAuth('session_status:payload', {
        status: response.status,
        summary: summarizeSessionPayload(payload, text),
        durationMs: elapsedSince(startedAt),
      });
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

      logDesktopAuth('session_status:resolved_connected', {
        nextCredentials: summarizeStoredCredentials(resolved.nextCredentials),
        membershipTier: resolved.status.membershipTier,
        membershipName: resolved.status.membershipName,
        hasAvatarUrl: typeof resolved.status.avatarUrl === 'string' && resolved.status.avatarUrl.trim().length > 0,
        durationMs: elapsedSince(startedAt),
      });

      return resolved.status;
    } catch (error) {
      logDesktopAuth('session_status:error_fallback', {
        error: error instanceof Error ? error.message : String(error),
        credentials: summarizeStoredCredentials(credentials),
        durationMs: elapsedSince(startedAt),
      });
      return resolveDesktopSessionProbe(credentials, { kind: 'error' }).status;
    }
  }

  async function readDesktopSessionIdentity(appSessionToken) {
    const startedAt = performance.now();
    logDesktopAuth('session_identity:start', { hasAppSessionToken: typeof appSessionToken === 'string' && appSessionToken.trim().length > 0 });
    const { response, payload, text } = await probeDesktopSessionWithRetry(
      appSessionToken,
      'session_identity:http',
      { includeBudget: true },
    );

    if (response.status === 401 || response.status === 403) {
      logDesktopAuth('session_identity:unauthorized', { status: response.status, durationMs: elapsedSince(startedAt) });
      return null;
    }

    if (!response.ok) {
      logDesktopAuth('session_identity:non_ok', {
        status: response.status,
        responseSummary: summarizeSessionPayload(payload, text),
        durationMs: elapsedSince(startedAt),
      });
      throw new Error(`Failed to verify desktop session: HTTP ${response.status}`);
    }

    logDesktopAuth('session_identity:payload', {
      status: response.status,
      summary: summarizeSessionPayload(payload, text),
      durationMs: elapsedSince(startedAt),
    });
    if (payload?.connected !== true) {
      logDesktopAuth('session_identity:disconnected_payload', {
        summary: summarizeSessionPayload(payload, text),
        durationMs: elapsedSince(startedAt),
      });
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
      membershipTier:
        payload.membershipTier === 'free' ||
        payload.membershipTier === 'plus' ||
        payload.membershipTier === 'pro' ||
        payload.membershipTier === 'max' ||
        payload.membershipTier === 'ultra'
          ? payload.membershipTier
          : null,
      membershipName:
        typeof payload.membershipName === 'string' && payload.membershipName.trim()
          ? payload.membershipName.trim()
          : null,
    };
    logDesktopAuth('session_identity:resolved', {
      ...identity,
      hasMembershipName: typeof identity.membershipName === 'string' && identity.membershipName.trim().length > 0,
      hasAvatarUrl: typeof identity.avatarUrl === 'string' && identity.avatarUrl.trim().length > 0,
      durationMs: elapsedSince(startedAt),
    });
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
