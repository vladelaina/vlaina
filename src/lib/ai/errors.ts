import { AIError, AIErrorType } from './types';
import { translate } from '@/lib/i18n';

export interface UserFacingAIError {
  type: AIErrorType
  code: string
  message: string
}

export const MAX_USER_FACING_AI_ERROR_MESSAGE_CHARS = 8192
export const MAX_USER_FACING_AI_ERROR_CODE_CHARS = 512

const UNSUPPORTED_MODEL_INPUT_CODES = new Set([
  'unsupported_message_content',
  'unsupported_model_input',
])
const KNOWN_MANAGED_BUSINESS_ERRORS = [
  'Points exhausted',
  'No active points balance',
  'Insufficient remaining points',
]

const MANAGED_UPSTREAM_UNAVAILABLE_CODES = new Set([
  'upstream_unavailable',
  'UPSTREAM_UNAVAILABLE',
])
const MANAGED_UPSTREAM_RATE_LIMITED_CODES = new Set([
  'upstream_rate_limited',
  'UPSTREAM_RATE_LIMITED',
])
const MANAGED_QUOTA_EXHAUSTED_CODES = new Set([
  'points_exhausted',
  'inactive_points',
  'insufficient_points',
])
const MANAGED_INVALID_REQUEST_CODES = new Set([
  'invalid_request',
  'INVALID_REQUEST',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function primitiveToString(value: unknown): string {
  switch (typeof value) {
    case 'string':
      return value
    case 'number':
    case 'boolean':
    case 'bigint':
    case 'symbol':
      return String(value)
    default:
      return ''
  }
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.slice(0, MAX_USER_FACING_AI_ERROR_MESSAGE_CHARS)
  }

  if (isRecord(error) && typeof error.message === 'string') {
    return error.message.slice(0, MAX_USER_FACING_AI_ERROR_MESSAGE_CHARS)
  }

  return primitiveToString(error).slice(0, MAX_USER_FACING_AI_ERROR_MESSAGE_CHARS)
}

function extractErrorDetails(error: unknown): string {
  if (!isRecord(error)) {
    return ''
  }

  const details = error.details
  return typeof details === 'string' ? details.slice(0, MAX_USER_FACING_AI_ERROR_MESSAGE_CHARS) : ''
}

function extractErrorCode(error: unknown): string {
  const message = extractErrorMessage(error)
  if (!isRecord(error)) {
    const statusMatch = message.match(/\b(?:status|http)\s+(\d{3})\b/i)
    return statusMatch?.[1] || extractMachineErrorCodeFromMessage(message)
  }

  for (const key of ['errorCode', 'code'] as const) {
    const codeValue = error[key]
    if (typeof codeValue === 'string' && codeValue.length <= MAX_USER_FACING_AI_ERROR_CODE_CHARS) {
      const trimmed = codeValue.trim()
      if (trimmed) {
        return trimmed
      }
    }
  }

  const value = error.statusCode ?? error.status
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }
  if (typeof value === 'string' && value.length <= MAX_USER_FACING_AI_ERROR_CODE_CHARS) {
    const trimmed = value.trim()
    if (trimmed) {
      return trimmed
    }
  }

  const statusMatch = message.match(/\b(?:status|http)\s+(\d{3})\b/i)
  return statusMatch?.[1] || extractMachineErrorCodeFromMessage(message)
}

function stripErrorPrefix(message: string): string {
  let next = normalizeUserFacingMessage(message)
  for (let index = 0; index < 3; index += 1) {
    const stripped = next.replace(/^Error:\s*/i, '').trim()
    if (stripped === next) break
    next = stripped
  }
  return next
}

function extractMachineErrorCodeFromMessage(message: string): string {
  const normalized = normalizeUserFacingMessage(message)
  const candidates = [normalized]
  const ipcMatch = normalized.match(/^Error invoking remote method '[^']+':\s*(.+)$/i)
  if (ipcMatch?.[1]) {
    candidates.push(ipcMatch[1])
  }

  for (const candidate of candidates) {
    const inner = stripErrorPrefix(candidate)
    if (/^[A-Z][A-Z0-9_]{2,}$/.test(inner)) {
      return inner.toLowerCase()
    }
  }

  return ''
}

function inferErrorTypeByStatus(code: string): AIErrorType | null {
  const status = Number(code)
  if (!Number.isFinite(status)) {
    return null
  }

  switch (status) {
    case 400:
      return AIErrorType.INVALID_REQUEST
    case 401:
      return AIErrorType.AUTH_ERROR
    case 408:
      return AIErrorType.TIMEOUT
    case 429:
      return AIErrorType.RATE_LIMIT
    case 500:
    case 502:
    case 503:
    case 504:
    case 520:
    case 521:
    case 522:
    case 523:
    case 524:
      return AIErrorType.SERVER_ERROR
    default:
      return null
  }
}

function includesAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword))
}

function normalizeUserFacingMessage(message: string): string {
  return message.replace(/\s+/g, ' ').trim()
}

function isLikelyHtmlErrorDocument(message: string): boolean {
  const normalized = message.slice(0, 2000).trim().toLowerCase()
  const hasCloudflareErrorShell =
    normalized.includes('cloudflare') &&
    (normalized.includes('error code') ||
      normalized.includes('cf-wrapper') ||
      normalized.includes('performance & security by'))
  return (
    normalized.startsWith('<!doctype html') ||
    normalized.startsWith('<html') ||
    normalized.includes('<title>') ||
    hasCloudflareErrorShell ||
    normalized.includes('error code 524')
  )
}

function isLowSignalServerMessage(message: string): boolean {
  const normalized = normalizeUserFacingMessage(message).toLowerCase()
  if (!normalized) {
    return true
  }

  if (/^http\s+\d{3}\s+error$/i.test(normalized)) {
    return true
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
  ])
}

function inferErrorTypeByMessage(message: string): AIErrorType {
  const normalized = message.trim().toLowerCase()
  if (!normalized) {
    return AIErrorType.UNKNOWN
  }

  if (
    includesAny(normalized, [
      'timeout',
      'timed out',
      'deadline exceeded',
      'request timeout',
      'operation was aborted',
      'the ai request timed out',
    ])
  ) {
    return AIErrorType.TIMEOUT
  }

  if (
    includesAny(normalized, [
      'failed to fetch',
      'fetch failed',
      'load failed',
      'error sending request',
      'sending request for url',
      'networkerror',
      'network error',
      'network request failed',
      'internet disconnected',
      'connection reset',
      'connection refused',
      'econnreset',
      'econnrefused',
      'enotfound',
      'socket hang up',
    ])
  ) {
    return AIErrorType.NETWORK_ERROR
  }

  if (
    includesAny(normalized, [
      'unauthorized',
      'forbidden',
      'sign-in required',
      'sign in required',
      'login required',
      'log in required',
      'authentication',
      'authorization',
      'unauthenticated',
      'missing session token',
      'invalid session token',
      'session verification failed',
      'session expired',
      'managed api session expired',
      'vlaina sign-in required',
      'token expired',
    ])
  ) {
    return AIErrorType.AUTH_ERROR
  }

  if (
    includesAny(normalized, [
      'rate limit',
      'too many requests',
      'quota exceeded',
      'request limit',
    ])
  ) {
    return AIErrorType.RATE_LIMIT
  }

  if (
    includesAny(normalized, [
      'invalid request',
      'bad request',
      'invalid input',
      'malformed',
      'text-only',
      'text only',
      'unsupported',
    ])
  ) {
    return AIErrorType.INVALID_REQUEST
  }

  if (
    includesAny(normalized, [
      'server error',
      'internal server error',
      'service unavailable',
      'temporarily unavailable',
      'bad gateway',
      'gateway timeout',
      'upstream',
      'channel',
      'provider',
    ])
  ) {
    return AIErrorType.SERVER_ERROR
  }

  return AIErrorType.UNKNOWN
}

function getUserFacingMessage(type: AIErrorType): string {
  switch (type) {
    case AIErrorType.NETWORK_ERROR:
      return translate('chat.error.network')
    case AIErrorType.TIMEOUT:
      return translate('chat.error.timeout')
    case AIErrorType.AUTH_ERROR:
      return translate('chat.error.authExpired')
    case AIErrorType.QUOTA_EXHAUSTED:
      return translate('chat.error.pointsExhausted')
    case AIErrorType.RATE_LIMIT:
      return translate('chat.error.upstreamRateLimited')
    case AIErrorType.INVALID_REQUEST:
      return translate('chat.error.upstreamUnavailable')
    case AIErrorType.SERVER_ERROR:
    case AIErrorType.UNKNOWN:
    default:
      return translate('chat.error.upstreamUnavailable')
  }
}

function shouldPreserveOriginalMessage(type: AIErrorType, message: string): boolean {
  const normalized = normalizeUserFacingMessage(message)
  if (!normalized) {
    return false
  }

  switch (type) {
    case AIErrorType.NETWORK_ERROR:
      if (normalized.toLowerCase().startsWith('managed api request failed')) {
        return false
      }
      return ![
        'failed to fetch',
        'fetch failed',
        'network error',
        'network request failed',
      ].includes(normalized.toLowerCase())
    case AIErrorType.TIMEOUT:
    case AIErrorType.AUTH_ERROR:
    case AIErrorType.QUOTA_EXHAUSTED:
      return false
    case AIErrorType.RATE_LIMIT:
    case AIErrorType.INVALID_REQUEST:
      return true
    case AIErrorType.SERVER_ERROR:
    case AIErrorType.UNKNOWN:
    default:
      return !isLowSignalServerMessage(normalized)
  }
}

function getSpecificUserFacingOverride(message: string, code: string): UserFacingAIError | null {
  const normalized = normalizeUserFacingMessage(message).toLowerCase()
  const normalizedCode = code.trim()
  const normalizedCodeLower = normalizedCode.toLowerCase()

  if (normalized === 'web search is unavailable for this model.') {
    return {
      type: AIErrorType.INVALID_REQUEST,
      code: normalizedCode,
      message: translate('chat.webSearch.unavailableForModel'),
    }
  }

  if (
    normalized === 'unsupported_model_input' ||
    normalized === 'unsupported_message_content' ||
    UNSUPPORTED_MODEL_INPUT_CODES.has(normalizedCodeLower)
  ) {
    return {
      type: AIErrorType.INVALID_REQUEST,
      code: normalizedCode || 'unsupported_model_input',
      message: translate('chat.error.managedTextOnly'),
    }
  }

  if (
    normalized === 'invalid_request' ||
    MANAGED_INVALID_REQUEST_CODES.has(normalizedCode) ||
    MANAGED_INVALID_REQUEST_CODES.has(normalizedCodeLower)
  ) {
    return {
      type: AIErrorType.INVALID_REQUEST,
      code: normalizedCode || 'invalid_request',
      message: getUserFacingMessage(AIErrorType.INVALID_REQUEST),
    }
  }

  if (
    MANAGED_UPSTREAM_RATE_LIMITED_CODES.has(message) ||
    MANAGED_UPSTREAM_RATE_LIMITED_CODES.has(normalizedCode) ||
    normalized === 'upstream_rate_limited'
  ) {
    return {
      type: AIErrorType.RATE_LIMIT,
      code: normalizedCode || 'upstream_rate_limited',
      message: translate('chat.error.upstreamRateLimited'),
    }
  }

  if (
    MANAGED_UPSTREAM_UNAVAILABLE_CODES.has(message) ||
    MANAGED_UPSTREAM_UNAVAILABLE_CODES.has(normalizedCode) ||
    normalized === 'upstream_unavailable'
  ) {
    return {
      type: AIErrorType.SERVER_ERROR,
      code: normalizedCode || 'upstream_unavailable',
      message: translate('chat.error.upstreamUnavailable'),
    }
  }

  for (const knownMessage of KNOWN_MANAGED_BUSINESS_ERRORS) {
    if (
      normalized.includes(knownMessage.toLowerCase()) ||
      MANAGED_QUOTA_EXHAUSTED_CODES.has(normalizedCode)
    ) {
      return {
        type: AIErrorType.QUOTA_EXHAUSTED,
        code: code || 'quota_exhausted',
        message: translate('chat.error.pointsExhausted'),
      }
    }
  }

  if (
    normalized.includes('managed api failed with status 403') &&
    (normalized.includes('bad_response_status_code') || normalized.includes('openai_error'))
  ) {
    return {
      type: AIErrorType.SERVER_ERROR,
      code: '403',
      message: translate('chat.error.upstreamUnavailable'),
    }
  }

  return null
}

export function createAIError(
  type: AIErrorType,
  message: string,
  details?: string,
  statusCode?: number
): AIError {
  return { type, message, details, statusCode }
}

export function parseAPIError(error: any): AIError {
  if (isRecord(error) && typeof error.type === 'string' && typeof error.message === 'string') {
    if (Object.values(AIErrorType).includes(error.type as AIErrorType)) {
      return createAIError(
        error.type as AIErrorType,
        error.message,
        typeof error.details === 'string' ? error.details : undefined,
        typeof error.statusCode === 'number' ? error.statusCode : undefined
      )
    }
  }

  if (error instanceof Error || (isRecord(error) && typeof error.message === 'string')) {
    const message = typeof error.message === 'string' ? error.message : ''
    const lowerMsg = message.toLowerCase();
    const errorName = isRecord(error) && typeof error.name === 'string'
      ? error.name
      : '';

    let type = inferErrorTypeByMessage(message);
    if (
      type === AIErrorType.UNKNOWN &&
      (lowerMsg.includes('timeout') || lowerMsg.includes('abort') || errorName === 'AbortError')
    ) {
      type = AIErrorType.TIMEOUT;
    }

    return createAIError(type, message);
  }

  return createAIError(
    AIErrorType.UNKNOWN,
    primitiveToString(error) || 'Unknown error'
  );
}

function extractHTTPErrorMessage(body: any): string | undefined {
  if (typeof body === 'string' && body.trim()) {
    const trimmed = body.trim()
    return isLikelyHtmlErrorDocument(trimmed) ? undefined : trimmed
  }

  if (!isRecord(body)) {
    return undefined
  }

  const nestedError = body.error
  if (typeof nestedError === 'string' && nestedError.trim()) {
    return nestedError.trim()
  }
  if (isRecord(nestedError)) {
    const nestedMessage =
      typeof nestedError.message === 'string' && nestedError.message.trim()
        ? nestedError.message.trim()
        : typeof nestedError.error === 'string' && nestedError.error.trim()
          ? nestedError.error.trim()
          : ''
    if (nestedMessage) {
      return nestedMessage
    }
  }

  for (const key of ['message', 'msg', 'detail', 'error_description'] as const) {
    const value = body[key]
    if (typeof value === 'string' && value.trim()) {
      const trimmed = value.trim()
      return isLikelyHtmlErrorDocument(trimmed) ? undefined : trimmed
    }
  }

  return undefined
}

export function parseHTTPError(status: number, body?: any): AIError {
  const apiMessage = extractHTTPErrorMessage(body);

  switch (status) {
    case 401:
      return createAIError(
        AIErrorType.AUTH_ERROR,
        apiMessage || translate('chat.error.authFailed'),
        undefined,
        status
      )
    case 403: {
      const inferredType = apiMessage ? inferErrorTypeByMessage(apiMessage) : AIErrorType.UNKNOWN
      return createAIError(
        inferredType === AIErrorType.AUTH_ERROR ? AIErrorType.AUTH_ERROR : AIErrorType.SERVER_ERROR,
        apiMessage || translate('chat.error.upstreamUnavailable'),
        undefined,
        status
      )
    }
    case 429:
      return createAIError(
        AIErrorType.RATE_LIMIT,
        apiMessage || translate('chat.error.upstreamRateLimited'),
        undefined,
        status
      )
    case 400:
      return createAIError(
        AIErrorType.INVALID_REQUEST,
        apiMessage || translate('chat.error.invalidRequest'),
        undefined,
        status
      )
    case 500:
    case 502:
    case 503:
    case 504:
      return createAIError(
        AIErrorType.SERVER_ERROR,
        apiMessage || translate('chat.error.upstreamUnavailable'),
        undefined,
        status
      )
    default:
      return createAIError(
        AIErrorType.UNKNOWN,
        apiMessage || translate('chat.error.upstreamUnavailable'),
        undefined,
        status
      )
  }
}

export function getUserFacingAIError(error: unknown): UserFacingAIError {
  const parsed = parseAPIError(error)
  const message = normalizeUserFacingMessage(extractErrorMessage(error))
  const details = normalizeUserFacingMessage(extractErrorDetails(error))
  const displayMessage = details || message
  const code = extractErrorCode(error) || (parsed.statusCode ? String(parsed.statusCode) : '')
  const specificOverride = getSpecificUserFacingOverride(displayMessage, code)
  if (specificOverride) {
    return specificOverride
  }

  const statusType = inferErrorTypeByStatus(code)
  const messageType = inferErrorTypeByMessage(displayMessage)

  let type = parsed.type
  if (statusType) {
    type = statusType
  } else if (type === AIErrorType.UNKNOWN && messageType !== AIErrorType.UNKNOWN) {
    type = messageType
  }

  const normalizedType = type === AIErrorType.UNKNOWN ? AIErrorType.SERVER_ERROR : type

  return {
    type: normalizedType,
    code,
    message: shouldPreserveOriginalMessage(normalizedType, displayMessage)
      ? displayMessage
      : getUserFacingMessage(normalizedType),
  }
}
