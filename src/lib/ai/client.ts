import type { Provider, AIModel, ChatMessage } from './types'

export interface AIClient {
  sendMessage(
    message: string,
    history: ChatMessage[],
    model: AIModel,
    provider: Provider,
    onChunk?: (chunk: string) => void,
    signal?: AbortSignal,
    options?: { max_tokens?: number; max_completion_tokens?: number }
  ): Promise<string>
  
  testConnection(provider: Provider): Promise<boolean>
}