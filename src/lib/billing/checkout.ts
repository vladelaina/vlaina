import { createElectronBillingCheckout, hasElectronDesktopBridge } from '@/lib/desktop/backend'

const API_BASE = 'https://api.vlaina.com'
const BILLING_GET_RETRY_DELAYS_MS = [300]
const BILLING_FAST_FAILURE_RETRY_WINDOW_MS = 2000
const BILLING_REQUEST_TIMEOUT_MS = 15_000
const MAX_BILLING_RESPONSE_BODY_BYTES = 64 * 1024

export type BillingPlanTier = 'plus' | 'pro' | 'max' | 'ultra'

export interface BillingPlan {
  tier: BillingPlanTier
  displayName: string
  monthlyPoints: number
  planPriceMicrounits: number
  priceUsd: number
}

interface BillingPlansResponse {
  success: boolean
  checkoutEnabled?: boolean
  plans?: BillingPlan[]
  error?: string
}

interface BillingCheckoutResponse {
  success: boolean
  url?: string
  error?: string
}

function isSupportedBillingOrigin(): boolean {
  if (typeof window === 'undefined' || hasElectronDesktopBridge()) {
    return true
  }

  const hostname = window.location.hostname.trim().toLowerCase()
  if (!hostname) {
    return true
  }

  return hostname === 'vlaina.com' || hostname.endsWith('.vlaina.com')
}

function assertSupportedBillingOrigin(): void {
  if (!isSupportedBillingOrigin()) {
    throw new Error('Membership checkout is unavailable on local development origins. Use vlaina.com/pricing or the desktop app.')
  }
}

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

async function withBillingRequestTimeout<T>(
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

async function readBillingResponseText(response: Response, signal: AbortSignal): Promise<string> {
  throwIfBillingTimedOut(signal)
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

async function readBillingJson<T>(response: Response, signal: AbortSignal): Promise<T> {
  throwIfBillingTimedOut(signal)
  const text = await readBillingResponseText(response, signal)
  throwIfBillingTimedOut(signal)
  return JSON.parse(text) as T
}

async function readJsonErrorMessage(response: Response, fallback: string, signal: AbortSignal): Promise<string> {
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

async function fetchBilling(url: string, init: RequestInit, signal: AbortSignal): Promise<Response> {
  throwIfBillingTimedOut(signal)
  const response = await raceBillingRequest(fetch(url, {
    ...init,
    signal,
  }), signal)
  throwIfBillingTimedOut(signal)
  return response
}

async function fetchReadOnlyBilling(url: string, init: RequestInit, signal: AbortSignal): Promise<Response> {
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

function normalizeCheckoutUrl(data: BillingCheckoutResponse | null | undefined): string {
  const url = typeof data?.url === 'string' ? data.url.trim() : ''
  if (!data?.success || !url) {
    throw new Error(data?.error || 'Failed to create checkout session')
  }
  return url
}

export async function fetchBillingPlans(): Promise<{
  checkoutEnabled: boolean
  plans: BillingPlan[]
}> {
  assertSupportedBillingOrigin()

  return await withBillingRequestTimeout(async (signal) => {
    const response = await fetchReadOnlyBilling(`${API_BASE}/billing/plans`, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
    }, signal)

    if (!response.ok) {
      throw new Error(await readJsonErrorMessage(response, `Failed to load membership plans: HTTP ${response.status}`, signal))
    }

    const data = await readBillingJson<BillingPlansResponse>(response, signal)
    return {
      checkoutEnabled: data.checkoutEnabled === true,
      plans: Array.isArray(data.plans) ? data.plans : [],
    }
  })
}

export async function createBillingCheckout(tier: BillingPlanTier): Promise<string> {
  if (hasElectronDesktopBridge()) {
    const data = await createElectronBillingCheckout(tier) as BillingCheckoutResponse
    return normalizeCheckoutUrl(data)
  }

  assertSupportedBillingOrigin()

  return await withBillingRequestTimeout(async (signal) => {
    const response = await fetchBilling(`${API_BASE}/billing/checkout`, {
      method: 'POST',
      cache: 'no-store',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tier }),
    }, signal)

    if (!response.ok) {
      throw new Error(await readJsonErrorMessage(response, `Failed to create checkout session: HTTP ${response.status}`, signal))
    }

    const data = await readBillingJson<BillingCheckoutResponse>(response, signal)
    return normalizeCheckoutUrl(data)
  })
}
