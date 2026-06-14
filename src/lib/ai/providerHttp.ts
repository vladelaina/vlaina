import { getElectronBridge } from '@/lib/electron/bridge';

interface ProviderFetchInit {
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: BodyInit | null;
  signal?: AbortSignal;
}

const PROVIDER_GET_RETRY_DELAYS_MS = [300];
const PROVIDER_FAST_FAILURE_RETRY_WINDOW_MS = 2000;
const MAX_DESKTOP_PROVIDER_REQUEST_BODY_BYTES = 64 * 1024 * 1024;
const MAX_DESKTOP_PROVIDER_RESPONSE_BODY_BYTES = 64 * 1024 * 1024;
const MAX_PROVIDER_REQUEST_URL_CHARS = 16 * 1024;
const HTTP_AUTHORITY_URL_PATTERN = /^https?:\/\//i;
const UNSAFE_PROVIDER_URL_CHARS_PATTERN = /[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069\uFFFD]/;

export async function providerFetch(url: string, init: ProviderFetchInit): Promise<Response> {
  const safeUrl = normalizeProviderRequestUrl(url);
  const bridge = getElectronBridge();
  if (bridge?.aiProvider) {
    return desktopProviderFetch(safeUrl, init, bridge.aiProvider);
  }

  return fetchWithGetRetry(safeUrl, init);
}

function normalizeProviderRequestUrl(url: unknown): string {
  if (typeof url !== 'string' || url.length > MAX_PROVIDER_REQUEST_URL_CHARS) {
    throw new Error('AI provider request URL is not supported.');
  }
  const trimmed = url.trim();
  if (
    !trimmed ||
    trimmed.length > MAX_PROVIDER_REQUEST_URL_CHARS ||
    !HTTP_AUTHORITY_URL_PATTERN.test(trimmed) ||
    UNSAFE_PROVIDER_URL_CHARS_PATTERN.test(trimmed) ||
    trimmed.includes('\\')
  ) {
    throw new Error('AI provider request URL is not supported.');
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('AI provider request URL is not supported.');
  }

  if (
    (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') ||
    parsed.username ||
    parsed.password
  ) {
    throw new Error('AI provider request URL is not supported.');
  }

  return parsed.toString();
}

function delayProviderRetry(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(new DOMException('Aborted', 'AbortError'));
  }

  return new Promise((resolve, reject) => {
    let timeout: ReturnType<typeof setTimeout>;
    const abort = () => {
      clearTimeout(timeout);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    const complete = () => {
      signal?.removeEventListener('abort', abort);
      resolve();
    };
    signal?.addEventListener('abort', abort, { once: true });
    timeout = setTimeout(complete, ms);
  });
}

async function fetchWithGetRetry(url: string, init: ProviderFetchInit): Promise<Response> {
  const shouldRetry = init.method === 'GET';
  for (let attempt = 0; ; attempt += 1) {
    const startedAt = Date.now();
    try {
      throwIfAborted(init.signal);
      const response = await raceWithAbort(fetch(url, init), init.signal);
      throwIfAborted(init.signal);
      return response;
    } catch (error) {
      const retryDelayMs = shouldRetry ? PROVIDER_GET_RETRY_DELAYS_MS[attempt] : undefined;
      const failedQuickly = Date.now() - startedAt <= PROVIDER_FAST_FAILURE_RETRY_WINDOW_MS;
      if (init.signal?.aborted || retryDelayMs == null || !failedQuickly) {
        throw error;
      }
      await delayProviderRetry(retryDelayMs, init.signal);
    }
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  const CHUNK_SIZE = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + CHUNK_SIZE);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function assertDesktopProviderRequestBodySize(byteLength: number): void {
  if (!Number.isFinite(byteLength) || byteLength < 0 || byteLength > MAX_DESKTOP_PROVIDER_REQUEST_BODY_BYTES) {
    throw new Error('Desktop AI provider request body is too large.');
  }
}

function assertDesktopProviderRequestTextSize(value: string): void {
  let byteLength = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x7f) {
      byteLength += 1;
    } else if (code <= 0x7ff) {
      byteLength += 2;
    } else if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        byteLength += 4;
        index += 1;
      } else {
        byteLength += 3;
      }
    } else {
      byteLength += 3;
    }

    if (byteLength > MAX_DESKTOP_PROVIDER_REQUEST_BODY_BYTES) {
      throw new Error('Desktop AI provider request body is too large.');
    }
  }
}

function createAbortError(): DOMException {
  return new DOMException('Aborted', 'AbortError');
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  throw createAbortError();
}

function raceWithAbort<T>(
  promise: Promise<T>,
  signal?: AbortSignal,
  onAbort?: () => void,
): Promise<T> {
  if (!signal) {
    return promise;
  }
  if (signal.aborted) {
    onAbort?.();
    return Promise.reject(createAbortError());
  }

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      signal.removeEventListener('abort', abort);
    };
    const abort = () => {
      cleanup();
      onAbort?.();
      reject(createAbortError());
    };

    signal.addEventListener('abort', abort, { once: true });
    promise.then(
      (value) => {
        cleanup();
        if (signal.aborted) {
          reject(createAbortError());
          return;
        }
        resolve(value);
      },
      (error) => {
        cleanup();
        if (signal.aborted) {
          reject(createAbortError());
          return;
        }
        reject(error);
      },
    );
  });
}

function readBlobAsArrayBuffer(blob: Blob, signal?: AbortSignal): Promise<ArrayBuffer> {
  const arrayBuffer = (blob as { arrayBuffer?: () => Promise<ArrayBuffer> }).arrayBuffer;
  if (typeof arrayBuffer === 'function') {
    return raceWithAbort(arrayBuffer.call(blob), signal);
  }

  if (typeof FileReader === 'undefined') {
    return Promise.reject(new Error('Desktop AI provider binary requests require Blob.arrayBuffer or FileReader support.'));
  }

  const reader = new FileReader();
  const promise = new Promise<ArrayBuffer>((resolve, reject) => {
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
        return;
      }
      reject(new Error('Desktop AI provider binary request body could not be read as bytes.'));
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error('Desktop AI provider binary request body could not be read.'));
    };
    reader.onabort = () => {
      reject(createAbortError());
    };
    reader.readAsArrayBuffer(blob);
  });
  return raceWithAbort(promise, signal, () => {
    try {
      reader.abort();
    } catch {
    }
  });
}

async function normalizeDesktopRequestBody(body: BodyInit | null | undefined, signal?: AbortSignal): Promise<{
  body?: string;
  bodyBase64?: string;
}> {
  throwIfAborted(signal);
  if (body == null) {
    return {};
  }
  if (typeof body === 'string') {
    assertDesktopProviderRequestTextSize(body);
    return { body };
  }
  if (body instanceof Blob) {
    assertDesktopProviderRequestBodySize(body.size);
    const bytes = new Uint8Array(await readBlobAsArrayBuffer(body, signal));
    assertDesktopProviderRequestBodySize(bytes.byteLength);
    return { bodyBase64: bytesToBase64(bytes) };
  }
  if (body instanceof ArrayBuffer) {
    assertDesktopProviderRequestBodySize(body.byteLength);
    return { bodyBase64: bytesToBase64(new Uint8Array(body)) };
  }
  if (ArrayBuffer.isView(body)) {
    assertDesktopProviderRequestBodySize(body.byteLength);
    return { bodyBase64: bytesToBase64(new Uint8Array(body.buffer, body.byteOffset, body.byteLength)) };
  }
  throw new Error('Unsupported desktop AI provider request body.');
}

async function desktopProviderFetch(
  url: string,
  init: ProviderFetchInit,
  aiProvider: NonNullable<ReturnType<typeof getElectronBridge>>['aiProvider']
): Promise<Response> {
  const requestId = createRequestId();
  const cleanupCallbacks: Array<() => void> = [];
  let didSettle = false;
  let streamController: ReadableStreamDefaultController<Uint8Array> | null = null;
  let rejectStartOnTerminalError: ((error: Error | DOMException) => void) | null = null;
  let terminalError: Error | DOMException | null = null;
  let listenerRegistrationError: unknown = null;
  let didReceiveMetadata = false;
  let responseBytesReceived = 0;

  const cleanup = () => {
    cleanupCallbacks.splice(0).forEach((cleanupCallback) => cleanupCallback());
  };

  const abortRequest = () => {
    if (didSettle) return;
    didSettle = true;
    void aiProvider.cancelRequest(requestId).catch(() => {});
    const abortError = createAbortError();
    terminalError = abortError;
    try {
      streamController?.error(abortError);
    } catch {
    }
    rejectStartOnTerminalError?.(abortError);
    cleanup();
  };

  if (init.signal?.aborted) {
    throw createAbortError();
  }

  init.signal?.addEventListener('abort', abortRequest, { once: true });
  cleanupCallbacks.push(() => init.signal?.removeEventListener('abort', abortRequest));

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      streamController = controller;
      try {
        cleanupCallbacks.push(aiProvider.onRequestChunk(requestId, (chunk) => {
          if (didSettle || init.signal?.aborted) return;
          responseBytesReceived += chunk.length;
          if (responseBytesReceived > MAX_DESKTOP_PROVIDER_RESPONSE_BODY_BYTES) {
            didSettle = true;
            const error = new Error('Desktop AI provider response body is too large.');
            terminalError = error;
            void aiProvider.cancelRequest(requestId).catch(() => {});
            try {
              controller.error(error);
            } catch {
            }
            rejectStartOnTerminalError?.(error);
            cleanup();
            return;
          }
          const bytes = new Uint8Array(chunk);
          try {
            controller.enqueue(bytes);
          } catch {
          }
        }));
        cleanupCallbacks.push(aiProvider.onRequestDone(requestId, () => {
          if (didSettle || init.signal?.aborted) return;
          didSettle = true;
          if (!didReceiveMetadata) {
            terminalError = new Error('AI provider request completed before response metadata was received.');
            rejectStartOnTerminalError?.(terminalError);
          }
          try {
            controller.close();
          } catch {
          }
          cleanup();
        }));
        cleanupCallbacks.push(aiProvider.onRequestError(requestId, (payload) => {
          if (didSettle || init.signal?.aborted) return;
          didSettle = true;
          const error = new Error(payload.message || 'AI provider request failed');
          if (!didReceiveMetadata) {
            terminalError = error;
            rejectStartOnTerminalError?.(error);
          }
          controller.error(error);
          cleanup();
        }));
      } catch (error) {
        didSettle = true;
        listenerRegistrationError = error;
        cleanup();
        controller.error(error);
      }
    },
    cancel() {
      abortRequest();
    },
  });

  try {
    const terminalErrorPromise = new Promise<never>((_, reject) => {
      rejectStartOnTerminalError = reject;
    });
    terminalErrorPromise.catch(() => undefined);
    if (listenerRegistrationError) {
      throw listenerRegistrationError;
    }
    const requestBody = await normalizeDesktopRequestBody(init.body, init.signal);
    if (terminalError) {
      throw terminalError;
    }
    if (didSettle) {
      return await terminalErrorPromise;
    }

    const startRequestPromise = aiProvider.startRequest(requestId, {
      url,
      method: init.method,
      headers: init.headers,
      ...requestBody,
    });
    startRequestPromise.catch(() => undefined);

    const metadata = await Promise.race([startRequestPromise, terminalErrorPromise]);
    throwIfAborted(init.signal);
    didReceiveMetadata = true;
    rejectStartOnTerminalError = null;

    return new Response(body, {
      status: metadata.status,
      statusText: metadata.statusText,
      headers: new Headers(metadata.headers),
    });
  } catch (error) {
    didSettle = true;
    cleanup();
    throw error;
  }
}

function createRequestId(): string {
  return `provider-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
