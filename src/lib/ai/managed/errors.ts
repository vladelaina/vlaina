import { MANAGED_AUTH_REQUIRED_ERROR } from './constants';

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
    return error.trim();
  }

  if (error instanceof Error) {
    return error.message.trim();
  }

  if (error && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string') {
    return (error as { message: string }).message.trim();
  }

  return String(error ?? '').trim();
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

export async function parseManagedError(response: Response): Promise<Error> {
  const raw = await response.text().catch(() => '');
  if (response.status === 401) {
    return createManagedServiceError(MANAGED_AUTH_REQUIRED_ERROR, response.status);
  }

  if (!raw) {
    return createManagedServiceError(`Managed API request failed: HTTP ${response.status}`, response.status);
  }

  try {
    const payload = JSON.parse(raw) as Record<string, unknown>;
    const message = extractManagedErrorPayloadMessage(payload).trim();
    const errorCode = extractManagedErrorPayloadCode(payload);
    if (message) {
      return createManagedServiceError(message, response.status, errorCode);
    }
  } catch {}

  return createManagedServiceError(raw, response.status);
}
