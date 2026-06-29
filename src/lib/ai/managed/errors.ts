import { MANAGED_AUTH_REQUIRED_ERROR } from './constants';

const MAX_MANAGED_ERROR_BODY_BYTES = 64 * 1024;
export const MAX_MANAGED_SERVICE_ERROR_MESSAGE_CHARS = 8192;
const MAX_MANAGED_SERVICE_ERROR_CODE_CHARS = 512;

function createAbortError(): DOMException {
  return new DOMException('Aborted', 'AbortError');
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  throw createAbortError();
}

function raceWithAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) {
    return promise;
  }
  throwIfAborted(signal);
  promise.catch(() => undefined);

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      signal.removeEventListener('abort', abort);
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

function createManagedServiceError(
  message: string,
  statusCode: number,
  errorCode?: string
): Error {
  const error = new Error(message);
  (error as Error & { statusCode?: number; errorCode?: string }).statusCode = statusCode;
  if (errorCode) {
    (error as Error & { statusCode?: number; errorCode?: string }).errorCode = errorCode;
  }
  return error;
}

export function getManagedServiceErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return normalizeManagedErrorText(error.message);
  }

  if (error && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string') {
    return normalizeManagedErrorText((error as { message: string }).message);
  }

  return normalizeManagedErrorText(error);
}

function normalizeManagedErrorText(value: unknown): string {
  switch (typeof value) {
    case 'string':
      return value.slice(0, MAX_MANAGED_SERVICE_ERROR_MESSAGE_CHARS).trim();
    case 'number':
    case 'boolean':
    case 'bigint':
    case 'symbol':
      return String(value).slice(0, MAX_MANAGED_SERVICE_ERROR_MESSAGE_CHARS).trim();
    default:
      return '';
  }
}

function normalizeManagedErrorCode(value: unknown): string {
  if (typeof value !== 'string' || value.length > MAX_MANAGED_SERVICE_ERROR_CODE_CHARS) {
    return '';
  }
  return value.trim();
}

export function isManagedServiceRecoverableError(error: unknown): boolean {
  const message = getManagedServiceErrorMessage(error);
  if (!message) return false;

  if (message === MANAGED_AUTH_REQUIRED_ERROR) {
    return true;
  }

  const normalized = message.toLowerCase();
  return (
    normalized.includes('failed to fetch') ||
    normalized.includes('fetch failed') ||
    normalized.includes('networkerror') ||
    normalized.includes('load failed') ||
    normalized.includes('error sending request') ||
    normalized.includes('timed out') ||
    normalized.includes('etimedout') ||
    normalized.includes('aborterror')
  );
}

function extractManagedErrorPayloadMessage(payload: Record<string, unknown>): string {
  const nestedError = payload.error;
  if (typeof nestedError === 'string') {
    return nestedError;
  }
  if (nestedError && typeof nestedError === 'object') {
    const nested = nestedError as Record<string, unknown>;
    if (typeof nested.message === 'string') {
      return nested.message;
    }
    if (typeof nested.error === 'string') {
      return nested.error;
    }
  }

  for (const key of ['message', 'msg', 'detail', 'error_description'] as const) {
    const value = payload[key];
    if (typeof value === 'string') {
      return value;
    }
  }

  if (typeof payload.errorCode === 'string') {
    return payload.errorCode;
  }

  return '';
}

function extractManagedErrorPayloadCode(payload: Record<string, unknown>): string {
  const errorCode = normalizeManagedErrorCode(payload.errorCode);
  if (errorCode) return errorCode;

  const nestedError = payload.error;
  if (nestedError && typeof nestedError === 'object') {
    const nested = nestedError as Record<string, unknown>;
    return normalizeManagedErrorCode(nested.code) || normalizeManagedErrorCode(nested.type);
  }

  return '';
}

function messageForManagedErrorCode(errorCode: string): string {
  switch (errorCode.trim().toLowerCase()) {
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
      return '';
  }
}

async function readManagedErrorBody(response: Response, signal?: AbortSignal): Promise<string> {
  throwIfAborted(signal);
  if (!response.body) {
    return '';
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
      if (bytesRead > MAX_MANAGED_ERROR_BODY_BYTES) {
        void reader.cancel().catch(() => undefined);
        return '';
      }
      text += decoder.decode(value, { stream: true });
    }

    const result = text + decoder.decode();
    throwIfAborted(signal);
    return result;
  } catch {
    if (signal?.aborted) {
      throw createAbortError();
    }
    return '';
  } finally {
    signal?.removeEventListener('abort', cancelReader);
    reader.releaseLock();
  }
}

export async function parseManagedError(response: Response, signal?: AbortSignal): Promise<Error> {
  if (response.status === 401) {
    return createManagedServiceError(MANAGED_AUTH_REQUIRED_ERROR, response.status);
  }

  const raw = await readManagedErrorBody(response, signal);
  if (!raw) {
    return createManagedServiceError(`Managed API request failed: HTTP ${response.status}`, response.status);
  }

  try {
    const payload = JSON.parse(raw) as Record<string, unknown>;
    const errorCode = extractManagedErrorPayloadCode(payload);
    const codedMessage = messageForManagedErrorCode(errorCode);
    if (codedMessage) {
      return createManagedServiceError(codedMessage, response.status, errorCode);
    }
    const message = normalizeManagedErrorText(extractManagedErrorPayloadMessage(payload));
    if (message) {
      return createManagedServiceError(`Managed API request failed: HTTP ${response.status}`, response.status, errorCode);
    }
  } catch {}

  return createManagedServiceError(`Managed API request failed: HTTP ${response.status}`, response.status);
}
