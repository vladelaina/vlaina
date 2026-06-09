import { MANAGED_AUTH_REQUIRED_ERROR } from './constants';

const MAX_MANAGED_ERROR_BODY_BYTES = 64 * 1024;
export const MAX_MANAGED_SERVICE_ERROR_MESSAGE_CHARS = 8192;

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
  if (typeof error === 'string') {
    return error.trim().slice(0, MAX_MANAGED_SERVICE_ERROR_MESSAGE_CHARS);
  }

  if (error instanceof Error) {
    return error.message.trim().slice(0, MAX_MANAGED_SERVICE_ERROR_MESSAGE_CHARS);
  }

  if (error && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string') {
    return (error as { message: string }).message.trim().slice(0, MAX_MANAGED_SERVICE_ERROR_MESSAGE_CHARS);
  }

  return String(error ?? '').trim().slice(0, MAX_MANAGED_SERVICE_ERROR_MESSAGE_CHARS);
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
  if (typeof payload.errorCode === 'string' && payload.errorCode.trim()) {
    return payload.errorCode.trim();
  }

  const nestedError = payload.error;
  if (nestedError && typeof nestedError === 'object') {
    const nested = nestedError as Record<string, unknown>;
    if (typeof nested.code === 'string' && nested.code.trim()) {
      return nested.code.trim();
    }
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

async function readManagedErrorBody(response: Response): Promise<string> {
  if (!response.body) {
    return '';
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytesRead = 0;
  let text = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
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

    return text + decoder.decode();
  } catch {
    return '';
  } finally {
    reader.releaseLock();
  }
}

export async function parseManagedError(response: Response): Promise<Error> {
  if (response.status === 401) {
    return createManagedServiceError(MANAGED_AUTH_REQUIRED_ERROR, response.status);
  }

  const raw = await readManagedErrorBody(response);
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
    const message = extractManagedErrorPayloadMessage(payload).trim();
    if (message) {
      return createManagedServiceError(`Managed API request failed: HTTP ${response.status}`, response.status, errorCode);
    }
  } catch {}

  return createManagedServiceError(`Managed API request failed: HTTP ${response.status}`, response.status);
}
