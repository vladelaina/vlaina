import { redactToken, summarizeAuthResultShape } from './accountAuthDebug.mjs';
import { desktopLegacySessionHeader } from './accountSessionAuth.mjs';

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
      throw new Error(
        typeof payload?.error === 'string' && payload.error.trim()
          ? payload.error.trim()
          : fallbackMessage
      );
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
      body: typeof init.body === 'string' ? init.body : null,
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
      text,
      payload,
      durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
    });

    return { response, text, payload };
  }

  async function fetchDesktopJson(url, init = {}) {
    const startedAt = performance.now();
    logDesktopAuth('fetch_json:start', {
      url,
      method: init.method ?? 'GET',
      body: typeof init.body === 'string' ? init.body : null,
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
      headerAppSessionToken,
      data: nextData,
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
