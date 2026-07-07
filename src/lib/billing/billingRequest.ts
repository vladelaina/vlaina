const BILLING_GET_RETRY_DELAYS_MS = [300]
const BILLING_FAST_FAILURE_RETRY_WINDOW_MS = 2000
const BILLING_REQUEST_TIMEOUT_MS = 15_000
const MAX_BILLING_RESPONSE_BODY_BYTES = 64 * 1024
const MAX_BILLING_CONTENT_LENGTH_CHARS = 32

function createBillingTimeoutError(): Error {
  return new Error('Billing API request timed out.')
}

function throwIfBillingTimedOut(signal: AbortSignal): void {
  if (!signal.aborted) return
  throw createBillingTimeoutError()
}

async function raceBillingRequest<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  throwIfBillingTimedOut(signal)
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
      settle(() => reject(createBillingTimeoutError()))
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
            throwIfBillingTimedOut(signal)
            resolve(value)
          } catch (error) {
            reject(error)
          }
        })
      },
      (error) => {
        settle(() => {
          try {
            throwIfBillingTimedOut(signal)
            reject(error)
          } catch (timeoutError) {
            reject(timeoutError)
          }
        })
      }
    )
  })
}

export async function withBillingRequestTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => {
    controller.abort()
  }, BILLING_REQUEST_TIMEOUT_MS)

  try {
    return await operation(controller.signal)
  } catch (error) {
    if (controller.signal.aborted) {
      throw createBillingTimeoutError()
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

function readContentLength(response: Response): number | null {
  const rawContentLength = response.headers?.get('content-length')
  if (!rawContentLength) {
    return null
  }

  if (rawContentLength.length > MAX_BILLING_CONTENT_LENGTH_CHARS) {
    return null
  }
  const trimmed = rawContentLength.trim()
  if (!/^\d+$/.test(trimmed)) {
    return null
  }
  const parsed = Number.parseInt(trimmed, 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

async function readBillingResponseText(response: Response, signal: AbortSignal): Promise<string> {
  throwIfBillingTimedOut(signal)
  const contentLength = readContentLength(response)
  if (contentLength !== null && contentLength > MAX_BILLING_RESPONSE_BODY_BYTES) {
    void response.body?.cancel().catch(() => undefined)
    throw new Error('Billing API response body is too large.')
  }

  if (!response.body) {
    return ''
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let bytesRead = 0
  let text = ''
  const cancelReader = () => {
    void reader.cancel(createBillingTimeoutError()).catch(() => undefined)
  }
  signal.addEventListener('abort', cancelReader, { once: true })

  try {
    while (true) {
      const { done, value } = await raceBillingRequest(reader.read(), signal)
      throwIfBillingTimedOut(signal)
      if (done) {
        break
      }

      bytesRead += value.byteLength
      if (bytesRead > MAX_BILLING_RESPONSE_BODY_BYTES) {
        void reader.cancel().catch(() => undefined)
        throw new Error('Billing API response body is too large.')
      }
      text += decoder.decode(value, { stream: true })
    }

    return text + decoder.decode()
  } finally {
    signal.removeEventListener('abort', cancelReader)
    reader.releaseLock()
  }
}

export async function readBillingJson<T>(response: Response, signal: AbortSignal): Promise<T> {
  throwIfBillingTimedOut(signal)
  const text = await readBillingResponseText(response, signal)
  throwIfBillingTimedOut(signal)
  return JSON.parse(text) as T
}

export async function readJsonErrorMessage(response: Response, fallback: string, signal: AbortSignal): Promise<string> {
  try {
    const payload = await readBillingJson<{ error?: string }>(response, signal)
    if (typeof payload.error === 'string' && payload.error.trim()) {
      return payload.error.trim()
    }
  } catch {
  }

  return fallback
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
    || !!error && typeof error === 'object' && (error as { name?: unknown }).name === 'AbortError'
}

function delayBillingRetry(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) {
    return Promise.reject(createBillingTimeoutError())
  }

  return new Promise((resolve, reject) => {
    let timeout: ReturnType<typeof setTimeout>
    const abort = () => {
      clearTimeout(timeout)
      reject(createBillingTimeoutError())
    }
    const complete = () => {
      signal.removeEventListener('abort', abort)
      resolve()
    }
    signal.addEventListener('abort', abort, { once: true })
    timeout = setTimeout(complete, ms)
  })
}

export async function fetchBilling(url: string, init: RequestInit, signal: AbortSignal): Promise<Response> {
  throwIfBillingTimedOut(signal)
  const response = await raceBillingRequest(fetch(url, {
    ...init,
    signal,
  }), signal)
  throwIfBillingTimedOut(signal)
  return response
}

export async function fetchReadOnlyBilling(url: string, init: RequestInit, signal: AbortSignal): Promise<Response> {
  for (let attempt = 0; ; attempt += 1) {
    const startedAt = Date.now()
    try {
      return await fetchBilling(url, init, signal)
    } catch (error) {
      const retryDelayMs = BILLING_GET_RETRY_DELAYS_MS[attempt]
      const failedQuickly = Date.now() - startedAt <= BILLING_FAST_FAILURE_RETRY_WINDOW_MS
      if (signal.aborted || isAbortError(error) || retryDelayMs == null || !failedQuickly) {
        throw error
      }
      await delayBillingRetry(retryDelayMs, signal)
    }
  }
}
