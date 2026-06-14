import { createAIError, parseAPIError, parseHTTPError } from '../errors'
import { AIErrorType, type AIModel, type ChatMessage, type ChatMessageContent, type ChatSendOptions, type Provider } from '../types'
import { buildAnthropicBaseUrl, resolveApiModelId } from '../utils'
import { providerFetch } from '../providerHttp'
import { readBoundedProviderResponseText } from './boundedResponseText'
import {
  appendOpenAIStreamBuffer,
  assertOpenAIStreamLineLength,
  createStreamAccumulator,
  MAX_OPENAI_STREAM_ERROR_FIELD_CHARS,
} from '@/lib/ai/streaming'
import {
  MAX_CURRENT_REQUEST_CONTENT_PARTS,
  MAX_CURRENT_REQUEST_MESSAGE_CHARS,
  sanitizeCurrentRequestTextContent,
} from '@/lib/ai/requestContext'
import { stringifyProviderJsonRequestBody } from '@/lib/ai/providerRequestBody'
import { stripThinkingContent } from '@/lib/ai/stripThinkingContent'
import { normalizeRenderableDataImageSrc } from '@/lib/markdown/renderableImagePolicy'

export const ANTHROPIC_VERSION = '2023-06-01'
const MAX_PROVIDER_ERROR_SUMMARY_CHARS = 8192

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

type AnthropicContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }

type AnthropicMessage = {
  role: 'user' | 'assistant'
  content: string | AnthropicContentBlock[]
}

function dataImageToAnthropicBlock(src: string): AnthropicContentBlock | null {
  const normalized = normalizeRenderableDataImageSrc(src)
  if (!normalized) {
    return null
  }

  const match = /^data:(image\/[^;,]+);base64,([A-Za-z0-9+/=]+)$/i.exec(normalized)
  if (!match) {
    return null
  }

  const mediaType = match[1]?.toLowerCase()
  if (!mediaType || mediaType === 'image/svg+xml') {
    return null
  }

  return {
    type: 'image',
    source: {
      type: 'base64',
      media_type: mediaType,
      data: match[2] || '',
    },
  }
}

function buildAnthropicUserContent(content: ChatMessageContent): string | AnthropicContentBlock[] {
  if (typeof content === 'string') {
    return sanitizeCurrentRequestTextContent(content)
  }

  const blocks: AnthropicContentBlock[] = []
  let remainingTextChars = MAX_CURRENT_REQUEST_MESSAGE_CHARS
  for (const part of content.slice(0, MAX_CURRENT_REQUEST_CONTENT_PARTS)) {
    if (part.type === 'text') {
      if (part.text && remainingTextChars > 0) {
        const text = sanitizeCurrentRequestTextContent(part.text, remainingTextChars)
        remainingTextChars -= text.length
        if (text) {
          blocks.push({ type: 'text', text })
        }
      }
      continue
    }

    const imageBlock = dataImageToAnthropicBlock(part.image_url.url)
    if (imageBlock) {
      blocks.push(imageBlock)
    }
  }

  return blocks.length > 0 ? blocks : ''
}

function buildAnthropicMessages(
  message: ChatMessageContent,
  history: ChatMessage[]
): { system?: string; messages: AnthropicMessage[] } {
  const messages: AnthropicMessage[] = []
  const systemParts: string[] = []

  history.forEach((entry) => {
    const content = stripThinkingContent(extractTextContent(entry.content))
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
    content: buildAnthropicUserContent(message),
  })

  return {
    system: systemParts.join('\n\n') || undefined,
    messages,
  }
}

function summarizeError(error: unknown): string {
  let message = ''
  if (error instanceof Error) {
    message = error.message
  } else if (error && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string') {
    message = (error as { message: string }).message
  } else {
    switch (typeof error) {
      case 'string':
      case 'number':
      case 'boolean':
      case 'bigint':
      case 'symbol':
        message = String(error)
        break
      default:
        message = ''
    }
  }
  return (message || 'Unknown error').slice(0, MAX_PROVIDER_ERROR_SUMMARY_CHARS)
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
    || !!error && typeof error === 'object' && (error as { name?: unknown }).name === 'AbortError'
}

function createAbortError(): DOMException {
  return new DOMException('Aborted', 'AbortError')
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return
  throw createAbortError()
}

async function raceWithAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return await promise
  throwIfAborted(signal)
  promise.catch(() => undefined)

  return await new Promise<T>((resolve, reject) => {
    let settled = false
    const cleanup = () => {
      signal.removeEventListener('abort', abort)
    }
    const settle = (callback: () => void) => {
      if (settled) return
      settled = true
      cleanup()
      callback()
    }
    const abort = () => {
      settle(() => reject(createAbortError()))
    }

    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) {
      abort()
      return
    }

    promise.then(
      (value) => {
        settle(() => {
          try {
            throwIfAborted(signal)
            resolve(value)
          } catch (error) {
            reject(error)
          }
        })
      },
      (error) => {
        settle(() => {
          try {
            throwIfAborted(signal)
            reject(error)
          } catch (abortError) {
            reject(abortError)
          }
        })
      },
    )
  })
}

async function readResponseTextOrFallback(response: Response, signal?: AbortSignal): Promise<string> {
  return await readBoundedProviderResponseText(response, signal)
}

async function consumeAnthropicStream(
  response: Response,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal
): Promise<string> {
  if (!response.body) {
    throw new Error('Response body is null')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  const accumulator = createStreamAccumulator(onChunk)
  let aborted = signal?.aborted ?? false

  const throwIfAborted = () => {
    if (aborted || signal?.aborted) {
      throw createAbortError()
    }
  }

  const abort = () => {
    aborted = true
    void reader.cancel(createAbortError()).catch(() => undefined)
  }

  if (signal?.aborted) {
    void reader.cancel(createAbortError()).catch(() => undefined)
    reader.releaseLock()
    throw createAbortError()
  }

  signal?.addEventListener('abort', abort, { once: true })

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
        throw new Error(error.message.slice(0, MAX_OPENAI_STREAM_ERROR_FIELD_CHARS))
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

  try {
    throwIfAborted()
    while (true) {
      const { done, value } = await raceWithAbort(reader.read(), signal)
      throwIfAborted()
      if (done) break
      buffer = appendOpenAIStreamBuffer(buffer, decoder.decode(value, { stream: true }))
      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop() || ''
      for (const line of lines) {
        throwIfAborted()
        assertOpenAIStreamLineLength(line)
        consumeLine(line)
        throwIfAborted()
      }
      assertOpenAIStreamLineLength(buffer)
    }

    const finalDecoded = decoder.decode()
    if (finalDecoded) {
      buffer = appendOpenAIStreamBuffer(buffer, finalDecoded)
    }

    if (buffer.trim()) {
      throwIfAborted()
      assertOpenAIStreamLineLength(buffer)
      consumeLine(buffer)
      throwIfAborted()
    }

    const finalContent = accumulator.finish()
    throwIfAborted()
    return finalContent
  } catch (error) {
    void reader.cancel(createAbortError()).catch(() => undefined)
    if ((aborted || signal?.aborted) && !isAbortError(error)) {
      throw createAbortError()
    }
    throw error
  } finally {
    signal?.removeEventListener('abort', abort)
    reader.releaseLock()
  }
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
  const forwardAbort = () => {
    if (!controller.signal.aborted) {
      controller.abort()
    }
  }
  signal?.addEventListener('abort', forwardAbort, { once: true })
  if (signal?.aborted) {
    forwardAbort()
  }

  try {
    const response = await providerFetch(url, {
      method: 'POST',
      headers,
      body: stringifyProviderJsonRequestBody(body),
      signal: controller.signal,
    })

    if (!response.ok) {
      const errorText = await readResponseTextOrFallback(response, controller.signal)
      let errorBody
      try {
        errorBody = JSON.parse(errorText)
      } catch {
        errorBody = { message: errorText }
      }
      throw parseHTTPError(response.status, errorBody)
    }

    return await consumeAnthropicStream(response, onChunk, controller.signal)
  } catch (error) {
    if (isAbortError(error) && (timedOut || signal?.aborted)) {
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
