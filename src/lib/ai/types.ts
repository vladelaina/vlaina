export interface Provider {
  id: string
  name: string
  icon?: string
  type: 'newapi'
  endpointType?: 'openai' | 'anthropic'
  endpointTypeCheckedAt?: number
  apiHost: string
  apiKey: string
  enabled: boolean
  createdAt: number
  updatedAt: number
}

export interface AIModel {
  id: string
  apiModelId: string
  name: string
  providerId: string
  group?: string
  enabled: boolean
  pinned?: boolean
  createdAt: number
}

export interface PersistedBenchmarkItem {
  status: 'success' | 'error'
  latency?: number
  error?: string
  checkedAt: number
}

export interface ProviderBenchmarkRecord {
  items: Record<string, PersistedBenchmarkItem>
  overall: 'idle' | 'success' | 'error'
  updatedAt: number
}

export interface ChatSession {
  id: string
  title: string
  modelId: string
  isPinned?: boolean
  createdAt: number
  updatedAt: number
}

export interface MessageVersion {
    content: string;
    createdAt: number;
    subsequentMessages: ChatMessage[]; 
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  imageSources?: string[]
  modelId: string
  timestamp: number
  
  versions: MessageVersion[]
  currentVersionIndex: number
}

export type ChatMessageContentPart = 
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'auto' | 'low' | 'high' } };

export type ChatMessageContent = string | ChatMessageContentPart[];

export interface ChatCompletionRequest {
  model: string
  messages: Array<{
    role: string
    content: ChatMessageContent
  }>
  stream: boolean
  temperature?: number
  max_tokens?: number
  max_completion_tokens?: number
  tools?: Array<Record<string, any>>
  tool_choice?: 'auto' | 'none' | Record<string, any>
}

export interface ChatSendOptions {
  max_tokens?: number
  max_completion_tokens?: number
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
