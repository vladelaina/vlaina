import { desktopLegacySessionHeader } from './accountSessionAuth.mjs';

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

export function createDesktopAccountJsonClient() {
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
      throw createJsonResponseError(payload, response, fallbackMessage);
    }

    return payload;
  }

  async function fetchJson(url, init = {}) {
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

    return { response, text, payload };
  }

  async function fetchDesktopJson(url, init = {}) {
    let response;
    let data;
    try {
      response = await fetch(url, init);
      data = await readJsonResponse(response, `Request failed: HTTP ${response.status}`);
    } catch (error) {
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
    return { response, data: nextData };
  }

  return {
    fetchDesktopJson,
    fetchJson,
    readJsonResponse,
  };
}
