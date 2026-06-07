import type { ApiTranscriptMessage } from './types'

export interface StreamDeltaPayload {
  reasoning?: string | null
  content?: string | null
}

export interface StreamAccumulator {
  pushDelta: (delta: StreamDeltaPayload) => void
  finish: () => string
  getAssistantTranscriptMessage: () => ApiTranscriptMessage | null
}

interface ConsumeOpenAIStreamOptions {
  onAssistantTranscriptMessage?: (message: ApiTranscriptMessage) => void
  mapErrorPayload?: (message: string, code?: string) => Error | string
  signal?: AbortSignal
}

export const MAX_OPENAI_STREAM_LINE_CHARS = 1024 * 1024
export const MAX_OPENAI_STREAM_CONTENT_CHARS = 4 * 1024 * 1024
const THINK_OPEN_TAG = '<think>'
const THINK_CLOSE_TAG = '</think>'

export function assertOpenAIStreamLineLength(line: string): void {
  if (line.length > MAX_OPENAI_STREAM_LINE_CHARS) {
    throw new Error('AI stream line is too large')
  }
}

function assertOpenAIStreamContentLength(length: number): void {
  if (length > MAX_OPENAI_STREAM_CONTENT_CHARS) {
    throw new Error('AI stream content is too large')
  }
}

export function appendOpenAIStreamBuffer(buffer: string, next: string): string {
  if (buffer.length + next.length > MAX_OPENAI_STREAM_LINE_CHARS) {
    throw new Error('AI stream line is too large')
  }
  return buffer + next
}

function createAbortError(): DOMException {
  return new DOMException('The AI request was cancelled.', 'AbortError')
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return
  throw createAbortError()
}

function raceWithAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) {
    return promise
  }
  throwIfAborted(signal)
  promise.catch(() => undefined)

  return new Promise<T>((resolve, reject) => {
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

export function createStreamAccumulator(onChunk: (chunk: string) => void): StreamAccumulator {
  let fullContent = ''
  let reasoningContent = ''
  let assistantContent = ''
  let hasStartedReasoning = false
  let hasFinishedReasoning = false

  return {
    pushDelta(delta) {
      const reasoning = typeof delta.reasoning === 'string' ? delta.reasoning : ''
      const content = typeof delta.content === 'string' ? delta.content : ''

      if (!reasoning && !content) {
        return
      }

      let nextFullContentLength = fullContent.length
      let nextHasStartedReasoning = hasStartedReasoning
      let nextHasFinishedReasoning = hasFinishedReasoning
      if (reasoning) {
        if (!nextHasStartedReasoning || nextHasFinishedReasoning) {
          nextFullContentLength += THINK_OPEN_TAG.length
          nextHasStartedReasoning = true
          nextHasFinishedReasoning = false
        }
        nextFullContentLength += reasoning.length
      }
      if (content) {
        if (nextHasStartedReasoning && !nextHasFinishedReasoning) {
          nextFullContentLength += THINK_CLOSE_TAG.length
          nextHasFinishedReasoning = true
        }
        nextFullContentLength += content.length
      }
      assertOpenAIStreamContentLength(nextFullContentLength)

      if (reasoning) {
        if (!hasStartedReasoning || hasFinishedReasoning) {
          fullContent += THINK_OPEN_TAG
          hasStartedReasoning = true
          hasFinishedReasoning = false
        }
        reasoningContent += reasoning
        fullContent += reasoning
      }

      if (content) {
        if (hasStartedReasoning && !hasFinishedReasoning) {
          fullContent += THINK_CLOSE_TAG
          hasFinishedReasoning = true
        }
        assistantContent += content
        fullContent += content
      }

      onChunk(fullContent)
    },
    finish() {
      if (hasStartedReasoning && !hasFinishedReasoning) {
        assertOpenAIStreamContentLength(fullContent.length + THINK_CLOSE_TAG.length)
        fullContent += THINK_CLOSE_TAG
      }
      return fullContent
    },
    getAssistantTranscriptMessage() {
      if (!reasoningContent) {
        return null
      }

      return {
        role: 'assistant',
        content: assistantContent,
        reasoning_content: reasoningContent,
      }
    },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function extractStreamText(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }

  if (Array.isArray(value)) {
    return value.map((entry) => extractStreamText(entry)).join('')
  }

  if (!isRecord(value)) {
    return ''
  }

  if (typeof value.text === 'string') {
    return value.text
  }

  if (isRecord(value.text) && typeof value.text.value === 'string') {
    return value.text.value
  }

  if (typeof value.content === 'string') {
    return value.content
  }

  return ''
}

function extractErrorMessage(payload: Record<string, unknown>): string {
  const nestedError = payload.error
  if (isRecord(nestedError) && typeof nestedError.message === 'string') {
    return nestedError.message
  }

  return ''
}

function extractErrorCode(payload: Record<string, unknown>): string | undefined {
  const nestedError = payload.error
  if (isRecord(nestedError) && typeof nestedError.code === 'string') {
    return nestedError.code
  }

  if (typeof payload.errorCode === 'string') {
    return payload.errorCode
  }

  return undefined
}

function parsePayloadText(text: string): Record<string, unknown> | null {
  const trimmed = text.trim()
  if (!trimmed || trimmed === '[DONE]') {
    return null
  }

  const dataMatch = trimmed.match(/^data:\s*(.*)$/)
  const payloadText = dataMatch ? dataMatch[1] : trimmed
  if (!payloadText || payloadText === '[DONE]') {
    return null
  }

  try {
    return JSON.parse(payloadText) as Record<string, unknown>
  } catch {
    return null
  }
}

function extractResponsesApiStreamDelta(payload: Record<string, unknown>): StreamDeltaPayload | null {
  const type = typeof payload.type === 'string' ? payload.type.toLowerCase() : ''
  if (!type.endsWith('.delta')) {
    return null
  }

  const delta = extractStreamText(payload.delta)
  if (!delta) {
    return null
  }

  if (type.includes('reasoning') || type.includes('thinking')) {
    return { reasoning: delta }
  }
  if (type.includes('output_text') || type.includes('content')) {
    return { content: delta }
  }
  return null
}

function extractStreamDelta(payload: Record<string, unknown>): StreamDeltaPayload {
  const choice = Array.isArray(payload.choices) ? payload.choices[0] : null
  if (!isRecord(choice)) {
    const responseDelta = extractResponsesApiStreamDelta(payload)
    if (responseDelta) {
      return responseDelta
    }

    const output = isRecord(payload.output) ? payload.output : null
    const data = isRecord(payload.data) ? payload.data : null

    return {
      reasoning:
        extractStreamText(
          payload.reasoning_content ??
            payload.reasoning ??
            output?.reasoning_content ??
            output?.reasoning
        ) || null,
      content:
        extractStreamText(
          payload.output_text ??
            payload.response ??
            payload.result ??
            payload.message ??
            output?.text ??
            output?.content ??
            output?.message ??
            data?.content ??
            data?.text
        ) || null,
    }
  }

  const delta = isRecord(choice.delta) ? choice.delta : null
  const message = isRecord(choice.message) ? choice.message : null
  const source = delta ?? message
  if (!source) {
    return {}
  }

  return {
    reasoning: extractStreamText(source.reasoning_content ?? source.reasoning) || null,
    content: extractStreamText(source.content) || null,
  }
}

export async function consumeOpenAIStream(
  response: Response,
  onChunk: (chunk: string) => void,
  options?: ConsumeOpenAIStreamOptions
): Promise<string> {
  if (!response.body) {
    throw new Error('Response body is null')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const accumulator = createStreamAccumulator(onChunk)
  let buffer = ''
  const cancelReader = () => {
    void reader.cancel(createAbortError()).catch(() => undefined)
  }

  if (options?.signal?.aborted) {
    void reader.cancel(createAbortError()).catch(() => undefined)
    reader.releaseLock()
    throw createAbortError()
  }

  options?.signal?.addEventListener('abort', cancelReader, { once: true })

  const consumeLine = (line: string) => {
    const payload = parsePayloadText(line)
    if (!payload) {
      return
    }

    const errorMessage = extractErrorMessage(payload)
    if (errorMessage) {
      const mapped = options?.mapErrorPayload?.(errorMessage, extractErrorCode(payload))
      throw typeof mapped === 'string' ? new Error(mapped) : mapped || new Error(errorMessage)
    }

    const delta = extractStreamDelta(payload)
    if (!delta.reasoning && !delta.content) {
      return
    }

    accumulator.pushDelta(delta)
  }

  try {
    while (true) {
      throwIfAborted(options?.signal)
      const { done, value } = await raceWithAbort(reader.read(), options?.signal)
      throwIfAborted(options?.signal)
      if (done) {
        break
      }

      buffer = appendOpenAIStreamBuffer(buffer, decoder.decode(value, { stream: true }))
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        throwIfAborted(options?.signal)
        assertOpenAIStreamLineLength(line)
        consumeLine(line)
        throwIfAborted(options?.signal)
      }
      assertOpenAIStreamLineLength(buffer)
    }

    const finalDecoded = decoder.decode()
    if (finalDecoded) {
      buffer = appendOpenAIStreamBuffer(buffer, finalDecoded)
    }

    if (buffer.trim()) {
      throwIfAborted(options?.signal)
      assertOpenAIStreamLineLength(buffer)
      consumeLine(buffer)
      throwIfAborted(options?.signal)
    }

    const finalContent = accumulator.finish()
    throwIfAborted(options?.signal)
    const transcriptMessage = accumulator.getAssistantTranscriptMessage()
    if (transcriptMessage) {
      options?.onAssistantTranscriptMessage?.(transcriptMessage)
      throwIfAborted(options?.signal)
    }
    return finalContent
  } catch (error) {
    void reader.cancel(createAbortError()).catch(() => undefined)
    if (options?.signal?.aborted && !(
      error instanceof Error && error.name === 'AbortError'
    )) {
      throw createAbortError()
    }
    throw error
  } finally {
    options?.signal?.removeEventListener('abort', cancelReader)
    reader.releaseLock()
  }
}
