import type { AIClient } from '../client'
import type { Provider, AIModel, ChatCompletionRequest, ChatCompletionResponse, ChatCompletionStreamChunk } from '../types'
import { parseAPIError, parseHTTPError } from '../client'
import { normalizeApiHost } from '../utils'

export class NewAPIClient implements AIClient {
  private readonly timeout = 30000

  async sendMessage(
    message: string,
    model: AIModel,
    provider: Provider,
    onChunk?: (chunk: string) => void
  ): Promise<string> {
    const url = `${normalizeApiHost(provider.apiHost)}/v1/chat/completions`
    const headers = {
      'Authorization': `Bearer ${provider.apiKey}`,
      'Content-Type': 'application/json'
    }
    
    const body: ChatCompletionRequest = {
      model: model.id,
      messages: [{ role: 'user', content: message }],
      stream: !!onChunk
    }

    if (onChunk) {
      return this.streamResponse(url, headers, body, onChunk)
    } else {
      return this.fetchResponse(url, headers, body)
    }
  }

  private async fetchResponse(
    url: string,
    headers: Record<string, string>,
    body: ChatCompletionRequest
  ): Promise<string> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw parseHTTPError(response.status, errorBody)
      }

      const data: ChatCompletionResponse = await response.json()
      return data.choices[0]?.message?.content || ''
    } catch (error) {
      clearTimeout(timeoutId)
      throw parseAPIError(error)
    }
  }

  private async streamResponse(
    url: string,
    headers: Record<string, string>,
    body: ChatCompletionRequest,
    onChunk: (chunk: string) => void
  ): Promise<string> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw parseHTTPError(response.status, errorBody)
      }

      if (!response.body) {
        throw new Error('Response body is null')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break

        buffer += decoder.decode(value, { stream: true })
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
                onChunk(content)
              }
            } catch (e) {
              console.error('Failed to parse SSE chunk:', e)
            }
          }
        }
      }

      return fullContent
    } catch (error) {
      clearTimeout(timeoutId)
      throw parseAPIError(error)
    }
  }

  async testConnection(provider: Provider): Promise<boolean> {
    try {
      const url = `${normalizeApiHost(provider.apiHost)}/v1/models`
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
    try {
      const url = `${normalizeApiHost(provider.apiHost)}/v1/models`
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
      // Handle standard OpenAI format { data: [{ id: "..." }] }
      if (data.data && Array.isArray(data.data)) {
        return data.data.map((m: any) => m.id)
      }
      // Handle Ollama format { models: [{ name: "..." }] }
      if (data.models && Array.isArray(data.models)) {
        return data.models.map((m: any) => m.name || m.model)
      }
      
      return []
    } catch (error) {
      console.error('Fetch models failed:', error)
      throw error
    }
  }
}

export const newAPIClient = new NewAPIClient()
