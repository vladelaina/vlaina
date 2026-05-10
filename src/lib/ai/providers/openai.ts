import type { AIClient } from '../client'
import type { ApiTranscriptMessage, Provider, AIModel, ChatCompletionRequest, ChatMessage, ChatMessageContent, ChatSendOptions } from '../types'
import { createAIError, parseAPIError, parseHTTPError } from '../errors'
import { AIErrorType } from '../types'
import { buildOpenAIBaseUrl, resolveApiModelId } from '../utils'
import { sendAnthropicMessage } from './anthropic'
import { detectProviderEndpointModels, type ModelFetchResult } from './modelDetection'
import { providerFetch } from '../providerHttp'
import {
  fetchManagedModels,
  MANAGED_PROVIDER_ID,
  requestManagedChatCompletion,
  requestManagedChatCompletionStream,
} from '@/lib/ai/managedService'
import { consumeOpenAIStream } from '@/lib/ai/streaming'
import { normalizeApiTranscriptMessage } from '@/lib/ai/apiTranscript'
import { stripThinkingContent } from '@/lib/ai/stripThinkingContent'
import {
  runOpenAIWebSearchJsonToolLoop,
  runOpenAIWebSearchToolLoop,
} from '@/lib/ai/webSearch/openAIToolLoop'

function summarizeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error || 'Unknown error')
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
    || !!error && typeof error === 'object' && (error as { name?: unknown }).name === 'AbortError'
}

function createUnsupportedWebSearchError(): Error {
  return new Error('Web search is unavailable for this model.')
}

function isDeepSeekOpenAICompatible(provider: Provider, model: AIModel): boolean {
  const haystack = [
    provider.name,
    provider.apiHost,
    model.name,
    model.apiModelId,
  ].join(' ').toLowerCase()
  return haystack.includes('deepseek')
}

function shouldReplayApiTranscript(provider: Provider, model: AIModel): boolean {
  return provider.endpointType !== 'anthropic' && isDeepSeekOpenAICompatible(provider, model)
}

function buildChatCompletionOptions(options?: ChatSendOptions): Partial<ChatCompletionRequest> {
  return {
    ...(typeof options?.max_tokens === 'number' ? { max_tokens: options.max_tokens } : {}),
    ...(typeof options?.max_completion_tokens === 'number' ? { max_completion_tokens: options.max_completion_tokens } : {}),
  }
}

function buildAssistantApiTranscriptFromRenderedContent(content: string): ApiTranscriptMessage[] {
  const reasoningParts = Array.from(content.matchAll(/<think>([\s\S]*?)(?:<\/think>|$)/gi))
    .map((match) => match[1] ?? '')
    .filter(Boolean)

  if (reasoningParts.length === 0) {
    return []
  }

  const assistantContent = content.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '')
  return [{
    role: 'assistant',
    content: assistantContent,
    reasoning_content: reasoningParts.join('\n\n'),
  }]
}

function stripRenderedThinkingFromAssistantContent(content: ChatMessageContent): ChatMessageContent {
  if (typeof content === 'string') {
    return stripThinkingContent(content)
  }

  return content.map((part) => {
    if (part.type !== 'text') {
      return part
    }
    return {
      ...part,
      text: stripThinkingContent(part.text),
    }
  })
}

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
    provider: Provider,
    options?: ChatSendOptions
  ): ChatCompletionRequest {
    const replayApiTranscript = shouldReplayApiTranscript(provider, model)
    const apiMessages: ApiTranscriptMessage[] = history.flatMap((entry) => {
      const transcript = entry.apiTranscript ?? entry.versions?.[entry.currentVersionIndex]?.apiTranscript
      if (replayApiTranscript && entry.role === 'assistant' && transcript?.length) {
        const normalizedTranscript = transcript
          .map(normalizeApiTranscriptMessage)
          .filter((message): message is ApiTranscriptMessage => message !== null)
        if (normalizedTranscript.length > 0) {
          return normalizedTranscript
        }
      }
      return [{
        role: entry.role,
        content: entry.role === 'assistant'
          ? stripRenderedThinkingFromAssistantContent(entry.content)
          : entry.content,
      }]
    })
    apiMessages.push({ role: 'user', content: message })

    return {
      model: resolveApiModelId(model),
      messages: apiMessages,
      stream: true,
      ...buildChatCompletionOptions(options),
    }
  }

  private async sendManagedMessage(
    body: ChatCompletionRequest,
    onChunk?: (chunk: string) => void,
    signal?: AbortSignal,
    options?: ChatSendOptions
  ): Promise<string> {
    if (body.stream === false) {
      const payload = await requestManagedChatCompletion({
        ...body,
        stream: false,
      } as unknown as Record<string, unknown>)
      const content = this.extractManagedResponseContent(payload)
      ;(onChunk || (() => {}))(content)
      const apiTranscript = buildAssistantApiTranscriptFromRenderedContent(content)
      if (apiTranscript.length) {
        options?.onApiTranscript?.(apiTranscript)
      }
      return content
    }

    const content = await requestManagedChatCompletionStream(
      body as unknown as Record<string, unknown>,
      onChunk || (() => {}),
      signal
    )
    const apiTranscript = buildAssistantApiTranscriptFromRenderedContent(content)
    if (apiTranscript.length) {
      options?.onApiTranscript?.(apiTranscript)
    }
    return content
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
    const body = this.buildChatRequest(message, history, model, provider, options)

    if (provider.id === MANAGED_PROVIDER_ID) {
      if (options?.webSearchEnabled) {
        return runOpenAIWebSearchJsonToolLoop({
          body,
          onChunk: onChunk || (() => {}),
          onStatus: options.onWebSearchStatus,
          onApiTranscript: options.onApiTranscript,
          requestJson: (nextBody) =>
            requestManagedChatCompletion({
              ...nextBody,
              stream: false,
            } as unknown as Record<string, unknown>),
        })
      }
      return this.sendManagedMessage(body, onChunk, signal, options)
    }

    if (provider.endpointType === 'anthropic') {
      if (options?.webSearchEnabled) {
        throw createUnsupportedWebSearchError()
      }
      const apiKey = await this.resolveApiKey(provider)
      return sendAnthropicMessage({
        message,
        history,
        model,
        provider,
        apiKey,
        timeoutMs: this.timeout,
        onChunk: onChunk || (() => {}),
        signal,
        options,
      })
    }

    const apiKey = await this.resolveApiKey(provider)
    const baseUrl = buildOpenAIBaseUrl(provider.apiHost)
    const url = `${baseUrl}/chat/completions`
    const headers = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    }

    if (options?.webSearchEnabled) {
      return runOpenAIWebSearchToolLoop({
        body,
        onChunk: onChunk || (() => {}),
        onStatus: options.onWebSearchStatus,
        onApiTranscript: options.onApiTranscript,
        request: async (nextBody) => {
          const response = await providerFetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(nextBody),
            signal,
          })
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
          return response
        },
      })
    }

    return this.streamResponse(url, headers, body, onChunk || (() => {}), signal, options)
  }

  private async streamResponse(
    url: string,
    headers: Record<string, string>,
    body: ChatCompletionRequest,
    onChunk: (chunk: string) => void,
    signal?: AbortSignal,
    options?: ChatSendOptions
  ): Promise<string> {
    const controller = new AbortController()
    let timedOut = false
    const timeoutId = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, this.timeout)

    const forwardAbort = () => controller.abort()
    signal?.addEventListener('abort', forwardAbort)

    try {
      const response = await providerFetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      })

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

      const result = await consumeOpenAIStream(response, onChunk, {
        onAssistantTranscriptMessage: (message) => {
          options?.onApiTranscript?.([message])
        },
      })
      return result
    } catch (error) {
      if (isAbortError(error)) {
        if (timedOut) {
          throw new Error('The AI request timed out.')
        }
        throw error
      }
      const parsedError = parseAPIError(error)
      const detail = `OpenAI-compatible chat request to ${url} failed: ${summarizeError(error)}`
      if (parsedError.type === AIErrorType.NETWORK_ERROR) {
        throw createAIError(parsedError.type, parsedError.message, detail, parsedError.statusCode)
      }
      throw parsedError
    } finally {
      clearTimeout(timeoutId)
      signal?.removeEventListener('abort', forwardAbort)
    }
  }

  async testConnection(provider: Provider): Promise<boolean> {
    try {
      if (provider.id === MANAGED_PROVIDER_ID) {
        await fetchManagedModels()
        return true
      }

      await this.getModels(provider)
      return true
    } catch {
      return false
    }
  }

  async getModels(provider: Provider): Promise<string[]> {
    const result = await this.getModelsWithEndpointDetection(provider)
    return result.models
  }

  async getModelsWithEndpointDetection(provider: Provider): Promise<ModelFetchResult> {
    if (provider.id === MANAGED_PROVIDER_ID) {
      const models = await fetchManagedModels()
      return {
        models: models.map((model) => model.apiModelId),
        endpointType: 'openai',
      }
    }

    const apiKey = await this.resolveApiKey(provider)
    return detectProviderEndpointModels(provider, apiKey)
  }
}

export const openaiClient = new OpenAICompatibleClient()
