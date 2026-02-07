export interface Provider {
  id: string
  name: string
  icon?: string
  type: 'newapi'
  apiHost: string
  apiKey: string
  enabled: boolean
  createdAt: number
  updatedAt: number
}

export interface AIModel {
  id: string
  name: string
  providerId: string
  group?: string
  enabled: boolean
  createdAt: number
}

export interface ChatSession {
  id: string
  title: string
  modelId: string
  isPinned?: boolean
  createdAt: number
  updatedAt: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  modelId: string
  timestamp: number
  versions?: string[]
  currentVersionIndex?: number
}

export interface ChatCompletionRequest {
  model: string
  messages: Array<{
    role: string
    content: string
  }>
  stream: boolean
  temperature?: number
  max_tokens?: number
}

export interface ChatCompletionResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    message: {
      role: string
      content: string
    }
    finish_reason: string
  }>
}

export interface ChatCompletionStreamChunk {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    delta: {
      role?: string
      content?: string
    }
    finish_reason: string | null
  }>
}

export enum AIErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTH_ERROR = 'AUTH_ERROR',
  RATE_LIMIT = 'RATE_LIMIT',
  INVALID_REQUEST = 'INVALID_REQUEST',
  SERVER_ERROR = 'SERVER_ERROR',
  TIMEOUT = 'TIMEOUT',
  UNKNOWN = 'UNKNOWN'
}

export interface AIError {
  type: AIErrorType
  message: string
  details?: string
  statusCode?: number
}
