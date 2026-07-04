import { AIErrorType } from './types';

export {
  inferErrorTypeByMessage,
  inferErrorTypeByStatus,
} from './errorTypeInference';

export const MAX_USER_FACING_AI_ERROR_MESSAGE_CHARS = 8192;
export const MAX_USER_FACING_AI_ERROR_CODE_CHARS = 512;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function primitiveToString(value: unknown): string {
  switch (typeof value) {
    case 'string':
      return value;
    case 'number':
    case 'boolean':
    case 'bigint':
    case 'symbol':
      return String(value);
    default:
      return '';
  }
}

export function normalizeUserFacingMessage(message: string): string {
  return message.replace(/\s+/g, ' ').trim();
}

function stripErrorPrefix(message: string): string {
  let next = normalizeUserFacingMessage(message);
  for (let index = 0; index < 3; index += 1) {
    const stripped = next.replace(/^Error:\s*/i, '').trim();
    if (stripped === next) break;
    next = stripped;
  }
  return next;
}

function extractMachineErrorCodeFromMessage(message: string): string {
  const normalized = normalizeUserFacingMessage(message);
  const candidates = [normalized];
  const ipcMatch = normalized.match(/^Error invoking remote method '[^']+':\s*(.+)$/i);
  if (ipcMatch?.[1]) {
    candidates.push(ipcMatch[1]);
  }

  for (const candidate of candidates) {
    const inner = stripErrorPrefix(candidate);
    if (/^[A-Z][A-Z0-9_]{2,}$/.test(inner)) {
      return inner.toLowerCase();
    }
  }

  return '';
}

export function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.slice(0, MAX_USER_FACING_AI_ERROR_MESSAGE_CHARS);
  }

  if (isRecord(error) && typeof error.message === 'string') {
    return error.message.slice(0, MAX_USER_FACING_AI_ERROR_MESSAGE_CHARS);
  }

  return primitiveToString(error).slice(0, MAX_USER_FACING_AI_ERROR_MESSAGE_CHARS);
}

export function extractErrorDetails(error: unknown): string {
  if (!isRecord(error)) {
    return '';
  }

  const details = error.details;
  return typeof details === 'string' ? details.slice(0, MAX_USER_FACING_AI_ERROR_MESSAGE_CHARS) : '';
}

export function extractErrorCode(error: unknown): string {
  const message = extractErrorMessage(error);
  if (!isRecord(error)) {
    const statusMatch = message.match(/\b(?:status|http)\s+(\d{3})\b/i);
    return statusMatch?.[1] || extractMachineErrorCodeFromMessage(message);
  }

  for (const key of ['errorCode', 'code'] as const) {
    const codeValue = error[key];
    if (typeof codeValue === 'string' && codeValue.length <= MAX_USER_FACING_AI_ERROR_CODE_CHARS) {
      const trimmed = codeValue.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }

  const value = error.statusCode ?? error.status;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === 'string' && value.length <= MAX_USER_FACING_AI_ERROR_CODE_CHARS) {
    const trimmed = value.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  const statusMatch = message.match(/\b(?:status|http)\s+(\d{3})\b/i);
  return statusMatch?.[1] || extractMachineErrorCodeFromMessage(message);
}

function includesAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

export function isLikelyHtmlErrorDocument(message: string): boolean {
  const normalized = message.slice(0, 2000).trim().toLowerCase();
  const hasCloudflareErrorShell =
    normalized.includes('cloudflare') &&
    (normalized.includes('error code') ||
      normalized.includes('cf-wrapper') ||
      normalized.includes('performance & security by'));
  return (
    normalized.startsWith('<!doctype html') ||
    normalized.startsWith('<html') ||
    normalized.includes('<title>') ||
    hasCloudflareErrorShell ||
    normalized.includes('error code 524')
  );
}

export function isLowSignalServerMessage(message: string): boolean {
  const normalized = normalizeUserFacingMessage(message).toLowerCase();
  if (!normalized) {
    return true;
  }

  if (/^http\s+\d{3}\s+error$/i.test(normalized)) {
    return true;
  }

  return includesAny(normalized, [
    'server error',
    'internal server error',
    'service unavailable',
    'temporarily unavailable',
    'bad gateway',
    'gateway timeout',
    'upstream returned error',
    'upstream request failed',
    'managed api request failed',
    'unknown error',
    'http 500',
    'http 502',
    'http 503',
    'http 504',
  ]);
}

export function shouldPreserveOriginalMessage(type: AIErrorType, message: string): boolean {
  const normalized = normalizeUserFacingMessage(message);
  if (!normalized) {
    return false;
  }

  switch (type) {
    case AIErrorType.NETWORK_ERROR:
      if (normalized.toLowerCase().startsWith('managed api request failed')) {
        return false;
      }
      return ![
        'failed to fetch',
        'fetch failed',
        'network error',
        'network request failed',
      ].includes(normalized.toLowerCase());
    case AIErrorType.TIMEOUT:
    case AIErrorType.AUTH_ERROR:
    case AIErrorType.QUOTA_EXHAUSTED:
      return false;
    case AIErrorType.RATE_LIMIT:
    case AIErrorType.INVALID_REQUEST:
      return true;
    case AIErrorType.SERVER_ERROR:
    case AIErrorType.UNKNOWN:
    default:
      return !isLowSignalServerMessage(normalized);
  }
}
