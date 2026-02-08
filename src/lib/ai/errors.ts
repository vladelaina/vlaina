import { AIError, AIErrorType } from './types';

export function createAIError(
  type: AIErrorType,
  message: string,
  details?: string,
  statusCode?: number
): AIError {
  return { type, message, details, statusCode }
}

export function parseAPIError(error: any): AIError {
  // 1. Pass through if it's already a formatted AIError
  if (error && typeof error === 'object' && 'type' in error && 'message' in error) {
      return error as AIError;
  }

  // 2. Handle standard Errors raw
  if (error instanceof Error) {
    const message = error.message;
    const lowerMsg = message.toLowerCase();
    
    let type = AIErrorType.UNKNOWN;
    if (lowerMsg.includes('timeout') || lowerMsg.includes('abort')) {
        type = AIErrorType.TIMEOUT;
    } else if (error instanceof TypeError && lowerMsg.includes('fetch')) {
        type = AIErrorType.NETWORK_ERROR;
    }

    return createAIError(type, message); // Raw message
  }

  // 3. Fallback for non-object errors
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