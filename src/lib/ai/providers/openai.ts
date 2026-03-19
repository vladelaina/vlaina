import type { AIClient } from '../client'
import type { Provider, AIModel, ChatCompletionRequest, ChatMessage, ChatMessageContent, ChatSendOptions } from '../types'
import { parseAPIError, parseHTTPError } from '../errors'
import { buildOpenAIBaseUrl, resolveApiModelId } from '../utils'
import {
  fetchManagedModels,
  MANAGED_PROVIDER_ID,
  requestManagedChatCompletion,
  requestManagedChatCompletionStream,
} from '@/lib/ai/managedService'
import { consumeOpenAIStream } from '@/lib/ai/streaming'

export class OpenAICompatibleClient implements AIClient {
  private readonly timeout = 300000

  private extractManagedResponseContent(payload: Record<string, unknown>): string {
    const choices = Array.isArray(payload.choices) ? payload.choices : []
    const firstChoice = choices[0]
    if (!firstChoice || typeof firstChoice !== 'object') return ''

    const message = (firstChoice as Record<string, unknown>).message
    if (!message || typeof message !== 'object') return ''

    const content = (message as Record<string, unknown>).content
    return typeof content === 'string' ? content : ''
  }

  private buildChatRequest(
    message: ChatMessageContent,
    history: ChatMessage[],
    model: AIModel,
    options?: ChatSendOptions
  ): ChatCompletionRequest {
    const apiMessages: { role: string; content: ChatMessageContent }[] = history.map((entry) => ({
      role: entry.role,
      content: entry.content,
    }))
    apiMessages.push({ role: 'user', content: message })

    return {
      model: resolveApiModelId(model),
      messages: apiMessages,
      stream: true,
      ...(options || {}),
    }
  }

  private async sendManagedMessage(
    body: ChatCompletionRequest,
    onChunk?: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<string> {
    if (body.stream === false) {
      const payload = await requestManagedChatCompletion({
        ...body,
        stream: false,
      } as unknown as Record<string, unknown>)
      const content = this.extractManagedResponseContent(payload)
      ;(onChunk || (() => {}))(content)
      return content
    }

    return requestManagedChatCompletionStream(
      body as unknown as Record<string, unknown>,
      onChunk || (() => {}),
      signal
    )
  }

  private async resolveApiKey(provider: Provider): Promise<string> {
    const directApiKey = provider.apiKey?.trim() || ''
    if (!directApiKey) {
      throw new Error('Missing API key')
    }
    return directApiKey
  }

  async sendMessage(
    message: ChatMessageContent,
    history: ChatMessage[],
    model: AIModel,
    provider: Provider,
    onChunk?: (chunk: string) => void,
    signal?: AbortSignal,
    options?: ChatSendOptions
  ): Promise<string> {
    const body = this.buildChatRequest(message, history, model, options)

    if (provider.id === MANAGED_PROVIDER_ID) {
      return this.sendManagedMessage(body, onChunk, signal)
    }

    const apiKey = await this.resolveApiKey(provider)
    const baseUrl = buildOpenAIBaseUrl(provider.apiHost)
    const url = `${baseUrl}/chat/completions`
    const headers = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    }

    return this.streamResponse(url, headers, body, onChunk || (() => {}), signal)
  }

  private async streamResponse(
    url: string,
    headers: Record<string, string>,
    body: ChatCompletionRequest,
    onChunk: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<string> {
    const controller = new AbortController()
    let timedOut = false
    const timeoutId = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, this.timeout)

    if (signal) {
      signal.addEventListener('abort', () => controller.abort())
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error')
        let errorBody
        try {
          errorBody = JSON.parse(errorText)
        } catch {
          errorBody = { message: errorText }
        }
        throw parseHTTPError(response.status, errorBody)
      }

      return consumeOpenAIStream(response, onChunk)
    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error && error.name === 'AbortError') {
        if (timedOut) {
          throw new Error('The AI request timed out.')
        }
        throw error
      }
      throw parseAPIError(error)
    }
  }

  async testConnection(provider: Provider): Promise<boolean> {
    try {
      if (provider.id === MANAGED_PROVIDER_ID) {
        await fetchManagedModels()
        return true
      }

      const apiKey = await this.resolveApiKey(provider)
      const baseUrl = buildOpenAIBaseUrl(provider.apiHost)
      const url = `${baseUrl}/models`

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)
      return response.ok
    } catch {
      return false
    }
  }

  async getModels(provider: Provider): Promise<string[]> {
    if (provider.id === MANAGED_PROVIDER_ID) {
      const models = await fetchManagedModels()
      return models.map((model) => model.apiModelId)
    }

    const apiKey = await this.resolveApiKey(provider)
    const baseUrl = buildOpenAIBaseUrl(provider.apiHost)
    const url = `${baseUrl}/models`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.status}`)
    }

    const data = await response.json()

    if (data.data && Array.isArray(data.data)) {
      return data.data.map((m: any) => m.id)
    }
    if (data.models && Array.isArray(data.models)) {
      return data.models.map((m: any) => m.name || m.model)
    }

    return []
  }
}

export const openaiClient = new OpenAICompatibleClient()
