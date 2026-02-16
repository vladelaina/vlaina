import type { Provider, AIModel, ChatMessage, ChatMessageContent, ChatSendOptions } from './types'

export interface AIClient {
  sendMessage(
    message: ChatMessageContent,
    history: ChatMessage[],
    model: AIModel,
    provider: Provider,
    onChunk?: (chunk: string) => void,
    signal?: AbortSignal,
    options?: ChatSendOptions
  ): Promise<string>
  
  testConnection(provider: Provider): Promise<boolean>
}
