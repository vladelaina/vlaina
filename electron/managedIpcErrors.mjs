const MAX_MANAGED_STREAM_LINE_CHARS = 1024 * 1024;
const MAX_MANAGED_ERROR_BODY_BYTES = 64 * 1024;
export const MANAGED_BACKEND_STREAM_ERROR = Symbol('managedBackendStreamError');

export function extractManagedPayloadErrorCode(payload) {
  if (typeof payload?.errorCode === 'string' && payload.errorCode.trim()) {
    return payload.errorCode.trim();
  }
  if (typeof payload?.error?.code === 'string' && payload.error.code.trim()) {
    return payload.error.code.trim();
  }
  if (typeof payload?.error?.type === 'string' && payload.error.type.trim()) {
    return payload.error.type.trim();
  }
  return null;
}

export function normalizeManagedErrorPayload(payload, status) {
  const fallback = `Managed stream failed: HTTP ${status}`;
  const errorCode = extractManagedPayloadErrorCode(payload);
  const normalizedCode = typeof errorCode === 'string' ? errorCode.toLowerCase() : '';
  let message = fallback;
  if (normalizedCode === 'points_exhausted' || normalizedCode === 'inactive_points' || normalizedCode === 'insufficient_points') {
    message = 'MANAGED_QUOTA_EXHAUSTED';
  } else if (normalizedCode === 'upstream_rate_limited') {
    message = 'UPSTREAM_RATE_LIMITED';
  } else if (normalizedCode === 'upstream_unavailable') {
    message = 'UPSTREAM_UNAVAILABLE';
  } else if (normalizedCode === 'unsupported_message_content' || normalizedCode === 'unsupported_model_input') {
    message = 'UNSUPPORTED_MODEL_INPUT';
  } else if (normalizedCode === 'unsupported_tool_calling') {
    message = 'UNSUPPORTED_TOOL_CALLING';
  } else if (normalizedCode === 'invalid_request') {
    message = 'INVALID_REQUEST';
  }

  return { message, statusCode: status, errorCode };
}

export function createManagedBackendStreamError(payload) {
  const message = typeof payload?.error?.message === 'string'
    ? payload.error.message
    : 'Managed stream failed';
  const error = new Error(message);
  const errorCode = extractManagedPayloadErrorCode(payload);
  if (errorCode) {
    error.errorCode = errorCode;
  }
  error[MANAGED_BACKEND_STREAM_ERROR] = true;
  return error;
}

export function createAbortError() {
  return new DOMException('Aborted', 'AbortError');
}

export function createManagedStreamTimeoutError() {
  const error = new Error('Managed stream timed out.');
  error.errorCode = 'managed_stream_timeout';
  return error;
}

export function isManagedStreamTimeoutError(error) {
  return !!error && typeof error === 'object' && error.errorCode === 'managed_stream_timeout';
}

export function throwIfAborted(signal) {
  if (!signal?.aborted) return;
  throw createAbortError();
}

export function assertManagedStreamLineLength(line) {
  if (line.length > MAX_MANAGED_STREAM_LINE_CHARS) {
    throw new Error('Managed stream line is too large.');
  }
}

export function appendManagedStreamBuffer(buffer, next) {
  if (buffer.length + next.length > MAX_MANAGED_STREAM_LINE_CHARS) {
    throw new Error('Managed stream line is too large.');
  }
  return buffer + next;
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

async function readManagedErrorText(response, signal) {
  if (!response.body) {
    return '';
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytesRead = 0;
  let text = '';
  const cancelReader = () => {
    void reader.cancel(createAbortError()).catch(() => {});
  };
  signal?.addEventListener('abort', cancelReader, { once: true });

  try {
    while (true) {
      const { done, value } = await raceWithAbort(reader.read(), signal);
      if (done) {
        break;
      }

      bytesRead += value.byteLength;
      if (bytesRead > MAX_MANAGED_ERROR_BODY_BYTES) {
        void reader.cancel(createAbortError()).catch(() => {});
        return '';
      }
      text += decoder.decode(value, { stream: true });
    }

    return text + decoder.decode();
  } finally {
    signal?.removeEventListener('abort', cancelReader);
    reader.releaseLock();
  }
}

export async function readManagedErrorPayload(response, signal) {
  const fallback = { message: `Managed stream failed: HTTP ${response.status}`, statusCode: response.status, errorCode: null };
  let text = '';
  try {
    throwIfAborted(signal);
    text = await readManagedErrorText(response, signal);
  } catch (error) {
    if (signal?.aborted) {
      throw createAbortError();
    }
    text = '';
  }
  if (!text) {
    return fallback;
  }

  try {
    const payload = JSON.parse(text);
    return normalizeManagedErrorPayload(payload, response.status);
  } catch {
    return fallback;
  }
}
