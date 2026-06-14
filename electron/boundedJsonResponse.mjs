const DEFAULT_MAX_JSON_RESPONSE_BYTES = 1024 * 1024;
const MAX_CONTENT_LENGTH_HEADER_CHARS = 32;

function createAbortError() {
  return new DOMException('Aborted', 'AbortError');
}

function throwIfAborted(signal) {
  if (!signal?.aborted) return;
  throw createAbortError();
}

function readContentLength(response) {
  const rawContentLength = response.headers?.get?.('content-length');
  if (!rawContentLength) {
    return null;
  }
  const trimmed = rawContentLength.trim();
  if (trimmed.length > MAX_CONTENT_LENGTH_HEADER_CHARS || !/^\d+$/.test(trimmed)) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
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

export async function readBoundedJsonResponse(response, {
  maxBytes = DEFAULT_MAX_JSON_RESPONSE_BYTES,
  signal,
  tooLargeMessage = 'JSON response body is too large.',
} = {}) {
  throwIfAborted(signal);

  const contentLength = readContentLength(response);
  if (contentLength !== null && contentLength > maxBytes) {
    void response.body?.cancel?.().catch(() => undefined);
    throw new Error(tooLargeMessage);
  }

  if (!response.body) {
    throw new Error('JSON response body is empty.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const chunks = [];
  let bytesRead = 0;
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
      if (bytesRead > maxBytes) {
        void reader.cancel().catch(() => undefined);
        throw new Error(tooLargeMessage);
      }
      chunks.push(decoder.decode(value, { stream: true }));
    }

    chunks.push(decoder.decode());
    return JSON.parse(chunks.join(''));
  } finally {
    signal?.removeEventListener('abort', cancelReader);
    reader.releaseLock();
  }
}
