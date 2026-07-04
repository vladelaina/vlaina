import { AIError, AIErrorType } from './types';
import { translate } from '@/lib/i18n';
import {
  getSpecificUserFacingOverride,
  getUserFacingMessage,
  type UserFacingAIError,
} from './userFacingErrorMessages';
import {
  extractErrorCode,
  extractErrorDetails,
  extractErrorMessage,
  inferErrorTypeByMessage,
  inferErrorTypeByStatus,
  isLikelyHtmlErrorDocument,
  isRecord,
  normalizeUserFacingMessage,
  primitiveToString,
  shouldPreserveOriginalMessage,
} from './errorClassification';

export {
  MAX_USER_FACING_AI_ERROR_CODE_CHARS,
  MAX_USER_FACING_AI_ERROR_MESSAGE_CHARS,
} from './errorClassification';

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
