import type { AIClient } from '../client'
import type { Provider, AIModel, ChatCompletionRequest, ChatCompletionStreamChunk, ChatMessage, ChatMessageContent, ChatSendOptions } from '../types'
import { parseAPIError, parseHTTPError } from '../errors'
import { normalizeApiHost } from '../utils'

export class OpenAICompatibleClient implements AIClient {
  private readonly timeout = 300000 // 5 minutes for thinking models 

  async sendMessage(
    message: ChatMessageContent,
    history: ChatMessage[],
    model: AIModel,
    provider: Provider,
    onChunk?: (chunk: string) => void,
    signal?: AbortSignal,
    options?: ChatSendOptions
  ): Promise<string> {
    const host = normalizeApiHost(provider.apiHost)
    const baseUrl = host.endsWith('/v1') ? host : `${host}/v1`
    const url = `${baseUrl}/chat/completions`
    const headers = {
      'Authorization': `Bearer ${provider.apiKey}`,
      'Content-Type': 'application/json'
    }
    
    // Construct messages
    const apiMessages: { role: string; content: ChatMessageContent }[] = history.map(msg => ({
        role: msg.role,
        content: msg.content
    }));
    apiMessages.push({ role: 'user', content: message });

    const { nativeWebSearch = false, ...requestOptions } = options || {}
    const baseBody: ChatCompletionRequest = {
      model: model.id,
      messages: apiMessages,
      stream: true, // Always use stream for better compatibility
      ...requestOptions
    }

    const emit = onChunk || (() => {})
    if (!nativeWebSearch) {
      // Use streamResponse even if onChunk is not provided to handle forced SSE responses
      return this.streamResponse(url, headers, baseBody, emit, signal)
    }

    const searchPatches = this.getNativeSearchPatches(model, provider)
    for (const patch of searchPatches) {
      const body: ChatCompletionRequest = { ...baseBody, ...patch }
      try {
        return await this.streamResponse(url, headers, body, emit, signal)
      } catch (error: any) {
        if (!this.isSearchCompatibilityError(error)) {
          throw error
        }
      }
    }

    return this.streamResponse(url, headers, baseBody, emit, signal)
  }

  private getNativeSearchPatches(model: AIModel, provider: Provider): Array<Partial<ChatCompletionRequest>> {
    const modelId = (model.id || '').toLowerCase()
    const host = normalizeApiHost(provider.apiHost || '').toLowerCase()
    const patches: Array<Partial<ChatCompletionRequest>> = []
    const add = (patch: Partial<ChatCompletionRequest>) => {
      const key = JSON.stringify(patch)
      if (!patches.some(p => JSON.stringify(p) === key)) {
        patches.push(patch)
      }
    }

    // OpenAI family (and most OpenAI-compatible gateways that proxy OpenAI search tools)
    if (modelId.includes('gpt') || host.includes('openai')) {
      add({ tools: [{ type: 'web_search' }], tool_choice: 'auto' })
      add({ tools: [{ type: 'web_search_preview' }], tool_choice: 'auto' })
      add({ web_search_options: {} })
    }

    // xAI / Grok style
    if (modelId.includes('grok') || host.includes('x.ai') || host.includes('xai')) {
      add({ tools: [{ type: 'web_search' }], tool_choice: 'auto' })
      add({ tools: [{ type: 'x_search' }], tool_choice: 'auto' })
      add({ search_parameters: { mode: 'auto' } })
    }

    // Generic OpenAI-compatible fallback
    add({ tools: [{ type: 'web_search' }], tool_choice: 'auto' })
    add({ web_search_options: {} })

    return patches
  }

  private isSearchCompatibilityError(error: any): boolean {
    const status = Number(error?.statusCode || 0)
    const type = String(error?.type || '').toLowerCase()
    const message = String(error?.message || '').toLowerCase()
    const hasSearchHint =
      message.includes('tool') ||
      message.includes('search') ||
      message.includes('web_search') ||
      message.includes('x_search') ||
      message.includes('web_search_options') ||
      message.includes('search_parameters') ||
      message.includes('unknown field') ||
      message.includes('unsupported') ||
      message.includes('unrecognized') ||
      message.includes('not allowed')

    if (status === 404 || status === 422) return true
    if (status === 400) return hasSearchHint
    if (type.includes('invalid_request') && hasSearchHint) return true
    return false
  }

  private async streamResponse(
    url: string,
    headers: Record<string, string>,
    body: ChatCompletionRequest,
    onChunk: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<string> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    if (signal) {
        signal.addEventListener('abort', () => controller.abort());
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        let errorBody;
        try {
            errorBody = JSON.parse(errorText);
        } catch {
            errorBody = { message: errorText }; // Keep raw text if not JSON
        }
        throw parseHTTPError(response.status, errorBody)
      }

      if (!response.body) {
        throw new Error('Response body is null')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''
      let buffer = ''
      
      // State for handling 'reasoning_content' fields (DeepSeek style)
      let hasStartedReasoning = false;
      let hasFinishedReasoning = false;

      while (true) {
        const { done, value } = await reader.read()

        if (done) {
            break
        }

        const chunkText = decoder.decode(value, { stream: true })
        
        buffer += chunkText
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || trimmed === 'data: [DONE]') continue
          
          if (trimmed.startsWith('data: ')) {
            try {
              const jsonStr = trimmed.slice(6)
              const chunk: ChatCompletionStreamChunk = JSON.parse(jsonStr)
              const delta = chunk.choices[0]?.delta
              
              if (delta) {
                  const reasoning = (delta as any).reasoning_content;
                  const content = delta.content;

                  // Handle DeepSeek API reasoning field
                  if (reasoning) {
                      if (!hasStartedReasoning) {
                          fullContent += "<think>";
                          hasStartedReasoning = true;
                      }
                      fullContent += reasoning;
                  }

                  // Handle Standard Content
                  if (content) {
                      // If we were reasoning and now we have content, close the think tag
                      if (hasStartedReasoning && !hasFinishedReasoning) {
                          fullContent += "</think>";
                          hasFinishedReasoning = true;
                      }
                      fullContent += content;
                  }
                  
                  // Emit update if anything changed
                  if (reasoning || content) {
                      onChunk(fullContent);
                  }
              }
            } catch {
              // Ignore malformed SSE chunk and continue parsing the stream.
            }
          }
        }
      }
      
      // Edge case: If stream ends while reasoning, close the tag
      if (hasStartedReasoning && !hasFinishedReasoning) {
          fullContent += "</think>";
      }

      return fullContent
    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error && error.name === 'AbortError') {
          throw error;
      }
      throw parseAPIError(error)
    }
  }

  async testConnection(provider: Provider): Promise<boolean> {
    try {
      const host = normalizeApiHost(provider.apiHost)
      const baseUrl = host.endsWith('/v1') ? host : `${host}/v1`
      const url = `${baseUrl}/models`
      
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${provider.apiKey}`
        },
        signal: controller.signal
      })

      clearTimeout(timeoutId)
      return response.ok
    } catch {
      return false
    }
  }

  async getModels(provider: Provider): Promise<string[]> {
    const host = normalizeApiHost(provider.apiHost)
    const baseUrl = host.endsWith('/v1') ? host : `${host}/v1`
    const url = `${baseUrl}/models`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${provider.apiKey}`
      },
      signal: controller.signal
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
