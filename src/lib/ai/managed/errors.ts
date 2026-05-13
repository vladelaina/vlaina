import { MANAGED_AUTH_REQUIRED_ERROR } from './constants';

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

  return '';
}

export async function parseManagedError(response: Response): Promise<Error> {
  const raw = await response.text().catch(() => '');
  if (response.status === 401) {
    return new Error(MANAGED_AUTH_REQUIRED_ERROR);
  }

  if (!raw) {
    return new Error(`Managed API request failed: HTTP ${response.status}`);
  }

  try {
    const payload = JSON.parse(raw) as Record<string, unknown>;
    const message = extractManagedErrorPayloadMessage(payload).trim();
    if (message) {
      return new Error(message);
    }
  } catch {}

  return new Error(raw);
}
