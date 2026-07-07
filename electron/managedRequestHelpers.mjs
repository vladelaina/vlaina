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

function createTimedRequestInit(init = {}, timeoutMs = null) {
  if (!timeoutMs || init.signal?.aborted) {
    return {
      requestInit: init,
      cleanup: () => {},
    };
  }

  const timeoutController = new AbortController();
  const timeout = setTimeout(() => {
    timeoutController.abort();
  }, timeoutMs);
  let cleanupExternalAbort = () => {};
  let signal = timeoutController.signal;

  if (init.signal) {
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.any === 'function') {
      signal = AbortSignal.any([init.signal, timeoutController.signal]);
    } else {
      const abortFromExternal = () => {
        timeoutController.abort();
      };
      init.signal.addEventListener('abort', abortFromExternal, { once: true });
      cleanupExternalAbort = () => {
        init.signal.removeEventListener('abort', abortFromExternal);
      };
    }
  }

  return {
    requestInit: {
      ...init,
      signal,
    },
    cleanup: () => {
      clearTimeout(timeout);
      cleanupExternalAbort();
    },
  };
}

function delayReadOnlyNetworkRetry(ms, signal) {
  if (signal?.aborted) {
    return Promise.reject(createAbortError());
  }

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
  });
}

export function createManagedRequestHelpers({
  apiBaseUrl,
  managedApiBaseUrl,
  fetchWithStoredSession,
  readJsonResponse,
  readOnlyNetworkRetryDelaysMs = [300],
  readOnlyFastFailureRetryWindowMs = 2000,
  managedReadOnlyRequestTimeoutMs = 15_000,
  desktopAccountRequestTimeoutMs = 15_000,
}) {
  async function retryReadOnlyNetworkFailure(operation, init = {}) {
    const method = String(init.method ?? 'GET').toUpperCase();
    if (method !== 'GET') {
      return await operation();
    }

    for (let attempt = 0; ; attempt += 1) {
      const startedAt = Date.now();
      try {
        return await operation();
      } catch (error) {
        const retryDelayMs = readOnlyNetworkRetryDelaysMs[attempt];
        const failedQuickly = Date.now() - startedAt <= readOnlyFastFailureRetryWindowMs;
        if (init.signal?.aborted || retryDelayMs == null || !failedQuickly) {
          throw error;
        }
        await delayReadOnlyNetworkRetry(retryDelayMs, init.signal);
      }
    }
  }

  async function requestManagedJson(pathname, init = {}) {
    const method = String(init.method ?? 'GET').toUpperCase();
    const { requestInit, cleanup } = createTimedRequestInit({
      ...init,
      cache: 'no-store',
    }, method === 'GET' ? managedReadOnlyRequestTimeoutMs : null);
    try {
      const response = await retryReadOnlyNetworkFailure(
        () => fetchWithStoredSession(`${managedApiBaseUrl}${pathname}`, requestInit),
        requestInit,
      );
      return await readJsonResponse(response, `Managed API request failed: HTTP ${response.status}`, requestInit.signal);
    } finally {
      cleanup();
    }
  }

  async function requestManagedPublicJson(pathname, init = {}) {
    const method = String(init.method ?? 'GET').toUpperCase();
    const { requestInit, cleanup } = createTimedRequestInit({
      ...init,
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        ...(init.headers ?? {}),
      },
    }, method === 'GET' ? managedReadOnlyRequestTimeoutMs : null);
    try {
      const response = await retryReadOnlyNetworkFailure(
        () => {
          throwIfAborted(requestInit.signal);
          return raceWithAbort(fetch(`${managedApiBaseUrl}${pathname}`, requestInit), requestInit.signal);
        },
        requestInit,
      );
      return await readJsonResponse(response, `Managed API request failed: HTTP ${response.status}`, requestInit.signal);
    } finally {
      cleanup();
    }
  }

  async function createElectronBillingCheckout(tier) {
    const { requestInit, cleanup } = createTimedRequestInit({
      method: 'POST',
      cache: 'no-store',
      body: JSON.stringify({ tier }),
    }, desktopAccountRequestTimeoutMs);
    try {
      const response = await fetchWithStoredSession(`${apiBaseUrl}/billing/checkout`, requestInit);
      return await readJsonResponse(response, `Failed to create checkout session: HTTP ${response.status}`, requestInit.signal);
    } finally {
      cleanup();
    }
  }

  async function submitElectronFeedback(message) {
    const { requestInit, cleanup } = createTimedRequestInit({
      method: 'POST',
      cache: 'no-store',
      body: JSON.stringify({ message: primitiveToString(message) ?? '' }),
    }, desktopAccountRequestTimeoutMs);
    try {
      const response = await fetchWithStoredSession(`${apiBaseUrl}/feedback`, requestInit);
      return await readJsonResponse(response, `Failed to submit feedback: HTTP ${response.status}`, requestInit.signal);
    } finally {
      cleanup();
    }
  }

  return {
    createElectronBillingCheckout,
    requestManagedJson,
    requestManagedPublicJson,
    submitElectronFeedback,
  };
}
