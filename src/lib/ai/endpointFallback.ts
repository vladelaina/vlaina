import { parseAPIError } from './errors';
import { AIErrorType, type AIModel, type Provider } from './types';

const MAX_ENDPOINT_ERROR_STATUS_STRING_CHARS = 16;
const MAX_ENDPOINT_ERROR_CODE_STRING_CHARS = 128;
const ENDPOINT_FALLBACK_STATUS_CODES = new Set([400, 404, 405, 422]);
const NON_ENDPOINT_DISCOVERY_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);
const NON_ENDPOINT_FALLBACK_ERROR_CODES = new Set([
  'upstream_rate_limited',
  'points_exhausted',
  'inactive_points',
  'insufficient_points',
]);
const TRANSIENT_PRE_STREAM_STATUS_CODES = new Set([408, 500, 502, 503, 504]);

export type EndpointType = NonNullable<Provider['endpointType']>;

export function extractEndpointStatusCode(error: unknown): number | null {
  if (!error || typeof error !== 'object') {
    return null;
  }

  const value = (error as { statusCode?: unknown; status?: unknown }).statusCode
    ?? (error as { status?: unknown }).status;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.length <= MAX_ENDPOINT_ERROR_STATUS_STRING_CHARS) {
    const trimmed = value.trim();
    if (!/^\d{3}$/.test(trimmed)) {
      return null;
    }
    return Number.parseInt(trimmed, 10);
  }

  return null;
}

export function extractEndpointErrorCode(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return '';
  }

  const value = (error as { errorCode?: unknown; code?: unknown }).errorCode
    ?? (error as { code?: unknown }).code;
  return typeof value === 'string' && value.length <= MAX_ENDPOINT_ERROR_CODE_STRING_CHARS
    ? value.trim().toLowerCase()
    : '';
}

export function isNonEndpointFallbackError(error: unknown): boolean {
  return NON_ENDPOINT_FALLBACK_ERROR_CODES.has(extractEndpointErrorCode(error));
}

export function isLikelyAnthropicModel(model: AIModel): boolean {
  const haystack = [
    model.id,
    model.apiModelId,
    model.name,
    model.group,
  ].join(' ').toLowerCase();
  return haystack.includes('claude') || haystack.includes('anthropic');
}

export function getVerifiedModelEndpointType(model: AIModel): Provider['endpointType'] | undefined {
  return model.endpointType && model.endpointTypeCheckedAt ? model.endpointType : undefined;
}

export function getVerifiedProviderEndpointType(provider: Provider): Provider['endpointType'] | undefined {
  return provider.endpointType && provider.endpointTypeCheckedAt ? provider.endpointType : undefined;
}

export function getAlternateEndpointType(endpointType: Provider['endpointType'] | undefined): EndpointType {
  return endpointType === 'anthropic' ? 'openai' : 'anthropic';
}

export function shouldTryAlternateEndpointAfterEndpointError(error: unknown): boolean {
  const statusCode = extractEndpointStatusCode(error);
  if (statusCode != null) {
    return ENDPOINT_FALLBACK_STATUS_CODES.has(statusCode);
  }

  if (isNonEndpointFallbackError(error)) {
    return false;
  }

  const parsed = parseAPIError(error);
  return parsed.type === AIErrorType.INVALID_REQUEST || parsed.type === AIErrorType.UNKNOWN;
}

export function shouldTryAnthropicEndpointDuringDiscovery(error: unknown): boolean {
  const statusCode = extractEndpointStatusCode(error);
  if (statusCode != null) {
    return !NON_ENDPOINT_DISCOVERY_STATUS_CODES.has(statusCode);
  }

  if (isNonEndpointFallbackError(error)) {
    return false;
  }

  const parsed = parseAPIError(error);
  return parsed.type !== AIErrorType.RATE_LIMIT
    && parsed.type !== AIErrorType.QUOTA_EXHAUSTED
    && parsed.type !== AIErrorType.SERVER_ERROR;
}

export function isTransientEndpointPreStreamError(error: unknown): boolean {
  const statusCode = extractEndpointStatusCode(error);
  if (statusCode != null) {
    return TRANSIENT_PRE_STREAM_STATUS_CODES.has(statusCode);
  }

  const errorCode = extractEndpointErrorCode(error);
  if (NON_ENDPOINT_FALLBACK_ERROR_CODES.has(errorCode)) {
    return false;
  }
  if (errorCode === 'upstream_unavailable') {
    return true;
  }

  const parsed = parseAPIError(error);
  return parsed.type === AIErrorType.NETWORK_ERROR
    || parsed.type === AIErrorType.TIMEOUT
    || parsed.type === AIErrorType.SERVER_ERROR;
}
