import { MANAGED_API_BASE } from './constants';
import { parseManagedError } from './errors';
import { consumeOpenAIStream } from '@/lib/ai/streaming';

const MANAGED_JSON_TIMEOUT_MS = 30_000;
const MANAGED_STREAM_TIMEOUT_MS = 300_000;
const MANAGED_GET_RETRY_DELAYS_MS = [300];
const MANAGED_FAST_FAILURE_RETRY_WINDOW_MS = 2000;
const MAX_MANAGED_JSON_RESPONSE_BODY_BYTES = 64 * 1024 * 1024;

interface ManagedJsonRequestInit extends RequestInit {
  timeoutMs?: number;
}

function publicManagedStreamErrorMessage(message: string | undefined, errorCode: string | undefined): string {
  const normalizedCode = typeof errorCode === 'string' ? errorCode.trim().toLowerCase() : '';
  switch (normalizedCode) {
    case 'points_exhausted':
    case 'inactive_points':
    case 'insufficient_points':
      return 'MANAGED_QUOTA_EXHAUSTED';
    case 'upstream_rate_limited':
      return 'UPSTREAM_RATE_LIMITED';
    case 'upstream_unavailable':
      return 'UPSTREAM_UNAVAILABLE';
    case 'unsupported_message_content':
    case 'unsupported_model_input':
      return 'UNSUPPORTED_MODEL_INPUT';
    case 'invalid_request':
      return 'INVALID_REQUEST';
    default:
      return message === 'UPSTREAM_UNAVAILABLE' || message === 'UPSTREAM_RATE_LIMITED'
        ? message
        : 'Managed API request failed: HTTP 502';
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
    || !!error && typeof error === 'object' && (error as { name?: unknown }).name === 'AbortError';
}

function createAbortError(): DOMException {
  return new DOMException('Aborted', 'AbortError');
}

function createManagedTimeoutError(): Error {
  return new Error('Managed API request timed out.');
}

function createManagedResponseTooLargeError(): Error {
  return new Error('Managed API response body is too large.');
}

function throwIfExternallyAborted(signal?: AbortSignal | null): void {
  if (!signal?.aborted) return;
  throw createAbortError();
}

function throwIfManagedRequestAborted(
  timeoutController: AbortController,
  externalSignal?: AbortSignal | null,
): void {
  if (!timeoutController.signal.aborted && !externalSignal?.aborted) return;
  throw createAbortError();
}

function normalizeManagedAbortError(
  error: unknown,
  timeoutController: AbortController,
  externalSignal?: AbortSignal | null,
): never {
  if (isAbortError(error) && timeoutController.signal.aborted && !externalSignal?.aborted) {
    throw createManagedTimeoutError();
  }
  throw error;
}

async function raceManagedRequest<T>(
  promise: Promise<T>,
  timeoutController: AbortController,
  externalSignal?: AbortSignal | null,
): Promise<T> {
  throwIfManagedRequestAborted(timeoutController, externalSignal);
  promise.catch(() => undefined);

  return await new Promise<T>((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      timeoutController.signal.removeEventListener('abort', abort);
      externalSignal?.removeEventListener('abort', abort);
    };
    const settle = (callback: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };
    const abort = () => {
      settle(() => reject(createAbortError()));
    };

    timeoutController.signal.addEventListener('abort', abort, { once: true });
    externalSignal?.addEventListener('abort', abort, { once: true });
    if (timeoutController.signal.aborted || externalSignal?.aborted) {
      abort();
      return;
    }

    promise.then(
      (value) => {
        settle(() => {
          try {
            throwIfManagedRequestAborted(timeoutController, externalSignal);
            resolve(value);
          } catch (error) {
            reject(error);
          }
        });
      },
      (error) => {
        settle(() => {
          try {
            throwIfManagedRequestAborted(timeoutController, externalSignal);
            reject(error);
          } catch (abortError) {
            reject(abortError);
          }
        });
      },
    );
  });
}

function delayManagedRetry(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) {
    return Promise.reject(createAbortError());
  }

  return new Promise((resolve, reject) => {
    let timeout: ReturnType<typeof setTimeout>;
    const abort = () => {
      clearTimeout(timeout);
      reject(createAbortError());
    };
    const complete = () => {
      signal.removeEventListener('abort', abort);
      resolve();
    };
    signal.addEventListener('abort', abort, { once: true });
    timeout = setTimeout(complete, ms);
  });
}

function readContentLength(response: Response): number | null {
  const rawContentLength = response.headers.get('content-length');
  if (!rawContentLength) {
    return null;
  }

  const parsed = Number(rawContentLength);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

async function readManagedJsonText(
  response: Response,
  timeoutController: AbortController,
  externalSignal?: AbortSignal | null,
): Promise<string> {
  throwIfManagedRequestAborted(timeoutController, externalSignal);

  const contentLength = readContentLength(response);
  if (contentLength !== null && contentLength > MAX_MANAGED_JSON_RESPONSE_BODY_BYTES) {
    void response.body?.cancel().catch(() => undefined);
    throw createManagedResponseTooLargeError();
  }

  if (!response.body) {
    return '';
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let bytesRead = 0;
  const cancelReader = () => {
    void reader.cancel(createAbortError()).catch(() => undefined);
  };
  timeoutController.signal.addEventListener('abort', cancelReader, { once: true });
  externalSignal?.addEventListener('abort', cancelReader, { once: true });

  try {
    while (true) {
      const { done, value } = await raceManagedRequest(reader.read(), timeoutController, externalSignal);
      throwIfManagedRequestAborted(timeoutController, externalSignal);
      if (done) {
        break;
      }

      bytesRead += value.byteLength;
      if (bytesRead > MAX_MANAGED_JSON_RESPONSE_BODY_BYTES) {
        void reader.cancel().catch(() => undefined);
        throw createManagedResponseTooLargeError();
      }
      chunks.push(decoder.decode(value, { stream: true }));
    }

    chunks.push(decoder.decode());
    return chunks.join('');
  } finally {
    timeoutController.signal.removeEventListener('abort', cancelReader);
    externalSignal?.removeEventListener('abort', cancelReader);
    reader.releaseLock();
  }
}

async function readManagedJson<T>(
  response: Response,
  timeoutController: AbortController,
  externalSignal?: AbortSignal | null,
): Promise<T> {
  const text = await readManagedJsonText(response, timeoutController, externalSignal);
  throwIfManagedRequestAborted(timeoutController, externalSignal);
  return JSON.parse(text) as T;
}

async function fetchManagedJsonWithRetry(
  url: string,
  init: RequestInit,
  timeoutController: AbortController,
  externalSignal?: AbortSignal | null,
): Promise<Response> {
  const method = String(init.method ?? 'GET').toUpperCase();
  const shouldRetry = method === 'GET';
  const retrySignal = init.signal ?? timeoutController.signal;
  for (let attempt = 0; ; attempt += 1) {
    const startedAt = Date.now();
    try {
      return await raceManagedRequest(fetch(url, init), timeoutController, externalSignal);
    } catch (error) {
      const retryDelayMs = shouldRetry ? MANAGED_GET_RETRY_DELAYS_MS[attempt] : undefined;
      const failedQuickly = Date.now() - startedAt <= MANAGED_FAST_FAILURE_RETRY_WINDOW_MS;
      if (retrySignal.aborted || retryDelayMs == null || !failedQuickly) {
        throw error;
      }
      await delayManagedRetry(retryDelayMs, retrySignal);
    }
  }
}

export async function requestManagedWebJson<T>(path: string, init?: ManagedJsonRequestInit): Promise<T> {
  const timeoutController = new AbortController();
  const timeoutMs = typeof init?.timeoutMs === 'number' && Number.isFinite(init.timeoutMs)
    ? Math.max(0, init.timeoutMs)
    : MANAGED_JSON_TIMEOUT_MS;
  const timer = timeoutMs > 0
    ? setTimeout(() => timeoutController.abort(), timeoutMs)
    : null;
  const fetchInit: RequestInit = { ...(init ?? {}) };
  delete (fetchInit as ManagedJsonRequestInit).timeoutMs;
  const externalSignal = fetchInit.signal;

  const combinedSignal = externalSignal
    ? AbortSignal.any([externalSignal, timeoutController.signal])
    : timeoutController.signal;

  try {
    throwIfExternallyAborted(externalSignal);
    const requestInit: RequestInit = {
      ...fetchInit,
      signal: combinedSignal,
      cache: 'no-store',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(fetchInit.body ? { 'Content-Type': 'application/json' } : {}),
        ...(fetchInit.headers ?? {}),
      },
    };
    const response = await fetchManagedJsonWithRetry(
      `${MANAGED_API_BASE}${path}`,
      requestInit,
      timeoutController,
      externalSignal,
    );
    throwIfManagedRequestAborted(timeoutController, externalSignal);

    if (!response.ok) {
      const managedError = await raceManagedRequest(
        parseManagedError(response, combinedSignal),
        timeoutController,
        externalSignal,
      );
      throwIfManagedRequestAborted(timeoutController, externalSignal);
      throw managedError;
    }

    return await readManagedJson<T>(response, timeoutController, externalSignal);
  } catch (error) {
    return normalizeManagedAbortError(error, timeoutController, externalSignal);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function requestManagedWebBinaryJson<T>(
  path: string,
  body: BodyInit,
  headers: Record<string, string>,
  signal?: AbortSignal,
  timeoutMs = MANAGED_STREAM_TIMEOUT_MS
): Promise<T> {
  const timeoutController = new AbortController();
  const timer = timeoutMs > 0
    ? setTimeout(() => timeoutController.abort(), timeoutMs)
    : null;
  const combinedSignal = signal
    ? AbortSignal.any([signal, timeoutController.signal])
    : timeoutController.signal;

  try {
    throwIfExternallyAborted(signal);
    const response = await raceManagedRequest(fetch(`${MANAGED_API_BASE}${path}`, {
      method: 'POST',
      cache: 'no-store',
      credentials: 'include',
      signal: combinedSignal,
      headers: {
        Accept: 'application/json',
        ...headers,
      },
      body,
    }), timeoutController, signal);
    throwIfManagedRequestAborted(timeoutController, signal);

    if (!response.ok) {
      const managedError = await raceManagedRequest(parseManagedError(response, combinedSignal), timeoutController, signal);
      throwIfManagedRequestAborted(timeoutController, signal);
      throw managedError;
    }

    return await readManagedJson<T>(response, timeoutController, signal);
  } catch (error) {
    return normalizeManagedAbortError(error, timeoutController, signal);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function requestManagedWebStream(
  path: string,
  body: Record<string, unknown>,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const timeoutController = new AbortController();
  const timer = setTimeout(() => timeoutController.abort(), MANAGED_STREAM_TIMEOUT_MS);
  const combinedSignal = signal
    ? AbortSignal.any([signal, timeoutController.signal])
    : timeoutController.signal;

  try {
    throwIfExternallyAborted(signal);
    const response = await raceManagedRequest(fetch(`${MANAGED_API_BASE}${path}`, {
      method: 'POST',
      cache: 'no-store',
      credentials: 'include',
      signal: combinedSignal,
      headers: {
        Accept: 'text/event-stream',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }), timeoutController, signal);
    throwIfManagedRequestAborted(timeoutController, signal);

    if (!response.ok) {
      const managedError = await raceManagedRequest(parseManagedError(response, combinedSignal), timeoutController, signal);
      throwIfManagedRequestAborted(timeoutController, signal);
      throw managedError;
    }

    if (!response.body) {
      throw new Error('Managed API response body is null');
    }

    const content = await consumeOpenAIStream(response, onChunk, {
      signal: combinedSignal,
      mapErrorPayload(message, code) {
        const error = new Error(publicManagedStreamErrorMessage(message, code)) as Error & {
          errorCode?: string;
        };
        if (typeof code === 'string' && code.trim()) {
          error.errorCode = code.trim();
        }
        return error;
      },
    });
    throwIfManagedRequestAborted(timeoutController, signal);
    return content;
  } catch (error) {
    return normalizeManagedAbortError(error, timeoutController, signal);
  } finally {
    clearTimeout(timer);
  }
}
