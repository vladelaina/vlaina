import { randomBytes } from 'node:crypto';

const accountNetworkRetryDelaysMs = [250, 750];
const accountRequestTimeoutMs = 15_000;
const maxAccountEmailInputChars = 4096;
const maxAccountEmailChars = 320;
const maxAccountEmailCodeInputChars = 64;
const maxAccountAuthStateChars = 4096;
const emailCodePattern = /^\d{6}$/;

export function accountErrorResult(message) {
  return {
    success: false,
    provider: null,
    username: null,
    primaryEmail: null,
    avatarUrl: null,
    error: message,
  };
}

export function generateDesktopVerifier() {
  return randomBytes(48).toString('base64url');
}

export function primitiveToString(value) {
  if (value == null) {
    return '';
  }
  switch (typeof value) {
    case 'string':
      return value;
    case 'number':
    case 'boolean':
    case 'bigint':
    case 'symbol':
      return String(value);
    default:
      return null;
  }
}

export function getErrorMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }
  return primitiveToString(error) || 'Unknown error';
}

export function normalizeEmailInput(value) {
  if (typeof value !== 'string' || value.length > maxAccountEmailInputChars) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0
    && normalized.length <= maxAccountEmailChars
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
    ? normalized
    : null;
}

export function normalizeEmailCodeInput(value) {
  if (typeof value !== 'string' || value.length > maxAccountEmailCodeInputChars) {
    return null;
  }

  const normalized = value.trim();
  return emailCodePattern.test(normalized) ? normalized : null;
}

export function normalizeAuthStateInput(value) {
  if (typeof value !== 'string' || value.length > maxAccountAuthStateChars) {
    return '';
  }

  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= maxAccountAuthStateChars ? normalized : '';
}

function createAbortError() {
  return new DOMException('Aborted', 'AbortError');
}

function createAccountTimeoutError() {
  return new Error('Account API request timed out.');
}

export function throwIfAborted(signal) {
  if (!signal?.aborted) return;
  throw createAbortError();
}

export async function raceWithAbort(promise, signal) {
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

function createAccountRequestSignal(externalSignal) {
  throwIfAborted(externalSignal);
  const timeoutController = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    timeoutController.abort();
  }, accountRequestTimeoutMs);
  let cleanupExternalAbort = () => {};
  let signal = timeoutController.signal;

  if (externalSignal) {
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.any === 'function') {
      signal = AbortSignal.any([externalSignal, timeoutController.signal]);
    } else {
      const abortFromExternal = () => {
        timeoutController.abort();
      };
      externalSignal.addEventListener('abort', abortFromExternal, { once: true });
      cleanupExternalAbort = () => {
        externalSignal.removeEventListener('abort', abortFromExternal);
      };
    }
  }

  return {
    signal,
    didTimeout: () => timedOut,
    cleanup: () => {
      clearTimeout(timeout);
      cleanupExternalAbort();
    },
  };
}

export async function withAccountRequestTimeout(operation, externalSignal) {
  const request = createAccountRequestSignal(externalSignal);
  try {
    return await operation(request.signal);
  } catch (error) {
    if (externalSignal?.aborted) {
      throw createAbortError();
    }
    if (request.didTimeout() && request.signal.aborted) {
      throw createAccountTimeoutError();
    }
    throw error;
  } finally {
    request.cleanup();
  }
}

export function delay(ms, signal) {
  throwIfAborted(signal);
  return new Promise((resolve, reject) => {
    let timeout = null;
    const cleanup = () => {
      if (timeout) {
        clearTimeout(timeout);
      }
      signal?.removeEventListener('abort', abort);
    };
    const abort = () => {
      cleanup();
      reject(createAbortError());
    };
    timeout = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) {
      abort();
    }
  });
}

export function accountNetworkErrorResult(error) {
  return accountErrorResult(`Unable to reach vlaina API: ${getErrorMessage(error)}`);
}

export function isSecureStorageUnavailableError(error) {
  return /system secure storage is unavailable/i.test(getErrorMessage(error));
}

function isTransientAccountNetworkError(error) {
  const message = getErrorMessage(error).toLowerCase();
  if (error?.name === 'AbortError') {
    return false;
  }
  const hasTransientElectronNetworkCode = /(?:net::)?err_(?:address_unreachable|connection_(?:aborted|closed|refused|reset|timed_out)|internet_disconnected|name_not_resolved|network_changed|proxy_connection_failed|socket_not_connected|timed_out|tunnel_connection_failed)/.test(message);
  return (
    error instanceof TypeError ||
    hasTransientElectronNetworkCode ||
    message.includes('failed to fetch') ||
    message.includes('fetch failed') ||
    message.includes('networkerror') ||
    message.includes('network request failed') ||
    message.includes('load failed') ||
    message.includes('socket hang up') ||
    message.includes('econnreset') ||
    message.includes('econnrefused') ||
    message.includes('enotfound') ||
    message.includes('etimedout')
  );
}

export async function retryTransientAccountNetworkError(operation, signal) {
  let lastError;
  for (let attempt = 0; attempt <= accountNetworkRetryDelaysMs.length; attempt += 1) {
    try {
      throwIfAborted(signal);
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isTransientAccountNetworkError(error) || attempt >= accountNetworkRetryDelaysMs.length) {
        throw error;
      }
      await delay(accountNetworkRetryDelaysMs[attempt], signal);
    }
  }
  throw lastError;
}
