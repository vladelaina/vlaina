import { redactToken, summarizeAuthResultShape } from './accountAuthDebug.mjs';
import { desktopLegacySessionHeader } from './accountSessionAuth.mjs';

export function createDesktopAccountJsonClient({ logDesktopAuth }) {
  async function readJsonResponse(response, fallbackMessage) {
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
      throw new Error(
        typeof payload?.error === 'string' && payload.error.trim()
          ? payload.error.trim()
          : fallbackMessage
      );
    }

    return payload;
  }

  async function fetchJsonWithDebug(url, init = {}, eventPrefix) {
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
    });

    return { response, text, payload };
  }

  async function fetchDesktopJson(url, init = {}) {
    logDesktopAuth('fetch_json:start', {
      url,
      method: init.method ?? 'GET',
      body: typeof init.body === 'string' ? init.body : null,
    });
    const response = await fetch(url, init);
    const data = await readJsonResponse(response, `Request failed: HTTP ${response.status}`);
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
    });
    return { response, data: nextData };
  }

  return {
    fetchDesktopJson,
    fetchJsonWithDebug,
    readJsonResponse,
  };
}
