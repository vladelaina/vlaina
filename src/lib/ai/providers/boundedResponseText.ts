export const MAX_PROVIDER_ERROR_BODY_BYTES = 64 * 1024
export const MAX_PROVIDER_JSON_RESPONSE_BODY_BYTES = 64 * 1024 * 1024
const MAX_PROVIDER_CONTENT_LENGTH_CHARS = 32

function createAbortError(): DOMException {
  return new DOMException('Aborted', 'AbortError')
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return
  throw createAbortError()
}

function createProviderResponseTooLargeError(): Error {
  return new Error('AI provider response body is too large.')
}

function readContentLength(response: Response): number | null {
  const rawContentLength = response.headers.get('content-length')
  if (!rawContentLength) {
    return null
  }

  if (rawContentLength.length > MAX_PROVIDER_CONTENT_LENGTH_CHARS) {
    return null
  }
  const trimmed = rawContentLength.trim()
  if (!/^\d+$/.test(trimmed)) {
    return null
  }
  const parsed = Number.parseInt(trimmed, 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
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

export async function readBoundedProviderResponseText(
  response: Response,
  signal?: AbortSignal,
  fallback = 'Unknown error',
  maxBytes = MAX_PROVIDER_ERROR_BODY_BYTES,
): Promise<string> {
  try {
    throwIfAborted(signal)
    const contentLength = readContentLength(response)
    if (contentLength !== null && contentLength > maxBytes) {
      void response.body?.cancel().catch(() => undefined)
      return fallback
    }

    if (!response.body) {
      return fallback
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let bytesRead = 0
    let text = ''
    const cancelReader = () => {
      void reader.cancel(createAbortError()).catch(() => undefined)
    }
    signal?.addEventListener('abort', cancelReader, { once: true })

    try {
      while (true) {
        const { done, value } = await raceWithAbort(reader.read(), signal)
        throwIfAborted(signal)
        if (done) {
          break
        }

        bytesRead += value.byteLength
        if (bytesRead > maxBytes) {
          void reader.cancel().catch(() => undefined)
          return fallback
        }
        text += decoder.decode(value, { stream: true })
      }

      return text + decoder.decode()
    } finally {
      signal?.removeEventListener('abort', cancelReader)
      reader.releaseLock()
    }
  } catch {
    if (signal?.aborted) {
      throw createAbortError()
    }
    return fallback
  }
}

export async function readBoundedProviderJsonResponse<T>(
  response: Response,
  signal?: AbortSignal,
): Promise<T> {
  throwIfAborted(signal)

  const contentLength = readContentLength(response)
  if (contentLength !== null && contentLength > MAX_PROVIDER_JSON_RESPONSE_BODY_BYTES) {
    void response.body?.cancel().catch(() => undefined)
    throw createProviderResponseTooLargeError()
  }

  if (!response.body) {
    return JSON.parse('') as T
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const chunks: string[] = []
  let bytesRead = 0
  const cancelReader = () => {
    void reader.cancel(createAbortError()).catch(() => undefined)
  }
  signal?.addEventListener('abort', cancelReader, { once: true })

  try {
    while (true) {
      const { done, value } = await raceWithAbort(reader.read(), signal)
      throwIfAborted(signal)
      if (done) {
        break
      }

      bytesRead += value.byteLength
      if (bytesRead > MAX_PROVIDER_JSON_RESPONSE_BODY_BYTES) {
        void reader.cancel().catch(() => undefined)
        throw createProviderResponseTooLargeError()
      }
      chunks.push(decoder.decode(value, { stream: true }))
    }

    chunks.push(decoder.decode())
    throwIfAborted(signal)
    return JSON.parse(chunks.join('')) as T
  } finally {
    signal?.removeEventListener('abort', cancelReader)
    reader.releaseLock()
  }
}
