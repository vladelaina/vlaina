import type { AIClient } from '../client'
import type { Provider, AIModel, ChatCompletionRequest, ChatCompletionResponse, ChatCompletionStreamChunk, ChatMessage, ChatMessageContent } from '../types'
import { parseAPIError, parseHTTPError } from '../client'
import { normalizeApiHost } from '../utils'

export class OpenAICompatibleClient implements AIClient {
  private readonly timeout = 300000 // 5 minutes for thinking models 

  async sendMessage(
    message: ChatMessageContent,
    history: ChatMessage[],
    model: AIModel,
    provider: Provider,
    onChunk?: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<string> {
    console.log('[OpenAI] sendMessage called', { 
        messageLength: typeof message === 'string' ? message.length : 'multimodal', 
        historyLength: history.length, 
        model: model.id,
        provider: provider.name
    });

    const host = normalizeApiHost(provider.apiHost)
    const baseUrl = host.endsWith('/v1') ? host : `${host}/v1`
    const url = `${baseUrl}/chat/completions`
    const headers = {
      'Authorization': `Bearer ${provider.apiKey}`,
      'Content-Type': 'application/json'
    }
    
    // Construct messages
    const apiMessages = history.map(msg => ({
        role: msg.role,
        content: msg.content
    }));
    apiMessages.push({ role: 'user', content: message });

    const body: ChatCompletionRequest = {
      model: model.id,
      messages: apiMessages,
      stream: true // Always use stream for better compatibility
    }

    console.log('[OpenAI] Request constructed', { 
        url, 
        headers: { ...headers, Authorization: 'Bearer ***' }, 
        bodyModel: body.model,
        messagesCount: body.messages.length
    });

    // Use streamResponse even if onChunk is not provided to handle forced SSE responses
    return this.streamResponse(url, headers, body, onChunk || (() => {}), signal)
  }

  // fetchResponse is now unused but kept for reference or specific non-stream needs
  private async fetchResponse(
    url: string,
    headers: Record<string, string>,
    body: ChatCompletionRequest,
    signal?: AbortSignal
  ): Promise<string> {
    console.log('[OpenAI] Starting fetchResponse');
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
      console.log('[OpenAI] Fetch response received', { 
          status: response.status, 
          ok: response.ok,
          type: response.type,
          contentType: response.headers.get('content-type')
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        console.error('[OpenAI] Fetch error body', errorBody);
        throw parseHTTPError(response.status, errorBody)
      }

      const data: ChatCompletionResponse = await response.json()
      console.log('[OpenAI] Fetch success, content length:', data.choices[0]?.message?.content?.length);
      return data.choices[0]?.message?.content || ''
    } catch (error) {
      console.error('[OpenAI] Fetch exception', error);
      clearTimeout(timeoutId)
      throw parseAPIError(error)
    }
  }

  private async streamResponse(
    url: string,
    headers: Record<string, string>,
    body: ChatCompletionRequest,
    onChunk: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<string> {
    const startTime = Date.now();
    console.log('[OpenAI] Starting streamResponse at', new Date(startTime).toISOString());
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

      const tt_header = Date.now() - startTime;
      clearTimeout(timeoutId)
      console.log('[OpenAI] Stream headers received', { 
          status: response.status, 
          ok: response.ok,
          contentType: response.headers.get('content-type'),
          latencyMs: tt_header
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        console.error('[OpenAI] Stream error body', errorBody);
        throw parseHTTPError(response.status, errorBody)
      }

      if (!response.body) {
        throw new Error('Response body is null')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''
      let buffer = ''
      let firstTokenReceived = false;

      while (true) {
        const { done, value } = await reader.read()
        
        if (!firstTokenReceived && value) {
            firstTokenReceived = true;
            console.log('[OpenAI] Time to First Byte (TTFB):', Date.now() - startTime, 'ms');
        }
        
        if (done) {
            console.log('[OpenAI] Stream reading done. Total duration:', Date.now() - startTime, 'ms');
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
              const content = chunk.choices[0]?.delta?.content
              
              if (content) {
                fullContent += content
                onChunk(fullContent)
              }
            } catch (e) {
              console.error('[OpenAI] Failed to parse SSE chunk:', e, line)
            }
          }
        }
      }

      console.log('[OpenAI] Stream finished. Total length:', fullContent.length);
      return fullContent
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
          console.log('[OpenAI] Request aborted by user');
          throw error;
      }
      console.error('[OpenAI] Stream exception', error);
      clearTimeout(timeoutId)
      throw parseAPIError(error)
    }
  }

  async testConnection(provider: Provider): Promise<boolean> {
    try {
      const host = normalizeApiHost(provider.apiHost)
      const baseUrl = host.endsWith('/v1') ? host : `${host}/v1`
      const url = `${baseUrl}/models`
      console.log('[OpenAI] Testing connection to', url);
      
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
      console.log('[OpenAI] Test connection result:', response.status);
      return response.ok
    } catch (e) {
      console.error('[OpenAI] Test connection failed:', e);
      return false
    }
  }

  async getModels(provider: Provider): Promise<string[]> {
    try {
      const host = normalizeApiHost(provider.apiHost)
      const baseUrl = host.endsWith('/v1') ? host : `${host}/v1`
      const url = `${baseUrl}/models`
      console.log('[OpenAI] Fetching models from', url);

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
    } catch (error) {
      console.error('[OpenAI] Fetch models failed:', error)
      throw error
    }
  }
}

export const openaiClient = new OpenAICompatibleClient()