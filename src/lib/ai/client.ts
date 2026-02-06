import type { Provider, AIModel, AIError, AIErrorType, ChatMessage } from './types'

export interface AIClient {
  sendMessage(
    message: string,
    history: ChatMessage[],
    model: AIModel,
    provider: Provider,
    onChunk?: (chunk: string) => void
  ): Promise<string>
  
  testConnection(provider: Provider): Promise<boolean>
}

export function createAIError(
  type: AIErrorType,
  message: string,
  details?: string,
  statusCode?: number
): AIError {
  return { type, message, details, statusCode }
}

export function parseAPIError(error: unknown): AIError {
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return createAIError(
      'NETWORK_ERROR' as AIErrorType,
      'Unable to connect to the API. Please check your internet connection.'
    )
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    
    if (message.includes('timeout')) {
      return createAIError(
        'TIMEOUT' as AIErrorType,
        'Request timed out. Please try again.'
      )
    }
    
    if (message.includes('abort')) {
      return createAIError(
        'TIMEOUT' as AIErrorType,
        'Request was cancelled.'
      )
    }

    return createAIError(
      'UNKNOWN' as AIErrorType,
      error.message
    )
  }

  return createAIError(
    'UNKNOWN' as AIErrorType,
    'An unexpected error occurred. Please try again.'
  )
}

export function parseHTTPError(status: number, body?: any): AIError {
  switch (status) {
    case 401:
    case 403:
      return createAIError(
        'AUTH_ERROR' as AIErrorType,
        'Invalid API key. Please check your configuration.',
        body?.error?.message,
        status
      )
    case 429:
      return createAIError(
        'RATE_LIMIT' as AIErrorType,
        'Rate limit exceeded. Please try again later.',
        body?.error?.message,
        status
      )
    case 400:
      return createAIError(
        'INVALID_REQUEST' as AIErrorType,
        'Invalid request. Please check your input.',
        body?.error?.message,
        status
      )
    case 500:
    case 502:
    case 503:
    case 504:
      return createAIError(
        'SERVER_ERROR' as AIErrorType,
        'Server error. Please try again later.',
        body?.error?.message,
        status
      )
    default:
      return createAIError(
        'UNKNOWN' as AIErrorType,
        `HTTP ${status}: ${body?.error?.message || 'Unknown error'}`,
        body?.error?.message,
        status
      )
  }
}
