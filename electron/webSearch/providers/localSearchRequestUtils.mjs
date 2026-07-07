import { WebSearchError } from '../types.mjs';

export const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
export const SEARCH_TIMEOUT_MS = 8000;
export const OFFICIAL_HINT_GRACE_MS = 500;
export const ENGINE_FALLBACK_GRACE_MS = 500;
export const MAX_SEARCH_RESPONSE_TEXT_BYTES = 1_000_000;
export const MAX_SEARCH_TIMEOUT_INPUT_CHARS = 16;
export const MAX_SEARCH_TIMEOUT_MS = 30_000;

export function normalizeSearchTimeoutMs(value, fallback = SEARCH_TIMEOUT_MS, max = MAX_SEARCH_TIMEOUT_MS) {
  let parsed = Number.NaN;
  if (typeof value === 'number') {
    parsed = value;
  } else if (typeof value === 'string' && value.length <= MAX_SEARCH_TIMEOUT_INPUT_CHARS) {
    const trimmed = value.trim();
    parsed = /^\d+$/.test(trimmed) ? Number.parseInt(trimmed, 10) : Number.NaN;
  }
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(Math.floor(parsed), max);
}

export function createAbortError() {
  return new DOMException('The web search request was cancelled.', 'AbortError');
}

export function throwIfAborted(signal) {
  if (!signal?.aborted) return;
  throw createAbortError();
}

export async function raceWithAbort(promise, signal) {
  if (!signal) return await promise;
  throwIfAborted(signal);
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

export async function readResponseText(response, signal) {
  throwIfAborted(signal);
  if (!response.body) {
    if (typeof response.text !== 'function') {
      return '';
    }
    const text = await raceWithAbort(response.text(), signal);
    throwIfAborted(signal);
    if (Buffer.byteLength(text, 'utf8') > MAX_SEARCH_RESPONSE_TEXT_BYTES) {
      throw new WebSearchError('response_too_large', 'Search response is too large.');
    }
    return text;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytesRead = 0;
  let text = '';
  const cancelReader = () => {
    void reader.cancel(createAbortError()).catch(() => undefined);
  };
  signal?.addEventListener('abort', cancelReader, { once: true });

  try {
    while (true) {
      const { done, value } = await raceWithAbort(reader.read(), signal);
      throwIfAborted(signal);
      if (done) {
        break;
      }

      bytesRead += value.byteLength;
      if (bytesRead > MAX_SEARCH_RESPONSE_TEXT_BYTES) {
        void reader.cancel().catch(() => undefined);
        throw new WebSearchError('response_too_large', 'Search response is too large.');
      }
      text += decoder.decode(value, { stream: true });
    }

    return text + decoder.decode();
  } finally {
    signal?.removeEventListener('abort', cancelReader);
    reader.releaseLock();
  }
}
