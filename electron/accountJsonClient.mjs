import { desktopLegacySessionHeader } from './accountSessionAuth.mjs';
import {
  summarizeAuthPayload,
  summarizeJsonPayload,
  summarizeRequestBody,
} from './accountAuthDebug.mjs';

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

function maskToken(value) {
  return typeof value === 'string' && value
    ? summarizeAuthPayload(value, 'token')
    : '';
}

function summarizeDesktopData(data) {
  return {
    username: typeof data?.username === 'string' ? data.username : undefined,
    hasAppSessionToken: Boolean(data?.appSessionToken),
  };
}

export function createDesktopAccountJsonClient(options = {}) {
  const logDesktopAuth = typeof options.logDesktopAuth === 'function'
    ? options.logDesktopAuth
    : null;
  async function readJsonResponse(response, fallbackMessage, signal) {
    throwIfAborted(signal);
    const text = await raceWithAbort(response.text(), signal);
    throwIfAborted(signal);
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
    throwIfAborted(init.signal);
    const response = await raceWithAbort(fetch(url, init), init.signal);
    throwIfAborted(init.signal);
    const text = await raceWithAbort(response.text(), init.signal);
    throwIfAborted(init.signal);
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

  async function fetchJsonWithDebug(url, init = {}, eventPrefix = 'fetch_json:http') {
    logDesktopAuth?.(`${eventPrefix}:request`, {
      url,
      method: init.method ?? 'GET',
      bodySummary: summarizeRequestBody(init.body),
    });

    const result = await fetchJson(url, init);
    logDesktopAuth?.(`${eventPrefix}:response`, {
      status: result.response.status,
      ok: result.response.ok,
      textLength: result.text.length,
      payloadSummary: summarizeJsonPayload(result.payload),
    });
    return result;
  }

  async function fetchDesktopJson(url, init = {}) {
    logDesktopAuth?.('fetch_json:start', {
      url,
      method: init.method ?? 'GET',
      bodySummary: summarizeRequestBody(init.body),
    });
    let response;
    let data;
    try {
      throwIfAborted(init.signal);
      response = await raceWithAbort(fetch(url, init), init.signal);
      throwIfAborted(init.signal);
      data = await readJsonResponse(response, `Request failed: HTTP ${response.status}`, init.signal);
      throwIfAborted(init.signal);
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
    logDesktopAuth?.('fetch_json:done', {
      status: response.status,
      headerAppSessionToken: maskToken(headerAppSessionToken),
      dataSummary: summarizeJsonPayload(nextData),
      summary: summarizeDesktopData(nextData),
    });
    return { response, data: nextData };
  }

  return {
    fetchDesktopJson,
    fetchJson,
    fetchJsonWithDebug,
    readJsonResponse,
  };
}
