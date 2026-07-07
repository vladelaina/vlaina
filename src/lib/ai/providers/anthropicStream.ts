import {
  appendOpenAIStreamBuffer,
  assertOpenAIStreamLineLength,
  createStreamAccumulator,
  MAX_OPENAI_STREAM_ERROR_FIELD_CHARS,
} from '@/lib/ai/streaming'

export function isAbortError(error: unknown): boolean {
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

export async function consumeAnthropicStream(
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

  const throwIfStreamAborted = () => {
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
    throwIfStreamAborted()
    while (true) {
      const { done, value } = await raceWithAbort(reader.read(), signal)
      throwIfStreamAborted()
      if (done) break
      buffer = appendOpenAIStreamBuffer(buffer, decoder.decode(value, { stream: true }))
      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop() || ''
      for (const line of lines) {
        throwIfStreamAborted()
        assertOpenAIStreamLineLength(line)
        consumeLine(line)
        throwIfStreamAborted()
      }
      assertOpenAIStreamLineLength(buffer)
    }

    const finalDecoded = decoder.decode()
    if (finalDecoded) {
      buffer = appendOpenAIStreamBuffer(buffer, finalDecoded)
    }

    if (buffer.trim()) {
      throwIfStreamAborted()
      assertOpenAIStreamLineLength(buffer)
      consumeLine(buffer)
      throwIfStreamAborted()
    }

    const finalContent = accumulator.finish()
    throwIfStreamAborted()
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
