import { createAIError, parseAPIError, parseHTTPError } from '../errors'
import { AIErrorType, type AIModel, type ChatMessage, type ChatMessageContent, type ChatSendOptions, type Provider } from '../types'
import { buildAnthropicBaseUrl, resolveApiModelId } from '../utils'
import { providerFetch } from '../providerHttp'
import { createStreamAccumulator } from '@/lib/ai/streaming'

export const ANTHROPIC_VERSION = '2023-06-01'

export function buildAnthropicHeaders(apiKey: string, includeContentType = false): Record<string, string> {
  return {
    'x-api-key': apiKey,
    'anthropic-version': ANTHROPIC_VERSION,
    'anthropic-dangerous-direct-browser-access': 'true',
    ...(includeContentType ? { 'Content-Type': 'application/json' } : {}),
  }
}

function extractTextContent(content: ChatMessageContent): string {
  if (typeof content === 'string') {
    return content
  }

  return content
    .map((part) => {
      if (part.type === 'text') {
        return part.text
      }
      return ''
    })
    .join('')
}

function buildAnthropicMessages(
  message: ChatMessageContent,
  history: ChatMessage[]
): { system?: string; messages: Array<{ role: 'user' | 'assistant'; content: string }> } {
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = []
  const systemParts: string[] = []

  history.forEach((entry) => {
    const content = extractTextContent(entry.content)
    if (!content) return

    if (entry.role === 'system') {
      systemParts.push(content)
      return
    }

    messages.push({
      role: entry.role === 'assistant' ? 'assistant' : 'user',
      content,
    })
  })

  messages.push({
    role: 'user',
    content: extractTextContent(message),
  })

  return {
    system: systemParts.join('\n\n') || undefined,
    messages,
  }
}

function summarizeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error || 'Unknown error')
}

async function consumeAnthropicStream(
  response: Response,
  onChunk: (chunk: string) => void
): Promise<string> {
  if (!response.body) {
    throw new Error('Response body is null')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  const accumulator = createStreamAccumulator(onChunk)

  const consumeLine = (line: string) => {
    const trimmed = line.trim()
    if (!trimmed.startsWith('data:')) {
      return
    }

    const payloadText = trimmed.slice(5).trim()
    if (!payloadText || payloadText === '[DONE]') {
      return
    }

    let payload: Record<string, unknown>
    try {
      payload = JSON.parse(payloadText) as Record<string, unknown>
    } catch {
      return
    }

    if (payload.type === 'error') {
      const error = payload.error
      if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
        throw new Error(error.message)
      }
    }

    if (payload.type !== 'content_block_delta') {
      return
    }

    const delta = payload.delta
    if (!delta || typeof delta !== 'object') {
      return
    }

    if ('thinking' in delta && typeof delta.thinking === 'string') {
      accumulator.pushDelta({ reasoning: delta.thinking })
      return
    }

    if ('text' in delta && typeof delta.text === 'string') {
      accumulator.pushDelta({ content: delta.text })
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() || ''
    lines.forEach(consumeLine)
  }

  if (buffer.trim()) {
    consumeLine(buffer)
  }

  return accumulator.finish()
}

export async function sendAnthropicMessage({
  message,
  history,
  model,
  provider,
  apiKey,
  timeoutMs,
  onChunk,
  signal,
  options,
}: {
  message: ChatMessageContent
  history: ChatMessage[]
  model: AIModel
  provider: Provider
  apiKey: string
  timeoutMs: number
  onChunk: (chunk: string) => void
  signal?: AbortSignal
  options?: ChatSendOptions
}): Promise<string> {
  const baseUrl = buildAnthropicBaseUrl(provider.apiHost)
  const url = `${baseUrl}/messages`
  const { system, messages } = buildAnthropicMessages(message, history)
  const body = {
    model: resolveApiModelId(model),
    messages,
    system,
    stream: true,
    max_tokens: options?.max_tokens ?? options?.max_completion_tokens ?? 4096,
  }
  const controller = new AbortController()
  let timedOut = false
  const headers = buildAnthropicHeaders(apiKey, true)
  const timeoutId = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)
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

    return consumeAnthropicStream(response, onChunk)
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      if (timedOut) {
        throw new Error('The AI request timed out.')
      }
      throw error
    }
    const parsedError = parseAPIError(error)
    const detail = `Anthropic chat request to ${url} failed: ${summarizeError(error)}`
    if (parsedError.type === AIErrorType.NETWORK_ERROR) {
      throw createAIError(parsedError.type, parsedError.message, detail, parsedError.statusCode)
    }
    throw parsedError
  } finally {
    clearTimeout(timeoutId)
    signal?.removeEventListener('abort', forwardAbort)
  }
}
