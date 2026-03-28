import { AIError, AIErrorType } from './types';

export interface UserFacingAIError {
  type: AIErrorType
  code: string
  message: string
}

const NETWORK_ERROR_MESSAGE = 'Network connection error. Please check your connection and try again.'
const TIMEOUT_ERROR_MESSAGE = 'The request timed out. Please try again later.'
const AUTH_ERROR_MESSAGE = 'Your sign-in session has expired. Please sign in again and try again.'
const RATE_LIMIT_ERROR_MESSAGE = 'Too many requests. Please try again later.'
const INVALID_REQUEST_ERROR_MESSAGE = 'This request could not be processed. Please adjust your input or switch models and try again.'
const MODEL_SERVICE_ERROR_MESSAGE = 'The model service is temporarily unavailable. Please try again later or switch to another model.'
const UPSTREAM_FORBIDDEN_MESSAGE =
  'The upstream AI provider rejected this request (HTTP 403). Check the channel API key, model access, account balance, or provider risk controls.'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  if (isRecord(error) && typeof error.message === 'string') {
    return error.message
  }

  return String(error || '')
}

function extractErrorCode(error: unknown): string {
  if (!isRecord(error)) {
    const matched = extractErrorMessage(error).match(/\b(?:status|http)\s+(\d{3})\b/i)
    return matched?.[1] || ''
  }

  const value = error.statusCode ?? error.status
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }
  if (typeof value === 'string' && value.trim()) {
    return value.trim()
  }

  const matched = extractErrorMessage(error).match(/\b(?:status|http)\s+(\d{3})\b/i)
  return matched?.[1] || ''
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
    case 403:
      return AIErrorType.AUTH_ERROR
    case 408:
      return AIErrorType.TIMEOUT
    case 429:
      return AIErrorType.RATE_LIMIT
    case 500:
    case 502:
    case 503:
    case 504:
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

function isLowSignalServerMessage(message: string): boolean {
  const normalized = normalizeUserFacingMessage(message).toLowerCase()
  if (!normalized) {
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
      'session expired',
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
      return NETWORK_ERROR_MESSAGE
    case AIErrorType.TIMEOUT:
      return TIMEOUT_ERROR_MESSAGE
    case AIErrorType.AUTH_ERROR:
      return AUTH_ERROR_MESSAGE
    case AIErrorType.RATE_LIMIT:
      return RATE_LIMIT_ERROR_MESSAGE
    case AIErrorType.INVALID_REQUEST:
      return INVALID_REQUEST_ERROR_MESSAGE
    case AIErrorType.SERVER_ERROR:
    case AIErrorType.UNKNOWN:
    default:
      return MODEL_SERVICE_ERROR_MESSAGE
  }
}

function shouldPreserveOriginalMessage(type: AIErrorType, message: string): boolean {
  const normalized = normalizeUserFacingMessage(message)
  if (!normalized) {
    return false
  }

  switch (type) {
    case AIErrorType.NETWORK_ERROR:
    case AIErrorType.TIMEOUT:
    case AIErrorType.AUTH_ERROR:
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

function getSpecificUserFacingOverride(message: string): UserFacingAIError | null {
  const normalized = normalizeUserFacingMessage(message).toLowerCase()

  if (
    normalized.includes('managed api failed with status 403') &&
    (normalized.includes('bad_response_status_code') || normalized.includes('openai_error'))
  ) {
    return {
      type: AIErrorType.SERVER_ERROR,
      code: '403',
      message: UPSTREAM_FORBIDDEN_MESSAGE,
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
  if (error && typeof error === 'object' && 'type' in error && 'message' in error) {
      return error as AIError;
  }

  if (error instanceof Error) {
    const message = error.message;
    const lowerMsg = message.toLowerCase();
    
    let type = AIErrorType.UNKNOWN;
    if (lowerMsg.includes('timeout') || lowerMsg.includes('abort')) {
        type = AIErrorType.TIMEOUT;
    } else if (error instanceof TypeError && lowerMsg.includes('fetch')) {
        type = AIErrorType.NETWORK_ERROR;
    }

    return createAIError(type, message);
  }

  return createAIError(
    AIErrorType.UNKNOWN,
    String(error) || 'Unknown error'
  );
}

export function parseHTTPError(status: number, body?: any): AIError {
  const apiMessage = body?.error?.message || body?.message;

  switch (status) {
    case 401:
    case 403:
      return createAIError(
        AIErrorType.AUTH_ERROR,
        apiMessage || 'Invalid API key or unauthorized access.',
        undefined,
        status
      )
    case 429:
      return createAIError(
        AIErrorType.RATE_LIMIT,
        apiMessage || 'Rate limit exceeded. Please try again later.',
        undefined,
        status
      )
    case 400:
      return createAIError(
        AIErrorType.INVALID_REQUEST,
        apiMessage || 'Invalid request. Please check your input.',
        undefined,
        status
      )
    case 500:
    case 502:
    case 503:
    case 504:
      return createAIError(
        AIErrorType.SERVER_ERROR,
        apiMessage || 'Server error. Please try again later.',
        undefined,
        status
      )
    default:
      return createAIError(
        AIErrorType.UNKNOWN,
        apiMessage || `HTTP ${status} Error`,
        undefined,
        status
      )
  }
}

export function getUserFacingAIError(error: unknown): UserFacingAIError {
  const parsed = parseAPIError(error)
  const message = normalizeUserFacingMessage(extractErrorMessage(error))
  const specificOverride = getSpecificUserFacingOverride(message)
  if (specificOverride) {
    return specificOverride
  }

  const code = extractErrorCode(error) || (parsed.statusCode ? String(parsed.statusCode) : '')
  const statusType = inferErrorTypeByStatus(code)
  const messageType = inferErrorTypeByMessage(message)

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
    message: shouldPreserveOriginalMessage(normalizedType, message)
      ? message
      : getUserFacingMessage(normalizedType),
  }
}
