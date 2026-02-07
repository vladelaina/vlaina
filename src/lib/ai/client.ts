import type { Provider, AIModel, ChatMessage } from './types'

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