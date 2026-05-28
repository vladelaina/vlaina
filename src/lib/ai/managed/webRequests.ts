import { MANAGED_API_BASE } from './constants';
import { parseManagedError } from './errors';
import { consumeOpenAIStream } from '@/lib/ai/streaming';

const MANAGED_JSON_TIMEOUT_MS = 30_000;
const MANAGED_STREAM_TIMEOUT_MS = 300_000;
const MANAGED_GET_RETRY_DELAYS_MS = [300];
const MANAGED_FAST_FAILURE_RETRY_WINDOW_MS = 2000;

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
  return error instanceof Error && error.name === 'AbortError';
}

function delayManagedRetry(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) {
    return Promise.reject(new DOMException('Aborted', 'AbortError'));
  }

  return new Promise((resolve, reject) => {
    let timeout: ReturnType<typeof setTimeout>;
    const abort = () => {
      clearTimeout(timeout);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    const complete = () => {
      signal.removeEventListener('abort', abort);
      resolve();
    };
    signal.addEventListener('abort', abort, { once: true });
    timeout = setTimeout(complete, ms);
  });
}

async function fetchManagedJsonWithRetry(
  url: string,
  init: RequestInit,
  signal: AbortSignal
): Promise<Response> {
  const method = String(init.method ?? 'GET').toUpperCase();
  const shouldRetry = method === 'GET';
  for (let attempt = 0; ; attempt += 1) {
    const startedAt = Date.now();
    try {
      return await fetch(url, init);
    } catch (error) {
      const retryDelayMs = shouldRetry ? MANAGED_GET_RETRY_DELAYS_MS[attempt] : undefined;
      const failedQuickly = Date.now() - startedAt <= MANAGED_FAST_FAILURE_RETRY_WINDOW_MS;
      if (isAbortError(error) || signal.aborted || retryDelayMs == null || !failedQuickly) {
        throw error;
      }
      await delayManagedRetry(retryDelayMs, signal);
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

  const combinedSignal = fetchInit.signal
    ? AbortSignal.any([fetchInit.signal, timeoutController.signal])
    : timeoutController.signal;

  try {
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
    const response = await fetchManagedJsonWithRetry(`${MANAGED_API_BASE}${path}`, requestInit, combinedSignal);

    if (!response.ok) {
      throw await parseManagedError(response);
    }

    return response.json() as Promise<T>;
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
    const response = await fetch(`${MANAGED_API_BASE}${path}`, {
      method: 'POST',
      cache: 'no-store',
      credentials: 'include',
      signal: combinedSignal,
      headers: {
        Accept: 'application/json',
        ...headers,
      },
      body,
    });

    if (!response.ok) {
      throw await parseManagedError(response);
    }

    return response.json() as Promise<T>;
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
    const response = await fetch(`${MANAGED_API_BASE}${path}`, {
      method: 'POST',
      cache: 'no-store',
      credentials: 'include',
      signal: combinedSignal,
      headers: {
        Accept: 'text/event-stream',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw await parseManagedError(response);
    }

    if (!response.body) {
      throw new Error('Managed API response body is null');
    }

    return await consumeOpenAIStream(response, onChunk, {
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
  } finally {
    clearTimeout(timer);
  }
}
