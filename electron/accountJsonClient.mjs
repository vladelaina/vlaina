import { redactToken, summarizeAuthPayload, summarizeAuthResultShape } from './accountAuthDebug.mjs';
import { desktopLegacySessionHeader } from './accountSessionAuth.mjs';

function summarizeRequestBody(body) {
  if (typeof body !== 'string') {
    return null;
  }

  if (!body.trim()) {
    return { type: 'empty', length: 0 };
  }

  try {
    return {
      type: 'json',
      value: summarizeAuthPayload(JSON.parse(body)),
      length: body.length,
    };
  } catch {
    return {
      type: 'text',
      length: body.length,
    };
  }
}

function summarizeJsonPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return {
      type: payload === null ? 'null' : typeof payload,
    };
  }

  if (Array.isArray(payload)) {
    return {
      type: 'array',
      length: payload.length,
    };
  }

  return {
    type: 'object',
    keys: Object.keys(payload).sort(),
    authResult: summarizeAuthResultShape(payload),
  };
}

function createJsonResponseError(payload, response, fallbackMessage) {
  const message =
    typeof payload?.error === 'string' && payload.error.trim()
      ? payload.error.trim()
      : typeof payload?.error?.message === 'string' && payload.error.message.trim()
        ? payload.error.message.trim()
        : typeof payload?.message === 'string' && payload.message.trim()
          ? payload.message.trim()
          : fallbackMessage;
  const error = new Error(message);
  error.statusCode = response.status;

  const errorCode =
    typeof payload?.errorCode === 'string' && payload.errorCode.trim()
      ? payload.errorCode.trim()
      : typeof payload?.error?.code === 'string' && payload.error.code.trim()
        ? payload.error.code.trim()
        : '';
  if (errorCode) {
    error.errorCode = errorCode;
  }

  return error;
}

export function createDesktopAccountJsonClient({ logDesktopAuth }) {
  async function readJsonResponse(response, fallbackMessage) {
    const startedAt = performance.now();
    const text = await response.text();
    let payload = {};
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        if (response.ok) {
          throw new Error('Invalid JSON response');
        }
      }
    }

    if (!response.ok) {
      logDesktopAuth('fetch_json:read_response', {
        status: response.status,
        ok: response.ok,
        durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
      });
      throw createJsonResponseError(payload, response, fallbackMessage);
    }

    logDesktopAuth('fetch_json:read_response', {
      status: response.status,
      ok: response.ok,
      durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
    });
    return payload;
  }

  async function fetchJsonWithDebug(url, init = {}, eventPrefix) {
    const startedAt = performance.now();
    logDesktopAuth(`${eventPrefix}:request`, {
      url,
      method: init.method ?? 'GET',
      bodySummary: summarizeRequestBody(init.body),
    });

    const response = await fetch(url, init);
    const text = await response.text();
    let payload = null;

    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = null;
      }
    }

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
      textLength: text.length,
      payloadSummary: summarizeJsonPayload(payload),
      durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
    });

    return { response, text, payload };
  }

  async function fetchDesktopJson(url, init = {}) {
    const startedAt = performance.now();
    logDesktopAuth('fetch_json:start', {
      url,
      method: init.method ?? 'GET',
      bodySummary: summarizeRequestBody(init.body),
    });
    let response;
    let data;
    try {
      response = await fetch(url, init);
      data = await readJsonResponse(response, `Request failed: HTTP ${response.status}`);
    } catch (error) {
      logDesktopAuth('fetch_json:error', {
        url,
        method: init.method ?? 'GET',
        error: error instanceof Error ? error.message : String(error),
        durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
      });
      throw error;
    }
    const headerAppSessionToken = response.headers.get(desktopLegacySessionHeader)?.trim() ?? '';
    const nextData =
      headerAppSessionToken && data && typeof data === 'object' && !Array.isArray(data)
        ? {
            ...data,
            appSessionToken:
              typeof data.appSessionToken === 'string' && data.appSessionToken.trim()
                ? data.appSessionToken.trim()
                : headerAppSessionToken,
          }
        : data;
    logDesktopAuth('fetch_json:done', {
      url,
      status: response.status,
      headerAppSessionToken: redactToken(headerAppSessionToken),
      dataSummary: summarizeJsonPayload(nextData),
      summary:
        url.includes('/desktop/result')
          ? summarizeAuthResultShape(nextData)
          : null,
      durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
    });
    return { response, data: nextData };
  }

  return {
    fetchDesktopJson,
    fetchJsonWithDebug,
    readJsonResponse,
  };
}
